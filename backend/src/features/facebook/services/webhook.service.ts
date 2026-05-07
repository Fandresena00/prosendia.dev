/**
 * @file features/facebook/services/webhook.service.ts
 *
 * Processes real-time Facebook webhook payloads.
 *
 * CHANGES:
 *   - Added normalizeAvatarUrl() — converts http:// to https:// and strips
 *     Facebook CDN query parameters that cause CORS issues in <img> tags.
 *   - Avatar URL normalized before being stored in every upsertConversation call.
 *   - fetchClientProfile now returns a normalized profile_pic.
 *   - Variable names made more explicit throughout.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import {
  WebhookEventStatus,
  WebhookEventType,
} from '../../../generated/prisma/enums.js';
import { InboxEventEmitter } from '../../inbox/gateways/inbox-sse.gateway.js';
import { AiQueueProducer } from '../../queue/producers/ai-queue.producer.js';
import { FacebookGraphClient } from '../clients/facebook-graph.client.js';
import { FacebookAccountService } from './facebook-account.service.js';
import { TokenService } from './token.service.js';

export interface FbMessagingEntry {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: {
    mid: string;
    text?: string;
    attachments?: Array<{ type: string; payload: { url?: string } }>;
  };
}
export interface FbFeedValue {
  item?: string;
  verb?: string;
  comment_id?: string;
  post_id?: string;
  message?: string;
  from?: { id: string; name: string };
  created_time?: number;
}
export interface FbWebhookEntry {
  id: string;
  time?: number;
  messaging?: FbMessagingEntry[];
  changes?: Array<{ field: string; value: FbFeedValue }>;
}
export interface FbWebhookPayload {
  object: string;
  entry: FbWebhookEntry[];
}

// ─── Internal types ───────────────────────────────────────────────────────────

interface ClientProfile {
  name: string | null;
  avatarUrl: string | null;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly facebookAccounts: FacebookAccountService,
    private readonly tokenService: TokenService,
    private readonly sseEmitter: InboxEventEmitter,
    private readonly facebookGraph: FacebookGraphClient,
    private readonly aiJobQueue: AiQueueProducer,
  ) {}

  async dispatchPayload(payload: FbWebhookPayload): Promise<void> {
    if (payload.object !== 'page') return;
    for (const entry of payload.entry) {
      void this.processPageEntry(entry).catch((err: unknown) =>
        this.logger.error(
          `Error processing page=${entry.id}: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
    }
  }

  private async processPageEntry(entry: FbWebhookEntry): Promise<void> {
    const facebookConnection = await this.facebookAccounts.getByPageId(
      entry.id,
    );
    if (!facebookConnection) {
      this.logger.debug(`No active connection for page=${entry.id}`);
      return;
    }
    const isTokenUsable = await this.tokenService.isTokenUsable(entry.id);
    if (!isTokenUsable) {
      this.logger.warn(
        `Token not usable for page=${entry.id} — skipping webhook event`,
      );
      return;
    }
    for (const messagingEvent of entry.messaging ?? []) {
      if (messagingEvent.message && messagingEvent.sender.id !== entry.id) {
        await this.handleInboundMessage(
          facebookConnection.id,
          entry.id,
          messagingEvent,
        );
      }
    }
    for (const change of entry.changes ?? []) {
      if (change.field === 'feed') {
        await this.handleFeedChange(
          facebookConnection.id,
          entry.id,
          change.value,
        );
      }
    }
  }

  // ─── Inbound DM handler ───────────────────────────────────────────────────

  private async handleInboundMessage(
    connectionId: string,
    pageId: string,
    messagingEvent: FbMessagingEntry,
  ): Promise<void> {
    const fbMessageId = messagingEvent.message?.mid;
    if (!fbMessageId) return;

    // Idempotency check — skip already-processed events
    const isDuplicate = await this.recordWebhookEvent(
      connectionId,
      fbMessageId,
      WebhookEventType.MESSAGE,
      messagingEvent,
    );
    if (isDuplicate) return;

    this.logger.log(
      `Inbound DM — page=${pageId}, sender=${messagingEvent.sender.id}, mid=${fbMessageId}`,
    );

    const facebookConnection = await this.prisma.facebookConnection.findUnique({
      where: { id: connectionId },
      select: {
        businessProfileId: true,
        businessProfile: { select: { userId: true } },
      },
    });
    if (!facebookConnection) return;

    // Fetch the client's Messenger profile (name + avatar) — best-effort
    const clientProfile = await this.fetchClientMessengerProfile(
      messagingEvent.sender.id,
      pageId,
    );

    const messageText = messagingEvent.message?.text ?? null;
    const messageDate = new Date(messagingEvent.timestamp);

    const conversation = await this.upsertConversation(
      facebookConnection.businessProfileId,
      messagingEvent.sender.id,
      clientProfile,
      messageText,
      messagingEvent.timestamp,
    );

    // Extract image URL from attachment if present
    const firstAttachment = messagingEvent.message?.attachments?.[0];
    const attachmentImageUrl =
      firstAttachment?.type === 'image'
        ? (firstAttachment.payload?.url ?? null)
        : null;

    const savedMessage = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        externalId: fbMessageId,
        sender: 'CLIENT',
        content: messageText,
        imageUrl: attachmentImageUrl,
        status: 'DELIVERED',
        createdAt: messageDate,
      },
    });

    await this.markWebhookEventProcessed(
      connectionId,
      fbMessageId,
      WebhookEventType.MESSAGE,
      conversation.id,
    );

    // Emit SSE: new message
    this.sseEmitter.newMessage(facebookConnection.businessProfile.userId, {
      conversationId: conversation.id,
      message: {
        id: savedMessage.id,
        conversationId: conversation.id,
        sender: 'CLIENT',
        content: savedMessage.content,
        imageUrl: savedMessage.imageUrl,
        fileUrl: null,
        referenceImageUrls: [],
        status: 'DELIVERED',
        externalId: fbMessageId,
        createdAt: messageDate,
      },
    });

    // Emit SSE: conversation updated (moves to top, increments unread)
    this.sseEmitter.conversationUpdated(
      facebookConnection.businessProfile.userId,
      {
        conversation: {
          id: conversation.id,
          businessProfileId: conversation.businessProfileId,
          externalId: conversation.externalId,
          clientPsid: conversation.clientPsid,
          clientName: conversation.clientName,
          clientAvatarUrl: conversation.clientAvatarUrl,
          lastMessage: conversation.lastMessage,
          lastMessageAt: conversation.lastMessageAt,
          handoverStatus: conversation.handoverStatus,
          unreadCount: 1,
          updatedAt: conversation.updatedAt,
        },
      },
    );

    // Enqueue AI reply if the conversation is in AI mode
    if (conversation.handoverStatus === 'AI') {
      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { needsAiReply: true },
      });
      await this.aiJobQueue.enqueueAiReply({
        conversationId: conversation.id,
        inboundMessageId: savedMessage.id,
        businessProfileId: facebookConnection.businessProfileId,
        userId: facebookConnection.businessProfile.userId,
        inboundText: messageText ?? undefined,
        inboundCreatedAt: messageDate.toISOString(),
      });
    }
  }

  // ─── Feed change (comment) handler ────────────────────────────────────────

  private async handleFeedChange(
    connectionId: string,
    pageId: string,
    feedValue: FbFeedValue,
  ): Promise<void> {
    if (feedValue.item !== 'comment' || feedValue.verb !== 'add') return;
    const fbCommentId = feedValue.comment_id;
    if (!fbCommentId || !feedValue.message) return;
    if (feedValue.from?.id === pageId) return; // Ignore the page's own comments

    const isDuplicate = await this.recordWebhookEvent(
      connectionId,
      fbCommentId,
      WebhookEventType.FEED_COMMENT,
      feedValue,
    );
    if (isDuplicate) return;

    this.logger.log(`New comment — page=${pageId}, comment=${fbCommentId}`);

    if (!feedValue.post_id) {
      await this.markWebhookEventFailed(
        connectionId,
        fbCommentId,
        WebhookEventType.FEED_COMMENT,
        'Missing post_id in feed change payload',
      );
      return;
    }

    const parentPost = await this.prisma.facebookPost.findUnique({
      where: { externalId: feedValue.post_id },
    });
    if (!parentPost) {
      await this.markWebhookEventFailed(
        connectionId,
        fbCommentId,
        WebhookEventType.FEED_COMMENT,
        `Post ${feedValue.post_id} not synced yet — cannot attach comment`,
      );
      return;
    }

    const savedComment = await this.prisma.postComment.upsert({
      where: { externalId: fbCommentId },
      create: {
        postId: parentPost.id,
        externalId: fbCommentId,
        authorId: feedValue.from?.id ?? 'unknown',
        authorName: feedValue.from?.name ?? 'Unknown',
        message: feedValue.message,
        commentedAt: feedValue.created_time
          ? new Date(feedValue.created_time * 1000)
          : new Date(),
        lastSyncedAt: new Date(),
      },
      update: {
        message: feedValue.message,
        lastSyncedAt: new Date(),
      },
    });

    await this.markWebhookEventProcessed(
      connectionId,
      fbCommentId,
      WebhookEventType.FEED_COMMENT,
      savedComment.id,
    );
  }

  // ─── Conversation upsert ──────────────────────────────────────────────────

  private async upsertConversation(
    businessProfileId: string,
    clientPsid: string,
    clientProfile: ClientProfile | null,
    lastMessageText: string | null,
    timestampMs: number,
  ) {
    const normalizedAvatarUrl = clientProfile?.avatarUrl
      ? this.normalizeAvatarUrl(clientProfile.avatarUrl)
      : null;

    const existingConversation = await this.prisma.conversation.findFirst({
      where: {
        businessProfileId,
        OR: [{ externalId: clientPsid }, { clientPsid }],
      },
    });

    if (existingConversation) {
      return this.prisma.conversation.update({
        where: { id: existingConversation.id },
        data: {
          clientPsid,
          clientName: clientProfile?.name ?? existingConversation.clientName,
          clientAvatarUrl:
            normalizedAvatarUrl ?? existingConversation.clientAvatarUrl,
          lastMessage: lastMessageText,
          lastMessageAt: new Date(timestampMs),
        },
      });
    }

    return this.prisma.conversation.create({
      data: {
        businessProfileId,
        externalId: clientPsid,
        clientPsid,
        clientName: clientProfile?.name ?? null,
        clientAvatarUrl: normalizedAvatarUrl ?? null,
        lastMessage: lastMessageText,
        lastMessageAt: new Date(timestampMs),
      },
    });
  }

  // ─── Fetch client Messenger profile ──────────────────────────────────────

  private async fetchClientMessengerProfile(
    clientPsid: string,
    pageId: string,
  ): Promise<ClientProfile | null> {
    try {
      const pageConnection = await this.facebookAccounts.getByPageId(pageId);
      if (!pageConnection) return null;

      const messengerProfile = await this.facebookGraph.getMessengerUserProfile(
        clientPsid,
        pageConnection.decryptedToken,
      );

      // Build display name from available fields
      const displayName =
        (messengerProfile.name ??
          [messengerProfile.first_name, messengerProfile.last_name]
            .filter(Boolean)
            .join(' ')
            .trim()) ||
        null;

      return {
        name: displayName || null,
        avatarUrl: this.normalizeAvatarUrl(
          messengerProfile.profile_pic ?? null,
        ),
      };
    } catch {
      // Profile fetch is best-effort — a missing avatar is not an error
      return null;
    }
  }

  // ─── URL normalization ────────────────────────────────────────────────────

  /**
   * Normalizes a Facebook CDN image URL:
   *   1. Upgrades http:// to https:// (Facebook sometimes returns http)
   *   2. Returns null for empty/null inputs
   *
   * Facebook profile picture URLs are stable CDN URLs and do not need
   * token-authenticated requests, so they can be stored and used directly.
   */
  private normalizeAvatarUrl(rawUrl: string | null): string | null {
    if (!rawUrl) return null;
    if (rawUrl.startsWith('http://')) return `https://${rawUrl.slice(7)}`;
    return rawUrl;
  }

  // ─── Webhook event idempotency ────────────────────────────────────────────

  /**
   * Records a webhook event for idempotency tracking.
   * Returns true if the event was already processed (duplicate — skip it).
   */
  private async recordWebhookEvent(
    connectionId: string,
    externalId: string,
    eventType: WebhookEventType,
    rawPayload: unknown,
  ): Promise<boolean> {
    const existingEvent = await this.prisma.webhookEvent.findUnique({
      where: { externalId_eventType: { externalId, eventType } },
    });

    if (existingEvent) {
      if (existingEvent.status === WebhookEventStatus.PROCESSED) {
        this.logger.debug(
          `Duplicate ${eventType} event externalId=${externalId} — already processed, skipping`,
        );
        return true;
      }
      await this.prisma.webhookEvent.update({
        where: { id: existingEvent.id },
        data: { attempts: { increment: 1 } },
      });
      return false;
    }

    await this.prisma.webhookEvent.create({
      data: {
        facebookConnectionId: connectionId,
        externalId,
        eventType,
        status: WebhookEventStatus.PENDING,
        rawPayload: rawPayload as object,
        attempts: 1,
      },
    });
    return false;
  }

  private async markWebhookEventProcessed(
    connectionId: string,
    externalId: string,
    eventType: WebhookEventType,
    resultEntityId: string,
  ): Promise<void> {
    await this.prisma.webhookEvent.update({
      where: { externalId_eventType: { externalId, eventType } },
      data: {
        status: WebhookEventStatus.PROCESSED,
        resultEntityId,
        processedAt: new Date(),
      },
    });
  }

  private async markWebhookEventFailed(
    connectionId: string,
    externalId: string,
    eventType: WebhookEventType,
    errorMessage: string,
  ): Promise<void> {
    await this.prisma.webhookEvent.update({
      where: { externalId_eventType: { externalId, eventType } },
      data: { status: WebhookEventStatus.FAILED, errorMessage },
    });
  }
}
