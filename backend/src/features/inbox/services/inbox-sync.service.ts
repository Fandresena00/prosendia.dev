/**
 * @file features/inbox/services/inbox-sync.service.ts
 *
 * Polls Facebook for new messages and conversations on a schedule,
 * then pushes SSE events to connected clients.
 *
 * This is a fallback for messages that arrive between webhook deliveries.
 * The webhook (WebhookService) handles real-time inbound messages;
 * this service catches any gaps.
 *
 * Schedule: every 60 seconds per active business profile.
 * Use @nestjs/schedule for the cron in the real app.
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

@Injectable()
export class InboxSyncService {
  private readonly logger = new Logger(InboxSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly graphClient: FacebookGraphClient,
    private readonly accounts: FacebookAccountService,
    private readonly emitter: InboxEventEmitter,
    private readonly aiQueue: AiQueueProducer,
  ) {}

  /**
   * Sync all conversations for a business profile.
   * Called by:
   *   - Cron job (every 60s)
   *   - POST /inbox/sync/:businessProfileId (manual trigger)
   *   - After webhook delivery to backfill context
   */
  async syncProfile(
    businessProfileId: string,
    userId: string,
  ): Promise<SyncCompleteEvent> {
    this.logger.log(`Syncing inbox for profile ${businessProfileId}`);

    const conn = await this.accounts.requireByProfileId(
      businessProfileId,
      userId,
    );

    // ── 1. Fetch conversations from Facebook ──────────────────────────────
    const fbConvs = await this.graphClient.getConversations(
      conn.pageId,
      conn.decryptedToken,
      25,
    );

    let newConversations = 0;
    let newMessages = 0;

    for (const fbConv of fbConvs) {
      const client = fbConv.participants?.data.find(
        (p) => p.id !== conn.pageId,
      );
      const clientPsid = client?.id;
      if (!clientPsid) continue;

      const clientProfile = await this.safeFetchClientProfile(
        clientPsid,
        conn.decryptedToken,
      );

      // Upsert conversation
      const existing = await this.prisma.conversation.findFirst({
        where: {
          businessProfileId,
          OR: [{ externalId: clientPsid }, { clientPsid: clientPsid }],
        },
      });

      const conv = existing
        ? await this.prisma.conversation.update({
            where: { id: existing.id },
            data: {
              externalId: clientPsid,
              clientPsid: clientPsid,
              clientName:
                clientProfile?.name ?? client?.name ?? existing.clientName,
              clientAvatarUrl:
                this.normalizeAvatarUrl(clientProfile?.profile_pic) ??
                existing.clientAvatarUrl,
              lastMessageAt: new Date(fbConv.updated_time),
            },
          })
        : await this.prisma.conversation.create({
            data: {
              businessProfileId,
              externalId: clientPsid,
              clientPsid: clientPsid,
              clientName: clientProfile?.name ?? client?.name ?? null,
              clientAvatarUrl: this.normalizeAvatarUrl(
                clientProfile?.profile_pic,
              ),
              lastMessageAt: new Date(fbConv.updated_time),
            },
          });

      if (!existing) newConversations++;

      // ── 2. Sync messages for each conversation ────────────────────────
      const fbMsgs = await this.graphClient.getConversationMessages(
        fbConv.id,
        conn.decryptedToken,
        25,
      );
      const ordered = [...fbMsgs].sort(
        (a, b) =>
          new Date(a.created_time).getTime() -
          new Date(b.created_time).getTime(),
      );

      let lastPreview: string | null = null;
      let lastAt: Date | null = null;

      for (const fbMsg of ordered) {
        const sender = fbMsg.from.id === conn.pageId ? 'PAGE' : 'CLIENT';
        const attachment = fbMsg.attachments?.data?.[0];
        const imageUrl = attachment?.image_data?.url ?? null;
        const content = fbMsg.message ? normalizeMessageText(fbMsg.message) : null;

        if (sender === 'CLIENT') {
          const exists = await this.prisma.message.findUnique({
            where: { externalId: fbMsg.id },
          });
          if (exists) continue;

          const stored = await this.prisma.message.create({
            data: {
              conversationId: conv.id,
              externalId: fbMsg.id,
              sender,
              content,
              imageUrl,
              status: 'DELIVERED',
              createdAt: new Date(fbMsg.created_time),
            },
          });

          const duplicate = await this.prisma.webhookEvent.findUnique({
            where: {
              externalId_eventType: {
                externalId: fbMsg.id,
                eventType: WebhookEventType.MESSAGE,
              },
            },
          });
          if (duplicate?.status === WebhookEventStatus.PROCESSED) continue;

          await this.prisma.webhookEvent.upsert({
            where: {
              externalId_eventType: {
                externalId: fbMsg.id,
                eventType: WebhookEventType.MESSAGE,
              },
            },
            create: {
              facebookConnectionId: conn.id,
              externalId: fbMsg.id,
              eventType: WebhookEventType.MESSAGE,
              status: WebhookEventStatus.PROCESSED,
              rawPayload: fbMsg as object,
              attempts: 1,
              resultEntityId: conv.id,
              processedAt: new Date(),
            },
            update: {
              status: WebhookEventStatus.PROCESSED,
              rawPayload: fbMsg as object,
              resultEntityId: conv.id,
              processedAt: new Date(),
            },
          });

          newMessages++;
          lastPreview = this.messagePreview(stored);
          lastAt = stored.createdAt;

          this.emitter.newMessage(userId, {
            conversationId: conv.id,
            message: {
              id: stored.id,
              conversationId: conv.id,
              sender,
              content: stored.content,
              imageUrl: stored.imageUrl,
              fileUrl: null,
              referenceImageUrls: [],
              status: 'DELIVERED',
              externalId: fbMsg.id,
              createdAt: stored.createdAt,
            },
          });

          if (conv.handoverStatus === 'AI' && content?.trim()) {
            await this.prisma.conversation.update({
              where: { id: conv.id },
              data: { needsAiReply: true },
            });
            await this.aiQueue.enqueueAiReply({
              conversationId: conv.id,
              inboundMessageId: fbMsg.id,
              businessProfileId,
              userId,
              inboundText: content,
              inboundCreatedAt: lastAt.toISOString(),
            });
          }
          continue;
        }

        const exists = await this.prisma.message.findUnique({
          where: { externalId: fbMsg.id },
        });
        if (exists) continue;

        const stored = await this.prisma.message.create({
          data: {
            conversationId: conv.id,
            externalId: fbMsg.id,
            sender,
            content,
            imageUrl,
            status: 'DELIVERED',
            createdAt: new Date(fbMsg.created_time),
          },
        });

        newMessages++;
        lastPreview = this.messagePreview(stored);
        lastAt = stored.createdAt;

        this.emitter.newMessage(userId, {
          conversationId: conv.id,
          message: {
            id: stored.id,
            conversationId: conv.id,
            sender: stored.sender,
            content: stored.content,
            imageUrl: stored.imageUrl,
            fileUrl: stored.fileUrl,
            referenceImageUrls: [],
            status: stored.status,
            externalId: stored.externalId,
            createdAt: stored.createdAt,
          },
        });
      }

      if (lastAt) {
        await this.prisma.conversation.update({
          where: { id: conv.id },
          data: { lastMessage: lastPreview, lastMessageAt: lastAt },
        });
        this.emitter.conversationUpdated(userId, {
          conversation: {
            id: conv.id,
            businessProfileId: conv.businessProfileId,
            externalId: conv.externalId,
            clientPsid: conv.clientPsid,
            clientName: conv.clientName,
            clientAvatarUrl: conv.clientAvatarUrl,
            lastMessage: lastPreview,
            lastMessageAt: lastAt,
            handoverStatus: conv.handoverStatus,
            unreadCount: 0,
            updatedAt: new Date(),
          },
        });
      }
    }

    // Update connection lastSyncedAt
    await this.prisma.facebookConnection.update({
      where: { businessProfileId },
      data: { lastSyncedAt: new Date() },
    });

    const result: SyncCompleteEvent = {
      businessProfileId,
      newMessages,
      newConversations,
    };

    // Emit sync_complete event
    const profile = await this.prisma.businessProfile.findUnique({
      where: { id: businessProfileId },
      select: { userId: true },
    });
    if (profile) {
      this.emitter.syncComplete(profile.userId, result);
    }

    this.logger.log(
      `Sync done — profile=${businessProfileId} newMsgs=${newMessages} newConvs=${newConversations}`,
    );
    return result;
  }

  private messagePreview(msg: {
    content: string | null;
    imageUrl: string | null;
    fileUrl: string | null;
  }): string {
    if (msg.content?.trim()) return msg.content;
    if (msg.imageUrl) return '📷 Photo';
    if (msg.fileUrl) return '📎 Fichier';
    return '';
  }

  private async safeFetchClientProfile(
    psid: string,
    pageAccessToken: string,
  ): Promise<{ name: string | null; profile_pic: string | null } | null> {
    try {
      const profile = await this.graphClient.getMessengerUserProfile(
        psid,
        pageAccessToken,
      );
      const name =
        profile.name ??
        [profile.first_name, profile.last_name].filter(Boolean).join(' ');
      return {
        name: name.trim() || null,
        profile_pic: this.normalizeAvatarUrl(profile.profile_pic),
      };
    } catch {
      return null;
    }
  }

  private normalizeAvatarUrl(url?: string | null): string | null {
    if (!url?.trim()) return null;
    if (url.startsWith('http://'))
      return `https://${url.slice('http://'.length)}`;
    return url;
  }

  /**
   * Sync all active profiles for all users.
   * Called by the cron job every 60 seconds.
   */
  async syncAllProfiles(): Promise<void> {
    const connections = await this.prisma.facebookConnection.findMany({
      where: { isActive: true },
      include: { businessProfile: true },
    });

    await Promise.allSettled(
      connections.map((conn) =>
        this.syncProfile(
          conn.businessProfileId,
          conn.businessProfile.userId,
        ).catch((err) => {
          this.logger.warn(
            `Sync failed for profile ${conn.businessProfileId}: ${err.message}`,
          );
        }),
      ),
    );

    // Clean up old webhook events periodically
    await this.cleanupOldWebhookEvents().catch((err) =>
      this.logger.warn(`Cleanup failed: ${err.message}`),
    );
  }

  /**
   * Clean up old processed webhook events to prevent database bloat.
   * Deletes events older than 7 days that are in PROCESSED status.
   */
  async cleanupOldWebhookEvents(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);

    const deleted = await this.prisma.webhookEvent.deleteMany({
      where: {
        status: WebhookEventStatus.PROCESSED,
        processedAt: { lt: cutoff },
      },
    });

    if (deleted.count > 0) {
      this.logger.log(`Cleaned up ${deleted.count} old webhook events`);
    }
  }
}

function normalizeMessageText(input: string): string {
  return input
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\s-\s+/g, '\n- ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
