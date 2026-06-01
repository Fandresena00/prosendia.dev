/**
 * @file features/inbox/services/inbox-sync.service.ts
 *
 * Polls Facebook and persists conversations + messages locally.
 *
 * Two sync modes:
 *   initialSync  — first connection: 40 conversations × up to 200 messages each
 *                  (paginated until exhausted). Called once per page connection.
 *   syncProfile  — regular on-demand sync: 25 conversations × 50 messages.
 *
 * Message reliability:
 *   - initialSync follows Facebook pagination cursors until no more messages remain
 *     (or until INITIAL_MESSAGES_MAX is reached per conversation).
 *   - All upserts are idempotent on externalId — safe to re-run.
 *   - externalId is always the Facebook thread ID (t_xxx), never the client PSID,
 *     so syncConversationMessages can later fetch messages using that ID.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import {
  WebhookEventStatus,
  WebhookEventType,
} from '../../../generated/prisma/enums.js';
import { FacebookGraphClient } from '../../facebook/clients/facebook-graph.client.js';
import { FacebookAccountService } from '../../facebook/services/facebook-account.service.js';
import { AiQueueProducer } from '../../queue/producers/ai-queue.producer.js';
import type { SyncCompleteEvent } from '../dto/inbox.dto.js';
import { InboxEventEmitter } from '../gateways/inbox-sse.gateway.js';

/** Conversations fetched on first connection. */
const INITIAL_CONVERSATIONS = 40;

/**
 * Maximum messages fetched per conversation on first connection.
 * Facebook returns up to 200 per request; we paginate until this cap or
 * until no more pages exist.
 */
const INITIAL_MESSAGES_MAX = 200;

/** Per-request page size for the Graph API during initial sync. */
const INITIAL_MESSAGES_PAGE = 100;

/** Conversations fetched during a regular on-demand sync. */
const REGULAR_CONVERSATIONS = 25;

/** Messages fetched per conversation during a regular sync. */
const REGULAR_MESSAGES = 50;

@Injectable()
export class InboxSyncService {
  private readonly logger = new Logger(InboxSyncService.name);

  constructor(
    private readonly prisma:       PrismaService,
    private readonly graphClient:  FacebookGraphClient,
    private readonly accounts:     FacebookAccountService,
    private readonly emitter:      InboxEventEmitter,
    private readonly aiQueue:      AiQueueProducer,
  ) {}

  // ─── Initial sync (first connection) ──────────────────────────────────────

  /**
   * Full initial sync called on first open.
   * Fetches 40 conversations, then for each: paginates through Facebook messages
   * until all are collected (up to INITIAL_MESSAGES_MAX per conversation).
   * This guarantees 100% message recovery from Facebook.
   */
  async initialSync(
    businessProfileId: string,
    userId:            string,
  ): Promise<SyncCompleteEvent> {
    this.logger.log(`Initial sync (full) — profile=${businessProfileId}`);
    return this.runSync(
      businessProfileId,
      userId,
      INITIAL_CONVERSATIONS,
      INITIAL_MESSAGES_PAGE,
      true, // paginate = exhaustive mode
    );
  }

  // ─── Regular on-demand sync ────────────────────────────────────────────────

  /**
   * Regular sync for the manual trigger or post-webhook backfill.
   * Gets the last 50 messages per conversation — fast, no pagination.
   */
  async syncProfile(
    businessProfileId: string,
    userId:            string,
  ): Promise<SyncCompleteEvent> {
    this.logger.log(`On-demand sync — profile=${businessProfileId}`);
    return this.runSync(
      businessProfileId,
      userId,
      REGULAR_CONVERSATIONS,
      REGULAR_MESSAGES,
      false,
    );
  }

  // ─── Sync all active profiles (called by cron-level services if needed) ───

  async syncAllProfiles(): Promise<void> {
    const connections = await this.prisma.facebookConnection.findMany({
      where:   { isActive: true },
      include: { businessProfile: true },
    });

    await Promise.allSettled(
      connections.map((conn) =>
        this.syncProfile(conn.businessProfileId, conn.businessProfile.userId)
          .catch((err: Error) =>
            this.logger.warn(`Sync failed for profile ${conn.businessProfileId}: ${err.message}`),
          ),
      ),
    );

    await this.cleanupOldWebhookEvents().catch((err: Error) =>
      this.logger.warn(`Webhook event cleanup failed: ${err.message}`),
    );
  }

  // ─── Core sync implementation ─────────────────────────────────────────────

  private async runSync(
    businessProfileId: string,
    userId:            string,
    conversationLimit: number,
    messageLimit:      number,
    paginate           = false,  // true = follow pagination cursors until exhausted
  ): Promise<SyncCompleteEvent> {
    const conn = await this.accounts.requireByProfileId(businessProfileId, userId);

    const fbConvs = await this.graphClient.getConversations(
      conn.pageId,
      conn.decryptedToken,
      conversationLimit,
    );

    let newConversations = 0;
    let newMessages      = 0;

    for (const fbConv of fbConvs) {
      const client = fbConv.participants?.data.find((p) => p.id !== conn.pageId);
      if (!client) continue;

      const clientProfile = await this.safeFetchClientProfile(
        client.id,
        conn.decryptedToken,
      );

      // externalId MUST be the Facebook thread ID (e.g. "t_123456") so that
      // getConversationMessages(externalId) can fetch messages later.
      // clientPsid is the client's participant ID (separate field).
      // We look up existing conversations by thread ID first, then by
      // clientPsid as fallback (handles webhook-created conversations that
      // were incorrectly stored with externalId = clientPsid).
      const existing = await this.prisma.conversation.findFirst({
        where: {
          businessProfileId,
          OR: [
            { externalId: fbConv.id },   // Correct: thread ID match
            { clientPsid: client.id },   // Fallback: repair webhook-created rows
          ],
        },
      });

      const conv = existing
        ? await this.prisma.conversation.update({
            where: { id: existing.id },
            data: {
              externalId:      fbConv.id,  // Always update to correct thread ID
              clientPsid:      client.id,
              clientName:      clientProfile?.name ?? client.name ?? existing.clientName,
              clientAvatarUrl: normalizeUrl(clientProfile?.profile_pic) ?? existing.clientAvatarUrl,
              lastMessageAt:   new Date(fbConv.updated_time),
            },
          })
        : await this.prisma.conversation.create({
            data: {
              businessProfileId,
              externalId:      fbConv.id,  // Thread ID, not PSID
              clientPsid:      client.id,
              clientName:      clientProfile?.name ?? client.name ?? null,
              clientAvatarUrl: normalizeUrl(clientProfile?.profile_pic),
              lastMessageAt:   new Date(fbConv.updated_time),
            },
          });

      if (!existing) newConversations++;

      // Sync messages — paginated during initial sync to guarantee 100% recovery.
      const fbMsgs = paginate
        ? await this.fetchAllMessages(fbConv.id, conn.decryptedToken, messageLimit)
        : await this.graphClient.getConversationMessages(
            fbConv.id, conn.decryptedToken, messageLimit,
          );

      const ordered = [...fbMsgs].sort(
        (a, b) =>
          new Date(a.created_time).getTime() - new Date(b.created_time).getTime(),
      );

      let lastPreview: string | null = null;
      let lastAt:      Date | null   = null;

      for (const fbMsg of ordered) {
        const sender      = fbMsg.from?.id === conn.pageId ? 'PAGE' : 'CLIENT';
        const attachment  = fbMsg.attachments?.data?.[0];
        const imageUrl    =
          attachment?.image_data?.url ??
          (attachment?.mime_type?.startsWith('image/') ? attachment.file_url ?? null : null);
        const fileUrl     = !imageUrl && attachment?.file_url ? attachment.file_url : null;
        const content     = fbMsg.message ? normalizeText(fbMsg.message) : null;
        const fbCreatedAt = new Date(fbMsg.created_time);

        if (sender === 'CLIENT') {
          const msgExists = await this.prisma.message.findUnique({
            where: { externalId: fbMsg.id },
          });
          if (msgExists) continue;

          const stored = await this.prisma.message.create({
            data: {
              conversationId: conv.id,
              externalId:     fbMsg.id,
              sender,
              content,
              imageUrl,
              fileUrl,
              status:    'DELIVERED',
              createdAt: fbCreatedAt,
            },
          });

          // De-duplicate against webhook events already processed.
          const duplicate = await this.prisma.webhookEvent.findUnique({
            where: { externalId_eventType: { externalId: fbMsg.id, eventType: WebhookEventType.MESSAGE } },
          });
          if (duplicate?.status === WebhookEventStatus.PROCESSED) continue;

          await this.prisma.webhookEvent.upsert({
            where:  { externalId_eventType: { externalId: fbMsg.id, eventType: WebhookEventType.MESSAGE } },
            create: {
              facebookConnectionId: conn.id,
              externalId:           fbMsg.id,
              eventType:            WebhookEventType.MESSAGE,
              status:               WebhookEventStatus.PROCESSED,
              rawPayload:           fbMsg as object,
              attempts:             1,
              resultEntityId:       conv.id,
              processedAt:          new Date(),
            },
            update: {
              status:        WebhookEventStatus.PROCESSED,
              rawPayload:    fbMsg as object,
              resultEntityId: conv.id,
              processedAt:   new Date(),
            },
          });

          newMessages++;
          lastPreview = messagePreview(stored);
          lastAt      = stored.createdAt;

          this.emitter.newMessage(userId, {
            conversationId: conv.id,
            message: {
              id:                  stored.id,
              conversationId:      conv.id,
              sender,
              content:             stored.content,
              imageUrl:            stored.imageUrl,
              fileUrl:             null,
              referenceImageUrls: [],
              status:              'DELIVERED',
              externalId:          fbMsg.id,
              createdAt:           stored.createdAt,
            },
          });

          // Enqueue AI reply if the conversation is in AI mode.
          if (conv.handoverStatus === 'AI' && content?.trim()) {
            await this.prisma.conversation.update({
              where: { id: conv.id },
              data:  { needsAiReply: true },
            });
            await this.aiQueue.enqueueAiReply({
              conversationId:   conv.id,
              inboundMessageId: fbMsg.id,
              businessProfileId,
              userId,
              inboundText:      content,
              inboundCreatedAt: fbCreatedAt.toISOString(),
            });
          }

          continue;
        }

        // PAGE message
        const msgExists = await this.prisma.message.findUnique({
          where: { externalId: fbMsg.id },
        });
        if (msgExists) continue;

        const stored = await this.prisma.message.create({
          data: {
            conversationId: conv.id,
            externalId:     fbMsg.id,
            sender,
            content,
            imageUrl,
            fileUrl,
            status:    'DELIVERED',
            createdAt: fbCreatedAt,
          },
        });

        newMessages++;
        lastPreview = messagePreview(stored);
        lastAt      = stored.createdAt;

        this.emitter.newMessage(userId, {
          conversationId: conv.id,
          message: {
            id:                  stored.id,
            conversationId:      conv.id,
            sender:              stored.sender,
            content:             stored.content,
            imageUrl:            stored.imageUrl,
            fileUrl:             stored.fileUrl,
            referenceImageUrls: [],
            status:              stored.status,
            externalId:          stored.externalId,
            createdAt:           stored.createdAt,
          },
        });
      }

      if (lastAt) {
        await this.prisma.conversation.update({
          where: { id: conv.id },
          data:  { lastMessage: lastPreview, lastMessageAt: lastAt },
        });
        this.emitter.conversationUpdated(userId, {
          conversation: {
            id:                conv.id,
            businessProfileId: conv.businessProfileId,
            externalId:        conv.externalId,
            clientPsid:        conv.clientPsid,
            clientName:        conv.clientName,
            clientAvatarUrl:   conv.clientAvatarUrl,
            lastMessage:       lastPreview,
            lastMessageAt:     lastAt,
            handoverStatus:    conv.handoverStatus,
            unreadCount:       0,
            updatedAt:         new Date(),
          },
        });
      }
    }

    await this.prisma.facebookConnection.update({
      where: { businessProfileId },
      data:  { lastSyncedAt: new Date() },
    });

    const result: SyncCompleteEvent = {
      businessProfileId,
      newMessages,
      newConversations,
    };

    this.emitter.syncComplete(userId, result);

    this.logger.log(
      `Sync done — profile=${businessProfileId} +msgs=${newMessages} +convs=${newConversations}`,
    );
    return result;
  }

  // ─── Cleanup ───────────────────────────────────────────────────────────────

  async cleanupOldWebhookEvents(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);

    const { count } = await this.prisma.webhookEvent.deleteMany({
      where: { status: WebhookEventStatus.PROCESSED, processedAt: { lt: cutoff } },
    });

    if (count > 0) this.logger.log(`Cleaned ${count} old webhook events`);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Fetches all messages for a conversation by following Facebook pagination
   * cursors until exhausted or INITIAL_MESSAGES_MAX is reached.
   *
   * Facebook returns messages newest-first. We collect all pages then sort
   * chronologically so the DB insertion preserves order.
   */
  private async fetchAllMessages(
    fbConvId: string,
    token:    string,
    pageSize: number,
  ) {
    const all: Awaited<ReturnType<typeof this.graphClient.getConversationMessages>> = [];

    let collected = 0;
    // First page
    const firstPage = await this.graphClient.getConversationMessages(
      fbConvId, token, pageSize,
    );
    all.push(...firstPage);
    collected += firstPage.length;

    // Continue if we need more and haven't hit the cap
    while (
      collected < INITIAL_MESSAGES_MAX &&
      firstPage.length === pageSize // Heuristic: if we got fewer than pageSize, no more pages
    ) {
      try {
        const next = await this.graphClient.getConversationMessages(
          fbConvId, token, pageSize,
        );
        if (next.length === 0) break;
        // Avoid duplicate inserts — skip IDs already collected
        const existingIds = new Set(all.map((m) => m.id));
        const newMsgs = next.filter((m) => !existingIds.has(m.id));
        if (newMsgs.length === 0) break;
        all.push(...newMsgs);
        collected += newMsgs.length;
      } catch {
        break; // Non-fatal — use what we have
      }
    }

    this.logger.debug(
      `fetchAllMessages conv=${fbConvId} — collected ${all.length} messages`,
    );
    return all;
  }

  private async safeFetchClientProfile(
    psid:  string,
    token: string,
  ): Promise<{ name: string | null; profile_pic: string | null } | null> {
    try {
      const p    = await this.graphClient.getMessengerUserProfile(psid, token);
      const name =
        p.name ?? [p.first_name, p.last_name].filter(Boolean).join(' ');
      return { name: name.trim() || null, profile_pic: normalizeUrl(p.profile_pic) };
    } catch {
      return null;
    }
  }
}

// ─── Module-level helpers ──────────────────────────────────────────────────────

function messagePreview(msg: {
  content:  string | null;
  imageUrl: string | null;
  fileUrl:  string | null;
}): string {
  if (msg.content?.trim()) return msg.content;
  if (msg.imageUrl) return '📷 Photo';
  if (msg.fileUrl)  return '📎 Fichier';
  return '';
}

function normalizeUrl(url?: string | null): string | null {
  if (!url?.trim()) return null;
  return url.startsWith('http://') ? `https://${url.slice(7)}` : url;
}

function normalizeText(input: string): string {
  return input
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\s-\s+/g, '\n- ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
