/**
 * @file features/facebook/services/webhook.service.ts
 *
 * Processes real-time Facebook webhook payloads.
 * On inbound CLIENT message in AI mode:
 *   1. Sets conversation.needsAiReply = true
 *   2. Enqueues ai.reply job via AiQueueProducer (crash-safe, deduplicated)
 *   3. Emits SSE events to connected inbox clients
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

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: FacebookAccountService,
    private readonly tokenService: TokenService,
    private readonly emitter: InboxEventEmitter,
    private readonly graphClient: FacebookGraphClient,
    private readonly aiQueue: AiQueueProducer,
  ) {}

  async dispatchPayload(payload: FbWebhookPayload): Promise<void> {
    if (payload.object !== 'page') return;
    for (const entry of payload.entry) {
      void this.processEntry(entry).catch((err: unknown) =>
        this.logger.error(
          `Error processing page ${entry.id}: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
    }
  }

  private async processEntry(entry: FbWebhookEntry): Promise<void> {
    const conn = await this.accounts.getByPageId(entry.id);
    if (!conn) {
      this.logger.debug(`No active connection for page ${entry.id}`);
      return;
    }
    const tokenUsable = await this.tokenService.isTokenUsable(entry.id);
    if (!tokenUsable) {
      this.logger.warn(`Token unusable for page ${entry.id}`);
      return;
    }
    for (const event of entry.messaging ?? []) {
      if (event.message && event.sender.id !== entry.id)
        await this.handleMessage(conn.id, entry.id, event);
    }
    for (const change of entry.changes ?? []) {
      if (change.field === 'feed')
        await this.handleFeedChange(conn.id, entry.id, change.value);
    }
  }

  private async handleMessage(
    connectionId: string,
    pageId: string,
    event: FbMessagingEntry,
  ): Promise<void> {
    const mid = event.message?.mid;
    if (!mid) return;
    if (
      await this.recordEvent(connectionId, mid, WebhookEventType.MESSAGE, event)
    )
      return;

    this.logger.log(
      `DM — page: ${pageId}, sender: ${event.sender.id}, mid: ${mid}`,
    );

    const conn = await this.prisma.facebookConnection.findUnique({
      where: { id: connectionId },
      select: {
        businessProfileId: true,
        businessProfile: { select: { userId: true } },
      },
    });
    if (!conn) return;

    const clientProfile = await this.fetchClientProfile(
      event.sender.id,
      pageId,
    );
    const conversation = await this.upsertConversation(
      conn.businessProfileId,
      event.sender.id,
      clientProfile,
      event.message?.text ?? null,
      event.timestamp,
    );

    const createdAt = new Date(event.timestamp);

    // Create the message in DB
    const attachment = event.message?.attachments?.[0];
    const imageUrl =
      attachment?.type === 'image' ? attachment.payload?.url : null;
    const message = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        externalId: mid,
        sender: 'CLIENT',
        content: event.message?.text ?? null,
        imageUrl,
        status: 'DELIVERED',
        createdAt,
      },
    });

    await this.markEventProcessed(
      connectionId,
      mid,
      WebhookEventType.MESSAGE,
      conversation.id,
    );

    this.emitter.newMessage(conn.businessProfile.userId, {
      conversationId: conversation.id,
      message: {
        id: message.id,
        conversationId: conversation.id,
        sender: 'CLIENT',
        content: message.content,
        imageUrl: message.imageUrl,
        fileUrl: null,
        referenceImageUrls: [],
        status: 'DELIVERED',
        externalId: mid,
        createdAt,
      },
    });
    this.emitter.conversationUpdated(conn.businessProfile.userId, {
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
    });

    if (conversation.handoverStatus === 'AI') {
      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { needsAiReply: true },
      });
      await this.aiQueue.enqueueAiReply({
        conversationId: conversation.id,
        inboundMessageId: mid,
        businessProfileId: conn.businessProfileId,
        userId: conn.businessProfile.userId,
        inboundText: event.message?.text ?? undefined,
        inboundCreatedAt: createdAt.toISOString(),
      });
    }
  }

  private async handleFeedChange(
    connectionId: string,
    pageId: string,
    value: FbFeedValue,
  ): Promise<void> {
    if (value.item !== 'comment' || value.verb !== 'add') return;
    const commentId = value.comment_id;
    if (!commentId || !value.message) return;
    if (value.from?.id === pageId) return;
    if (
      await this.recordEvent(
        connectionId,
        commentId,
        WebhookEventType.FEED_COMMENT,
        value,
      )
    )
      return;
    this.logger.log(`Comment — page: ${pageId}, comment: ${commentId}`);
    if (!value.post_id) {
      await this.markEventFailed(
        connectionId,
        commentId,
        WebhookEventType.FEED_COMMENT,
        'Missing post_id',
      );
      return;
    }
    const post = await this.prisma.facebookPost.findUnique({
      where: { externalId: value.post_id },
    });
    if (!post) {
      await this.markEventFailed(
        connectionId,
        commentId,
        WebhookEventType.FEED_COMMENT,
        `Post ${value.post_id} not synced`,
      );
      return;
    }
    const comment = await this.prisma.postComment.upsert({
      where: { externalId: commentId },
      create: {
        postId: post.id,
        externalId: commentId,
        authorId: value.from?.id ?? 'unknown',
        authorName: value.from?.name ?? 'Unknown',
        message: value.message,
        commentedAt: value.created_time
          ? new Date(value.created_time * 1000)
          : new Date(),
        lastSyncedAt: new Date(),
      },
      update: { message: value.message, lastSyncedAt: new Date() },
    });
    await this.markEventProcessed(
      connectionId,
      commentId,
      WebhookEventType.FEED_COMMENT,
      comment.id,
    );
  }

  private async upsertConversation(
    businessProfileId: string,
    clientPsid: string,
    clientProfile: { name: string | null; profile_pic: string | null } | null,
    lastMessage: string | null,
    timestamp: number,
  ) {
    const existing = await this.prisma.conversation.findFirst({
      where: {
        businessProfileId,
        OR: [{ externalId: clientPsid }, { clientPsid }],
      },
    });
    if (existing) {
      return this.prisma.conversation.update({
        where: { id: existing.id },
        data: {
          clientPsid,
          clientName: clientProfile?.name ?? existing.clientName,
          clientAvatarUrl:
            clientProfile?.profile_pic ?? existing.clientAvatarUrl,
          lastMessage,
          lastMessageAt: new Date(timestamp),
        },
      });
    }
    return this.prisma.conversation.create({
      data: {
        businessProfileId,
        externalId: clientPsid,
        clientPsid,
        clientName: clientProfile?.name ?? null,
        clientAvatarUrl: clientProfile?.profile_pic ?? null,
        lastMessage,
        lastMessageAt: new Date(timestamp),
      },
    });
  }

  private async fetchClientProfile(
    psid: string,
    pageId: string,
  ): Promise<{ name: string | null; profile_pic: string | null } | null> {
    try {
      const account = await this.accounts.getByPageId(pageId);
      if (!account) return null;
      const profile = await this.graphClient.getMessengerUserProfile(
        psid,
        account.decryptedToken,
      );
      const name =
        profile.name ??
        [profile.first_name, profile.last_name].filter(Boolean).join(' ');
      return {
        name: name.trim() || null,
        profile_pic: profile.profile_pic ?? null,
      };
    } catch {
      return null;
    }
  }

  private async recordEvent(
    connectionId: string,
    externalId: string,
    eventType: WebhookEventType,
    rawPayload: unknown,
  ): Promise<boolean> {
    const existing = await this.prisma.webhookEvent.findUnique({
      where: { externalId_eventType: { externalId, eventType } },
    });
    if (existing) {
      if (existing.status === WebhookEventStatus.PROCESSED) {
        this.logger.debug(`Duplicate ${eventType} ${externalId} — skipped`);
        return true;
      }
      await this.prisma.webhookEvent.update({
        where: { id: existing.id },
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

  private async markEventProcessed(
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

  private async markEventFailed(
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
