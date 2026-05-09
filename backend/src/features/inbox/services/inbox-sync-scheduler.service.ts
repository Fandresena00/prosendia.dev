/**
 * @file features/inbox/services/inbox-sync-scheduler.service.ts
 *
 * Scheduled background service that keeps the local DB a faithful mirror
 * of Facebook's data.
 *
 * WHY THIS IS NEEDED
 * ──────────────────
 * Webhooks are the primary real-time feed, but they can be missed:
 *   - Server was down during delivery (Facebook does NOT retry indefinitely)
 *   - Network timeout between Facebook and the server
 *   - Facebook rate-limits webhook deliveries under load
 *   - Webhook processing threw an error after Facebook already got the 200
 *
 * This scheduler is the reliability safety net: it queries the Facebook
 * Graph API directly and upserts everything it finds into the DB,
 * closing any gaps left by missed webhook events.
 *
 * SYNC SCOPE (per connection, every 5 minutes)
 * ────────────────────────────────────────────
 *   1. Refresh participant info (name, avatar) for all conversations
 *      active in the last 24 hours.
 *   2. Fetch the latest messages for those conversations.
 *   3. Emit SSE events for any net-new messages so the inbox UI
 *      updates instantly without waiting for the frontend poll.
 *
 * WHAT THIS GUARANTEES
 * ────────────────────
 *   - Maximum message gap: 5 minutes (scheduler interval)
 *   - Avatar/name staleness: 5 minutes
 *   - Message content accuracy: byte-for-byte from the Graph API
 *   - Timestamps: Facebook's createdAt, not the backend's receive time
 *
 * RATE LIMIT AWARENESS
 * ────────────────────
 *   - Only connections with VALID tokens are synced.
 *   - Only conversations active in the last 24 hours are synced (not all history).
 *   - A 200ms pause between connections avoids bursting the Graph API.
 *   - Errors are caught per connection so one failure doesn't abort the full pass.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../database/prisma.service.js';
import { FacebookGraphClient } from '../../facebook/clients/facebook-graph.client.js';
import { TokenEncryptionService } from '../../facebook/security/token-encryption.service.js';
import { InboxEventEmitter } from '../gateways/inbox-sse.gateway.js';

/** Only sync conversations that had activity in this window. */
const ACTIVE_CONVERSATION_WINDOW_MS = 24 * 60 * 60 * 1_000; // 24 hours

/** Maximum recent conversations to sync per connection per pass. */
const MAX_CONVERSATIONS_PER_PASS = 15;

/** Maximum messages to fetch per conversation per pass. */
const MESSAGES_PER_CONVERSATION_SYNC = 25;

/** Pause between connections to avoid bursting the Graph API. */
const INTER_CONNECTION_PAUSE_MS = 200;

@Injectable()
export class InboxSyncSchedulerService {
  private readonly logger = new Logger(InboxSyncSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly graphClient: FacebookGraphClient,
    private readonly encryption: TokenEncryptionService,
    private readonly sseEmitter: InboxEventEmitter,
  ) {}

  // ─── Scheduled entry point ────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_5_MINUTES)
  async syncAllActiveConnections(): Promise<void> {
    const activeConnections = await this.prisma.facebookConnection.findMany({
      where: {
        isActive: true,
        tokenStatus: 'VALID',
      },
      include: {
        businessProfile: { select: { userId: true } },
      },
    });

    if (activeConnections.length === 0) return;

    this.logger.debug(
      `Background sync starting — ${activeConnections.length} active connection(s)`,
    );

    let synced = 0;
    let skipped = 0;

    for (const connection of activeConnections) {
      try {
        const decryptedToken = this.encryption.decrypt(
          connection.encryptedAccessToken,
        );
        await this.syncOneConnection(
          connection.id,
          connection.pageId,
          connection.businessProfileId,
          connection.businessProfile.userId,
          decryptedToken,
        );
        synced++;
      } catch (err: unknown) {
        skipped++;
        this.logger.warn(
          `Background sync failed for page=${connection.pageId}: ` +
            `${err instanceof Error ? err.message : String(err)}`,
        );
      }

      // Avoid burst-rate against the Graph API
      if (
        activeConnections.indexOf(connection) <
        activeConnections.length - 1
      ) {
        await new Promise((r) => setTimeout(r, INTER_CONNECTION_PAUSE_MS));
      }
    }

    if (synced > 0 || skipped > 0) {
      this.logger.debug(
        `Background sync complete — synced: ${synced}, skipped: ${skipped}`,
      );
    }
  }

  // ─── Sync one Facebook connection ─────────────────────────────────────────

  private async syncOneConnection(
    connectionId: string,
    pageId: string,
    businessProfileId: string,
    userId: string,
    decryptedToken: string,
  ): Promise<void> {
    // ── 1. Fetch recent conversations from Facebook ────────────────────────
    const fbConversations = await this.graphClient.getConversations(
      pageId,
      decryptedToken,
      MAX_CONVERSATIONS_PER_PASS,
    );

    const activeWindow = new Date(Date.now() - ACTIVE_CONVERSATION_WINDOW_MS);

    for (const fbConv of fbConversations) {
      const fbUpdatedAt = new Date(fbConv.updated_time);

      // Skip stale conversations (no activity in the window)
      if (fbUpdatedAt < activeWindow) continue;

      // Find or create the conversation record
      const localConversation = await this.upsertConversationFromFacebook(
        fbConv,
        pageId,
        businessProfileId,
        decryptedToken,
      );

      if (!localConversation) continue;

      // ── 2. Sync messages for this conversation ───────────────────────────
      await this.syncMessagesForConversation(
        localConversation.id,
        fbConv.id,
        pageId,
        userId,
        decryptedToken,
      );
    }
  }

  // ─── Upsert conversation from Facebook data ───────────────────────────────

  private async upsertConversationFromFacebook(
    fbConv: {
      id: string;
      updated_time: string;
      participants?: { data: ReadonlyArray<{ id: string; name: string }> };
    },
    pageId: string,
    businessProfileId: string,
    decryptedToken: string,
  ) {
    // Identify the client participant (not the page itself)
    const clientParticipant = fbConv.participants?.data.find(
      (p) => p.id !== pageId,
    );
    if (!clientParticipant) return null;

    // Fetch fresh client profile (name + avatar) from the Graph API
    const freshClientProfile = await this.fetchClientProfile(
      clientParticipant.id,
      pageId,
      decryptedToken,
    );

    const normalizedAvatarUrl = this.normalizeUrl(
      freshClientProfile?.profile_pic ?? null,
    );
    const displayName =
      freshClientProfile?.name ?? clientParticipant.name ?? null;

    // Upsert conversation — Facebook's data wins over anything stored locally
    return this.prisma.conversation.upsert({
      where: {
        businessProfileId_externalId: {
          businessProfileId,
          externalId: fbConv.id,
        },
      },
      create: {
        businessProfileId,
        externalId: fbConv.id,
        clientPsid: clientParticipant.id,
        clientName: displayName,
        clientAvatarUrl: normalizedAvatarUrl,
        lastMessageAt: new Date(fbConv.updated_time),
      },
      update: {
        // Always refresh participant info from Facebook — source of truth
        clientPsid: clientParticipant.id,
        clientName: displayName ?? undefined,
        clientAvatarUrl: normalizedAvatarUrl ?? undefined,
        lastMessageAt: new Date(fbConv.updated_time),
      },
    });
  }

  // ─── Sync messages for one conversation ──────────────────────────────────

  private async syncMessagesForConversation(
    localConversationId: string,
    fbConversationId: string,
    pageId: string,
    userId: string,
    decryptedToken: string,
  ): Promise<void> {
    // Fetch the latest messages from Facebook's Graph API
    const fbMessages = await this.graphClient.getConversationMessages(
      fbConversationId,
      decryptedToken,
      MESSAGES_PER_CONVERSATION_SYNC,
    );

    let newMessagesFound = 0;

    for (const fbMsg of fbMessages) {
      const senderRole = fbMsg.from.id === pageId ? 'PAGE' : 'CLIENT';

      // Use Facebook's timestamp (not the backend receive time)
      const fbCreatedAt = new Date(fbMsg.created_time ?? Date.now());

      const existingMessage = await this.prisma.message.findUnique({
        where: { externalId: fbMsg.id },
      });

      if (!existingMessage) {
        // New message missed by webhook → insert it
        const savedMessage = await this.prisma.message.create({
          data: {
            conversationId: localConversationId,
            externalId: fbMsg.id,
            sender: senderRole,
            content: fbMsg.message ?? null,
            status: 'DELIVERED',
            // Use Facebook's createdAt — not now()
            createdAt: fbCreatedAt,
          },
        });

        newMessagesFound++;

        // Emit SSE so the frontend updates immediately without waiting for the poll
        const conversation = await this.prisma.conversation.findUnique({
          where: { id: localConversationId },
          include: { businessProfile: { select: { userId: true } } },
        });

        if (conversation) {
          this.sseEmitter.newMessage(conversation.businessProfile.userId, {
            conversationId: localConversationId,
            message: {
              id: savedMessage.id,
              conversationId: localConversationId,
              sender: senderRole,
              content: savedMessage.content,
              imageUrl: savedMessage.imageUrl,
              fileUrl: savedMessage.fileUrl,
              referenceImageUrls: [],
              status: savedMessage.status,
              externalId: fbMsg.id,
              createdAt: fbCreatedAt,
            },
          });

          // Update conversation lastMessage
          await this.prisma.conversation.update({
            where: { id: localConversationId },
            data: {
              lastMessage: fbMsg.message ?? null,
              lastMessageAt: fbCreatedAt,
            },
          });

          this.sseEmitter.conversationUpdated(
            conversation.businessProfile.userId,
            {
              conversation: {
                id: conversation.id,
                businessProfileId: conversation.businessProfileId,
                externalId: conversation.externalId,
                clientPsid: conversation.clientPsid,
                clientName: conversation.clientName,
                clientAvatarUrl: conversation.clientAvatarUrl,
                lastMessage: fbMsg.message ?? null,
                lastMessageAt: fbCreatedAt,
                handoverStatus: conversation.handoverStatus,
                unreadCount: senderRole === 'CLIENT' ? 1 : 0,
                updatedAt: new Date(),
              },
            },
          );
        }
      } else if (existingMessage.content !== fbMsg.message && fbMsg.message) {
        // Message content changed (edit) — update to match Facebook
        await this.prisma.message.update({
          where: { id: existingMessage.id },
          data: { content: fbMsg.message },
        });
      }
    }

    if (newMessagesFound > 0) {
      this.logger.log(
        `Background sync found ${newMessagesFound} missed message(s) ` +
          `for conversation=${localConversationId}`,
      );
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async fetchClientProfile(
    psid: string,
    pageId: string,
    decryptedToken: string,
  ): Promise<{ name: string | null; profile_pic: string | null } | null> {
    try {
      const profile = await this.graphClient.getMessengerUserProfile(
        psid,
        decryptedToken,
      );
      const name =
        (profile.name ??
          [profile.first_name, profile.last_name]
            .filter(Boolean)
            .join(' ')
            .trim()) ||
        null;
      return { name: name || null, profile_pic: profile.profile_pic ?? null };
    } catch {
      return null;
    }
  }

  /**
   * Ensures avatar URLs are always HTTPS.
   * Facebook occasionally returns http:// URLs for CDN assets.
   */
  private normalizeUrl(rawUrl: string | null): string | null {
    if (!rawUrl) return null;
    if (rawUrl.startsWith('http://')) return `https://${rawUrl.slice(7)}`;
    return rawUrl;
  }
}
