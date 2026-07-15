/**
 * @file features/inbox/services/inbox-sync-scheduler.service.ts
 *
 * Background scheduler that keeps the local DB in sync with Facebook.
 * Runs every 5 minutes across all active connections.
 *
 * Responsibilities:
 *   - Fetch the 15 most-recently-active conversations per connection.
 *   - Insert any messages missed by the webhook (gap-fill safety net).
 *   - Enqueue AI replies when the last message is from a client and
 *     the conversation is in AI mode (real-time guard).
 *   - Detect client messages that have been unanswered for more than
 *     UNANSWERED_THRESHOLD_MS and re-enqueue the AI reply job (24h guard).
 *   - Emit realtime events (WebSocket) so the inbox UI updates without a
 *     page refresh.
 *
 * CHANGES (realtime upgrade):
 *   - syncMessages() now stamps Conversation.lastClientMessageAt whenever a
 *     new CLIENT message is inserted — this is the source of truth for the
 *     Messenger 24h messaging-window banner (see messaging-window.util.ts).
 *   - ensureAiReply() / recoverUnansweredConversations() now emit
 *     `ai_typing_start` right before enqueuing the AI reply job, so the chat
 *     UI can show a "VendeoAI est en train d'écrire…" bubble. The actual
 *     `ai_typing_stop` is expected to be emitted by the AI reply worker once
 *     it has sent (or failed to send) the reply — see InboxEventEmitter.
 *     As a safety net, the frontend also clears the bubble automatically
 *     when a new message arrives for that conversation, or after ~20s.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../database/prisma.service.js';
import { FacebookGraphClient } from '../../facebook/clients/facebook-graph.client.js';
import { TokenEncryptionService } from '../../facebook/security/token-encryption.service.js';
import { AiQueueProducer } from '../../queue/producers/ai-queue.producer.js';
import { InboxEventEmitter } from '../gateways/inbox-sse.gateway.js';

/** Only look at conversations that had activity within this window per pass. */
const ACTIVE_WINDOW_MS = 24 * 60 * 60 * 1_000; // 24 h

/** Maximum conversations synced per connection per cron tick. */
const MAX_CONVERSATIONS_PER_PASS = 15;

/** Messages fetched per conversation per cron tick. */
const MESSAGES_PER_SYNC = 25;

/**
 * If a CLIENT message has not received an AI or PAGE reply within this
 * duration, the scheduler re-enqueues the AI reply job.
 * Catches cases where the initial AI reply job was lost (crash, queue overflow).
 */
const UNANSWERED_THRESHOLD_MS = 24 * 60 * 60 * 1_000; // 24 h

/** Delay between consecutive Graph API calls to avoid burst-rate issues. */
const INTER_CONNECTION_PAUSE_MS = 200;

@Injectable()
export class InboxSyncSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(InboxSyncSchedulerService.name);

  constructor(
    private readonly prisma:       PrismaService,
    private readonly graphClient:  FacebookGraphClient,
    private readonly encryption:   TokenEncryptionService,
    private readonly sseEmitter:   InboxEventEmitter,
    private readonly aiQueue:      AiQueueProducer,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Inbox background sync registered — every 5 min (cron)');
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async syncAllActiveConnections(): Promise<void> {
    const connections = await this.prisma.facebookConnection.findMany({
      where: { isActive: true, tokenStatus: 'VALID' },
      include: { businessProfile: { select: { userId: true } } },
    });

    if (connections.length === 0) return;

    this.logger.debug(`Background sync — ${connections.length} connection(s)`);

    let synced = 0;
    let skipped = 0;

    for (const conn of connections) {
      try {
        const token = this.encryption.decrypt(conn.encryptedAccessToken);
        await this.syncOneConnection(
          conn.pageId,
          conn.businessProfileId,
          conn.businessProfile.userId,
          token,
        );
        synced++;
      } catch (err: unknown) {
        skipped++;
        this.logger.warn(
          `Sync failed for page=${conn.pageId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      if (connections.indexOf(conn) < connections.length - 1) {
        await sleep(INTER_CONNECTION_PAUSE_MS);
      }
    }

    this.logger.debug(`Background sync done — synced: ${synced}, skipped: ${skipped}`);
  }

  // ─── Per-connection sync ───────────────────────────────────────────────────

  private async syncOneConnection(
    pageId:            string,
    businessProfileId: string,
    userId:            string,
    token:             string,
  ): Promise<void> {
    const fbConversations = await this.graphClient.getConversations(
      pageId,
      token,
      MAX_CONVERSATIONS_PER_PASS,
    );

    const activeWindow = new Date(Date.now() - ACTIVE_WINDOW_MS);

    for (const fbConv of fbConversations) {
      if (new Date(fbConv.updated_time) < activeWindow) continue;

      const localConv = await this.upsertConversation(
        fbConv, pageId, businessProfileId, token,
      );
      if (!localConv) continue;

      await this.syncMessages(localConv.id, fbConv.id, pageId, userId, token);
      await this.ensureAiReply(localConv.id, businessProfileId, userId);
    }

    // Separately: scan conversations with old unanswered client messages.
    await this.recoverUnansweredConversations(businessProfileId, userId);
  }

  // ─── Upsert conversation from Facebook ────────────────────────────────────

  private async upsertConversation(
    fbConv:            { id: string; updated_time: string; participants?: { data: ReadonlyArray<{ id: string; name: string }> } },
    pageId:            string,
    businessProfileId: string,
    token:             string,
  ) {
    const client = fbConv.participants?.data.find((p) => p.id !== pageId);
    if (!client) return null;

    // Best-effort profile refresh (name + avatar).
    const profile = await this.fetchClientProfile(client.id, token);
    const displayName     = profile?.name ?? client.name ?? null;
    const normalizedAvatar = normalizeUrl(profile?.profile_pic ?? null);

    return this.prisma.conversation.upsert({
      where: { businessProfileId_externalId: { businessProfileId, externalId: fbConv.id } },
      create: {
        businessProfileId,
        externalId:      fbConv.id,
        clientPsid:      client.id,
        clientName:      displayName,
        clientAvatarUrl: normalizedAvatar,
        lastMessageAt:   new Date(fbConv.updated_time),
      },
      update: {
        clientPsid:      client.id,
        clientName:      displayName ?? undefined,
        clientAvatarUrl: normalizedAvatar ?? undefined,
        lastMessageAt:   new Date(fbConv.updated_time),
      },
    });
  }

  // ─── Sync messages for one conversation ───────────────────────────────────

  private async syncMessages(
    localConvId: string,
    fbConvId:    string,
    pageId:      string,
    userId:      string,
    token:       string,
  ): Promise<void> {
    const fbMessages = await this.graphClient.getConversationMessages(
      fbConvId, token, MESSAGES_PER_SYNC,
    );

    for (const fbMsg of fbMessages) {
      const existing = await this.prisma.message.findUnique({
        where: { externalId: fbMsg.id },
      });

      const senderRole      = fbMsg.from?.id === pageId ? 'PAGE' : 'CLIENT';
      const fbCreatedAt     = new Date(fbMsg.created_time ?? Date.now());
      const firstAttachment = fbMsg.attachments?.data?.[0];
      const imageUrl        =
        firstAttachment?.image_data?.url ??
        (firstAttachment?.mime_type?.startsWith('image/') ? firstAttachment.file_url ?? null : null);
      const fileUrl =
        !imageUrl && firstAttachment?.file_url ? firstAttachment.file_url : null;

      if (!existing) {
        // New message missed by the webhook → insert and emit realtime event.
        const saved = await this.prisma.message.create({
          data: {
            conversationId: localConvId,
            externalId:     fbMsg.id,
            sender:         senderRole,
            content:        fbMsg.message ? normalizeText(fbMsg.message) : null,
            imageUrl,
            fileUrl,
            status:         'DELIVERED',
            createdAt:      fbCreatedAt,
          },
        });

        this.sseEmitter.newMessage(userId, {
          conversationId: localConvId,
          message: {
            id:                  saved.id,
            conversationId:      localConvId,
            sender:              senderRole,
            content:             saved.content,
            imageUrl:            saved.imageUrl,
            fileUrl:             saved.fileUrl,
            referenceImageUrls: [],
            status:              saved.status,
            externalId:          fbMsg.id,
            createdAt:           fbCreatedAt,
          },
        });

        const preview =
          saved.content?.trim() ||
          (imageUrl ? '📷 Photo' : fileUrl ? '📎 Fichier' : null);

        // lastClientMessageAt only advances on CLIENT messages — it is the
        // basis of the Messenger 24h messaging window (see toDto in
        // ConversationService / messaging-window.util.ts).
        await this.prisma.conversation.update({
          where: { id: localConvId },
          data: {
            lastMessage: preview,
            lastMessageAt: fbCreatedAt,
            ...(senderRole === 'CLIENT' ? { lastClientMessageAt: fbCreatedAt } : {}),
          },
        });

      } else if (fbMsg.message && existing.content !== normalizeText(fbMsg.message)) {
        // Message was edited on Facebook — keep DB in sync.
        await this.prisma.message.update({
          where: { id: existing.id },
          data:  { content: normalizeText(fbMsg.message) },
        });
      }
    }
  }

  // ─── AI reply guard (real-time) ────────────────────────────────────────────

  /**
   * If the latest message in the conversation is from the CLIENT and the
   * conversation is in AI mode, enqueue an AI reply.
   * The producer deduplicates jobs via singletonKey — safe to call repeatedly.
   */
  private async ensureAiReply(
    conversationId:    string,
    businessProfileId: string,
    userId:            string,
  ): Promise<void> {
    const conv = await this.prisma.conversation.findUnique({
      where:  { id: conversationId },
      select: { handoverStatus: true },
    });
    if (!conv || conv.handoverStatus !== 'AI') return;

    const last = await this.prisma.message.findFirst({
      where:   { conversationId },
      orderBy: { createdAt: 'desc' },
      select:  { id: true, sender: true, content: true, createdAt: true },
    });
    if (!last || last.sender !== 'CLIENT') return;

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data:  { needsAiReply: true },
    });

    // "VendeoAI est en train d'écrire…" — cleared by the AI worker
    // (ai_typing_stop) or automatically by the frontend on new_message/timeout.
    this.sseEmitter.aiTypingStart(userId, { conversationId });

    await this.aiQueue.enqueueAiReply({
      conversationId,
      inboundMessageId:  last.id,
      businessProfileId,
      userId,
      inboundText:       last.content ?? undefined,
      inboundCreatedAt:  last.createdAt.toISOString(),
    });
  }

  // ─── 24-hour unanswered message recovery ──────────────────────────────────

  /**
   * Finds AI-mode conversations where the last CLIENT message is older than
   * UNANSWERED_THRESHOLD_MS and has had no PAGE or AI reply since.
   * Re-enqueues the AI reply so no customer message is permanently missed.
   */
  private async recoverUnansweredConversations(
    businessProfileId: string,
    userId:            string,
  ): Promise<void> {
    const threshold = new Date(Date.now() - UNANSWERED_THRESHOLD_MS);

    const conversations = await this.prisma.conversation.findMany({
      where: {
        businessProfileId,
        handoverStatus: 'AI',
        needsAiReply:   true,
      },
      select: { id: true },
    });

    for (const { id } of conversations) {
      const lastMsg = await this.prisma.message.findFirst({
        where:   { conversationId: id },
        orderBy: { createdAt: 'desc' },
        select:  { id: true, sender: true, content: true, createdAt: true },
      });

      // Only act when the LAST message is from the CLIENT and is older than the threshold.
      if (!lastMsg || lastMsg.sender !== 'CLIENT' || lastMsg.createdAt > threshold) {
        continue;
      }

      this.logger.warn(
        `Unanswered client message detected in conv=${id} ` +
        `(age: ${Math.round((Date.now() - lastMsg.createdAt.getTime()) / 3_600_000)}h) — re-enqueuing AI reply`,
      );

      this.sseEmitter.aiTypingStart(userId, { conversationId: id });

      await this.aiQueue.enqueueAiReply({
        conversationId:    id,
        inboundMessageId:  lastMsg.id,
        businessProfileId,
        userId,
        inboundText:       lastMsg.content ?? undefined,
        inboundCreatedAt:  lastMsg.createdAt.toISOString(),
      });
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async fetchClientProfile(
    psid:  string,
    token: string,
  ): Promise<{ name: string | null; profile_pic: string | null } | null> {
    try {
      const p    = await this.graphClient.getMessengerUserProfile(psid, token);
      const name = (p.name ?? [p.first_name, p.last_name].filter(Boolean).join(' ').trim()) || null;
      return { name, profile_pic: p.profile_pic ?? null };
    } catch {
      return null;
    }
  }
}

// ─── Module-level helpers ──────────────────────────────────────────────────────

function normalizeText(input: string): string {
  return input
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\s-\s+/g, '\n- ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeUrl(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith('http://') ? `https://${url.slice(7)}` : url;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
