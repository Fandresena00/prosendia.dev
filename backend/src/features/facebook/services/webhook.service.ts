import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import {
  WebhookEventStatus,
  WebhookEventType,
} from '../../../generated/prisma/enums.js';
import { InboxEventEmitter } from '../../inbox/gateways/inbox-sse.gateway.js';
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
  ) {}

  async dispatchPayload(payload: FbWebhookPayload): Promise<void> {
    if (payload.object !== 'page') return;
    for (const entry of payload.entry) {
      void this.processEntry(entry).catch((err: Error) =>
        this.logger.error(
          `Error processing entry for page ${entry.id}: ${err.message}`,
          err.stack,
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
      this.logger.warn(`Token unusable for page ${entry.id} — skipping`);
      return;
    }

    for (const event of entry.messaging ?? []) {
      if (event.message && event.sender.id !== entry.id) {
        await this.handleMessage(conn.id, entry.id, event);
      }
    }

    for (const change of entry.changes ?? []) {
      if (change.field === 'feed') {
        await this.handleFeedChange(conn.id, entry.id, change.value);
      }
    }
  }

  private async handleMessage(
    connectionId: string,
    pageId: string,
    event: FbMessagingEntry,
  ): Promise<void> {
    const mid = event.message?.mid;
    if (!mid) return;

    const isDuplicate = await this.recordEvent(
      connectionId,
      mid,
      WebhookEventType.MESSAGE,
      event,
    );
    if (isDuplicate) return;

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

    const clientProfile = await this.getClientProfile(
      event.sender.id,
      pageId,
    );

    const existingConversation = await this.prisma.conversation.findFirst({
      where: {
        businessProfileId: conn.businessProfileId,
        OR: [{ externalId: event.sender.id }, { clientPsid: event.sender.id }],
      },
    });

    const conversation = existingConversation
      ? await this.prisma.conversation.update({
          where: { id: existingConversation.id },
          data: {
            clientPsid: event.sender.id,
            clientName:
              clientProfile?.name ?? existingConversation.clientName,
            clientAvatarUrl:
              clientProfile?.profile_pic ??
              existingConversation.clientAvatarUrl,
            lastMessage: event.message?.text ?? null,
            lastMessageAt: new Date(event.timestamp),
          },
        })
      : await this.prisma.conversation.create({
          data: {
            businessProfileId: conn.businessProfileId,
            externalId: event.sender.id,
            clientPsid: event.sender.id,
            clientName: clientProfile?.name ?? null,
            clientAvatarUrl: clientProfile?.profile_pic ?? null,
            lastMessage: event.message?.text ?? null,
            lastMessageAt: new Date(event.timestamp),
          },
        });

    const message = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        sender: 'CLIENT',
        content: event.message?.text ?? null,
        externalId: mid,
        status: 'DELIVERED',
      },
    });

    await this.markEventProcessed(
      connectionId,
      mid,
      WebhookEventType.MESSAGE,
      message.id,
    );

    this.emitter.newMessage(conn.businessProfile.userId, {
      conversationId: conversation.id,
      message: {
        id: message.id,
        conversationId: conversation.id,
        sender: message.sender,
        content: message.content,
        imageUrl: message.imageUrl,
        fileUrl: message.fileUrl,
        referenceImageUrls: [],
        status: message.status,
        externalId: message.externalId,
        createdAt: message.createdAt,
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

    const isDuplicate = await this.recordEvent(
      connectionId,
      commentId,
      WebhookEventType.FEED_COMMENT,
      value,
    );
    if (isDuplicate) return;

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

  private async getClientProfile(
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
