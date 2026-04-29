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

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import { FacebookGraphClient } from '../../facebook/clients/facebook-graph.client.js';
import type { FbConversation, FbMessage } from '../../facebook/clients/facebook-graph.client.js';
import { FacebookAccountService } from '../../facebook/services/facebook-account.service.js';
import type { ConversationResponseDto, MessageResponseDto, SyncCompleteEvent } from '../dto/inbox.dto.js';
import { InboxEventEmitter } from '../gateways/inbox-sse.gateway.js';

@Injectable()
export class InboxSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InboxSyncService.name);
  private syncTimer: NodeJS.Timeout | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly graphClient: FacebookGraphClient,
    private readonly accounts: FacebookAccountService,
    private readonly emitter: InboxEventEmitter,
  ) {}

  onModuleInit(): void {
    this.syncTimer = setInterval(() => {
      void this.syncAllProfiles();
    }, 60_000);

    setTimeout(() => {
      void this.syncAllProfiles();
    }, 5_000);
  }

  onModuleDestroy(): void {
    if (this.syncTimer) clearInterval(this.syncTimer);
  }

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
      100,
    );

    let newConversations = 0;
    let newMessages = 0;

    for (const fbConv of fbConvs) {
      const client = fbConv.participants?.data.find(
        (p) => p.id !== conn.pageId,
      );
      const clientProfile = client?.id
        ? await this.getClientProfile(client.id, conn.decryptedToken)
        : null;

      const existing = await this.prisma.conversation.findFirst({
        where: {
          businessProfileId,
          OR: [
            { externalId: fbConv.id },
            ...(client?.id ? [{ clientPsid: client.id }, { externalId: client.id }] : []),
          ],
        },
      });

      const conv = existing
        ? await this.prisma.conversation.update({
            where: { id: existing.id },
            data: {
              externalId: fbConv.id,
              clientPsid: client?.id ?? existing.clientPsid,
              clientName:
                clientProfile?.name ?? client?.name ?? existing.clientName,
              clientAvatarUrl:
                clientProfile?.profile_pic ?? existing.clientAvatarUrl,
              lastMessageAt: new Date(fbConv.updated_time),
            },
          })
        : await this.prisma.conversation.create({
            data: {
              businessProfileId,
              externalId: fbConv.id,
              clientPsid: client?.id ?? null,
              clientName: clientProfile?.name ?? client?.name ?? null,
              clientAvatarUrl: clientProfile?.profile_pic ?? null,
              lastMessageAt: new Date(fbConv.updated_time),
            },
          });

      if (!existing) newConversations++;

      // ── 2. Sync messages for each conversation ────────────────────────
      const messages = await this.graphClient.getConversationMessages(
        fbConv.id,
        conn.decryptedToken,
        100,
      );

      const orderedMessages = [...messages].sort(
        (a, b) =>
          new Date(a.created_time).getTime() - new Date(b.created_time).getTime(),
      );

      let lastStoredMessage: MessageResponseDto | null = null;

      if (orderedMessages.length > 0) {
        for (const fbMsg of orderedMessages) {
          // Skip if already stored
          const exists = await this.prisma.message.findUnique({
            where: { externalId: fbMsg.id },
          });
          if (exists) continue;

          const sender = fbMsg.from.id === conn.pageId ? 'PAGE' : 'CLIENT';
          const attachment = fbMsg.attachments?.data[0];
          const stored = await this.prisma.message.create({
            data: {
              conversationId: conv.id,
              externalId: fbMsg.id,
              sender,
              content: fbMsg.message ?? null,
              imageUrl: attachment?.image_data?.url ?? null,
              fileUrl: attachment && !attachment.image_data?.url ? attachment.id : null,
              status: 'DELIVERED',
              createdAt: new Date(fbMsg.created_time),
            },
          });

          newMessages++;
          lastStoredMessage = this.toMessageDto(stored);

          // Emit SSE new_message event to the page owner
          const userProfile = await this.prisma.businessProfile.findUnique({
            where: { id: businessProfileId },
            select: { userId: true },
          });

          if (userProfile) {
            this.emitter.newMessage(userProfile.userId, {
              conversationId: conv.id,
              message: lastStoredMessage,
            });
          }
        }

        const latest = orderedMessages[orderedMessages.length - 1];
        await this.prisma.conversation.update({
          where: { id: conv.id },
          data: {
            lastMessage: this.messagePreview(latest),
            lastMessageAt: new Date(latest.created_time),
          },
        });
      }

      const refreshed = await this.prisma.conversation.findUnique({
        where: { id: conv.id },
        include: {
          _count: {
            select: {
              messages: {
                where: { status: { not: 'READ' }, sender: 'CLIENT' },
              },
            },
          },
        },
      });

      const profile = await this.prisma.businessProfile.findUnique({
        where: { id: businessProfileId },
        select: { userId: true },
      });

      if (refreshed && profile) {
        this.emitter.conversationUpdated(profile.userId, {
          conversation: this.toConversationDto(refreshed),
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
  }

  private messagePreview(message: FbMessage): string {
    if (message.message?.trim()) return message.message;
    const attachment = message.attachments?.data[0];
    if (!attachment) return '';
    if (attachment.image_data?.url) return '📷 Photo';
    return '📎 Pièce jointe';
  }

  private async getClientProfile(
    psid: string,
    pageAccessToken: string,
  ): Promise<{ name: string | null; profile_pic: string | null } | null> {
    try {
      const profile = await this.graphClient.getMessengerUserProfile(
        psid,
        pageAccessToken,
      );
      const fullName =
        profile.name ??
        [profile.first_name, profile.last_name].filter(Boolean).join(' ');

      return {
        name: fullName.trim() || null,
        profile_pic: profile.profile_pic ?? null,
      };
    } catch (error) {
      this.logger.debug(
        `Unable to fetch Messenger profile for ${psid}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private toMessageDto(msg: any): MessageResponseDto {
    return {
      id: msg.id,
      conversationId: msg.conversationId,
      sender: msg.sender,
      content: msg.content,
      imageUrl: msg.imageUrl,
      fileUrl: msg.fileUrl,
      referenceImageUrls: [],
      status: msg.status,
      externalId: msg.externalId,
      createdAt: msg.createdAt,
    };
  }

  private toConversationDto(conv: any): ConversationResponseDto {
    return {
      id: conv.id,
      businessProfileId: conv.businessProfileId,
      externalId: conv.externalId,
      clientPsid: conv.clientPsid,
      clientName: conv.clientName,
      clientAvatarUrl: conv.clientAvatarUrl,
      lastMessage: conv.lastMessage,
      lastMessageAt: conv.lastMessageAt,
      handoverStatus: conv.handoverStatus,
      unreadCount: conv._count?.messages ?? 0,
      updatedAt: conv.updatedAt,
    };
  }
}
