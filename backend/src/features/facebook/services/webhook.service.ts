/**
 * @file features/facebook/services/webhook.service.ts
 *
 * CRITICAL PERFORMANCE FIX
 * ────────────────────────
 * Previous hot path (per inbound message):
 *   isTokenUsable()           → maybe live Facebook API call  (+1–5s)
 *   fetchClientMessengerProfile() → live Facebook API call    (+0.5–2s)
 *   DB writes + SSE emit
 *
 * New hot path (per inbound message):
 *   isTokenUsableForWebhook() → DB read only                  (~1–5ms)
 *   DB writes + SSE emit
 *   refreshAvatarInBackground() → deferred, non-blocking      (0ms impact)
 *
 * Avatar fetch is now a background fire-and-forget operation. The message
 * appears instantly in the UI; the avatar shows up seconds later via SSE.
 *
 * SSE is emitted BEFORE the background operations complete, so the frontend
 * gets the message as fast as possible.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import {
  WebhookEventStatus,
  WebhookEventType,
} from '../../../generated/prisma/enums.js';
import { MediaDownloadService } from '../../inbox/services/media-download.service.js';
import { InboxEventEmitter } from '../../inbox/gateways/inbox-sse.gateway.js';
import { AiQueueProducer } from '../../queue/producers/ai-queue.producer.js';
import { FacebookGraphClient } from '../clients/facebook-graph.client.js';
import { FacebookAccountService } from './facebook-account.service.js';
import { TokenService } from './token.service.js';

// ─── Payload types ─────────────────────────────────────────────────────────────

export interface FbAttachment {
  type: string;
  payload: { url?: string; sticker_id?: number; title?: string };
  title?: string;
}

export interface FbMessagingEntry {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: {
    mid: string;
    text?: string;
    attachments?: FbAttachment[];
    is_echo?: boolean;
  };
  read?: { watermark: number };
  delivery?: { watermark: number; mids: string[] };
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

// ─── Service ───────────────────────────────────────────────────────────────────

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
    private readonly mediaDownload: MediaDownloadService,
  ) {}

  // ─── Entry point ──────────────────────────────────────────────────────────

  async dispatchPayload(payload: FbWebhookPayload): Promise<void> {
    if (payload.object !== 'page') return;
    for (const entry of payload.entry) {
      void this.processPageEntry(entry).catch((err: unknown) =>
        this.logger.error(
          `Error processing page=${entry.id}: ` +
            `${err instanceof Error ? err.message : String(err)}`,
        ),
      );
    }
  }

  private async processPageEntry(entry: FbWebhookEntry): Promise<void> {
    const connection = await this.facebookAccounts.getByPageId(entry.id);
    if (!connection) {
      this.logger.debug(`No active connection for page=${entry.id}`);
      return;
    }

    // CRITICAL FIX: use webhook-safe check (DB only, no live API call)
    const isUsable = await this.tokenService.isTokenUsableForWebhook(entry.id);
    if (!isUsable) {
      this.logger.warn(
        `Token marked INVALID in DB for page=${entry.id} — skipping webhook`,
      );
      return;
    }

    for (const messagingEvent of entry.messaging ?? []) {
      if (messagingEvent.message?.is_echo) continue;
      if (messagingEvent.read || messagingEvent.delivery) continue;
      if (messagingEvent.message && messagingEvent.sender.id !== entry.id) {
        await this.handleInboundMessage(
          connection.id,
          entry.id,
          messagingEvent,
        );
      }
    }

    for (const change of entry.changes ?? []) {
      if (change.field === 'feed') {
        await this.handleFeedChange(connection.id, entry.id, change.value);
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

    const isDuplicate = await this.recordWebhookEvent(
      connectionId,
      fbMessageId,
      WebhookEventType.MESSAGE,
      messagingEvent,
    );
    if (isDuplicate) return;

    this.logger.log(
      `Inbound DM — page=${pageId} sender=${messagingEvent.sender.id} mid=${fbMessageId}`,
    );

    const connection = await this.prisma.facebookConnection.findUnique({
      where: { id: connectionId },
      select: {
        businessProfileId: true,
        businessProfile: { select: { userId: true } },
      },
    });
    if (!connection) return;

    const messageText = messagingEvent.message?.text ?? null;
    const messageDate = new Date(messagingEvent.timestamp);

    // ── STEP 1: Upsert conversation WITHOUT avatar (no API call needed now) ──
    // We use the cached avatar from DB if it exists, otherwise null.
    // The avatar will be refreshed in the background below.
    const conversation = await this.upsertConversationWithCachedAvatar(
      connection.businessProfileId,
      messagingEvent.sender.id,
      messageText,
      messagingEvent.timestamp,
    );

    // ── STEP 2: Process attachments ───────────────────────────────────────────
    const attachments = messagingEvent.message?.attachments ?? [];
    const savedMessageIds: string[] = [];

    for (const attachment of attachments) {
      if (!attachment.payload?.url) continue;
      const processed = await this.processAttachment(attachment);
      const savedMsg = await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          externalId: attachments.length === 1 ? fbMessageId : null,
          sender: 'CLIENT',
          content: processed.fileName ?? null,
          imageUrl: processed.imageUrl ?? null,
          fileUrl: processed.fileUrl ?? null,
          status: 'DELIVERED',
          createdAt: messageDate,
        },
      });
      savedMessageIds.push(savedMsg.id);

      // Emit SSE immediately — no waiting for background jobs
      this.emitNewMessage(
        connection.businessProfile.userId,
        conversation.id,
        savedMsg,
        messageDate,
      );
    }

    // ── STEP 3: Save text content ─────────────────────────────────────────────
    let textMessageId: string | null = null;
    if (messageText?.trim()) {
      const savedTextMsg = await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          externalId: attachments.length === 0 ? fbMessageId : null,
          sender: 'CLIENT',
          content: messageText,
          status: 'DELIVERED',
          createdAt: messageDate,
        },
      });
      textMessageId = savedTextMsg.id;
      savedMessageIds.push(savedTextMsg.id);

      // Emit SSE immediately
      this.emitNewMessage(
        connection.businessProfile.userId,
        conversation.id,
        savedTextMsg,
        messageDate,
      );
    }

    if (savedMessageIds.length === 0) {
      await this.markWebhookEventProcessed(
        connectionId,
        fbMessageId,
        WebhookEventType.MESSAGE,
        conversation.id,
      );
      return;
    }

    // ── STEP 4: Update conversation last message + emit conversation_updated ──
    const lastMessageText =
      messageText ?? this.describeAttachment(attachments[0]);
    const updatedConversation = await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessage: lastMessageText, lastMessageAt: messageDate },
    });

    this.sseEmitter.conversationUpdated(connection.businessProfile.userId, {
      conversation: {
        id: updatedConversation.id,
        businessProfileId: updatedConversation.businessProfileId,
        externalId: updatedConversation.externalId,
        clientPsid: updatedConversation.clientPsid,
        clientName: updatedConversation.clientName,
        clientAvatarUrl: updatedConversation.clientAvatarUrl,
        lastMessage: lastMessageText,
        lastMessageAt: messageDate,
        handoverStatus: updatedConversation.handoverStatus,
        unreadCount: 1,
        updatedAt: new Date(),
      },
    });

    await this.markWebhookEventProcessed(
      connectionId,
      fbMessageId,
      WebhookEventType.MESSAGE,
      conversation.id,
    );

    // ── STEP 5: Background avatar refresh (deferred, non-blocking) ───────────
    // Only refresh if avatar is missing — avoids unnecessary API calls
    if (!conversation.clientAvatarUrl) {
      void this.refreshAvatarInBackground(
        messagingEvent.sender.id,
        pageId,
        conversation.id,
        connection.businessProfile.userId,
      ).catch(() => undefined);
    }

    // ── STEP 6: Enqueue AI reply if conversation is in AI mode ───────────────
    const primaryMessageId = textMessageId ?? savedMessageIds[0];
    if (conversation.handoverStatus === 'AI' && messageText?.trim()) {
      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { needsAiReply: true },
      });
      await this.aiJobQueue.enqueueAiReply({
        conversationId: conversation.id,
        inboundMessageId: primaryMessageId!,
        businessProfileId: connection.businessProfileId,
        userId: connection.businessProfile.userId,
        inboundText: messageText ?? undefined,
        inboundCreatedAt: messageDate.toISOString(),
      });
    }
  }

  // ─── Background avatar refresh ─────────────────────────────────────────────
  //
  // Runs AFTER SSE is already emitted. The UI shows the message immediately.
  // The avatar appears a few seconds later when this completes.

  private async refreshAvatarInBackground(
    clientPsid: string,
    pageId: string,
    conversationId: string,
    userId: string,
  ): Promise<void> {
    const pageConnection = await this.facebookAccounts.getByPageId(pageId);
    if (!pageConnection) return;

    try {
      const profile = await this.facebookGraph.getMessengerUserProfile(
        clientPsid,
        pageConnection.decryptedToken,
      );

      const displayName =
        (profile.name ??
          [profile.first_name, profile.last_name]
            .filter(Boolean)
            .join(' ')
            .trim()) ||
        null;

      const normalizedAvatar = this.normalizeUrl(profile.profile_pic ?? null);
      if (!normalizedAvatar && !displayName) return; // Nothing useful to update

      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: {
          clientName: displayName ?? undefined,
          clientAvatarUrl: normalizedAvatar ?? undefined,
        },
      });

      this.logger.debug(
        `Avatar refreshed in background for conversation=${conversationId}`,
      );

      // Emit SSE so the avatar appears in the UI without a refresh
      const updatedConv = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
      });
      if (!updatedConv) return;

      this.sseEmitter.conversationUpdated(userId, {
        conversation: {
          id: updatedConv.id,
          businessProfileId: updatedConv.businessProfileId,
          externalId: updatedConv.externalId,
          clientPsid: updatedConv.clientPsid,
          clientName: updatedConv.clientName,
          clientAvatarUrl: updatedConv.clientAvatarUrl,
          lastMessage: updatedConv.lastMessage,
          lastMessageAt: updatedConv.lastMessageAt,
          handoverStatus: updatedConv.handoverStatus,
          unreadCount: 0,
          updatedAt: new Date(),
        },
      });
    } catch {
      // Avatar refresh failure is non-fatal — ignore silently
    }
  }

  // ─── Conversation upsert (no API calls) ───────────────────────────────────

  /**
   * Upserts a conversation using only data already in the DB.
   * Does NOT call the Facebook API — that happens in the background.
   */
  private async upsertConversationWithCachedAvatar(
    businessProfileId: string,
    clientPsid: string,
    lastMessageText: string | null,
    timestampMs: number,
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
          lastMessage: lastMessageText,
          lastMessageAt: new Date(timestampMs),
          // Keep existing name/avatar — background refresh will update if needed
        },
      });
    }

    return this.prisma.conversation.create({
      data: {
        businessProfileId,
        externalId: clientPsid,
        clientPsid,
        clientName: null, // Will be filled by background refresh
        clientAvatarUrl: null,
        lastMessage: lastMessageText,
        lastMessageAt: new Date(timestampMs),
      },
    });
  }

  // ─── Attachment processing ────────────────────────────────────────────────

  private async processAttachment(attachment: FbAttachment): Promise<{
    imageUrl?: string | null;
    fileUrl?: string | null;
    fileName?: string | null;
  }> {
    const fbUrl = attachment.payload?.url;
    if (!fbUrl) return {};

    const type = attachment.type.toLowerCase();
    const downloaded = await this.mediaDownload.downloadAndStore(fbUrl, type);
    const storedUrl = downloaded?.publicUrl ?? fbUrl;

    if (type === 'image' || type === 'sticker') return { imageUrl: storedUrl };
    if (type === 'video' || type === 'audio') return { fileUrl: storedUrl };
    return { fileUrl: storedUrl, fileName: attachment.title ?? null };
  }

  private describeAttachment(attachment?: FbAttachment): string {
    if (!attachment) return '';
    switch (attachment.type.toLowerCase()) {
      case 'image':
        return '📷 Photo';
      case 'video':
        return '🎥 Vidéo';
      case 'audio':
        return '🎤 Message vocal';
      case 'sticker':
        return '😊 Sticker';
      case 'file':
        return `📄 ${attachment.title ?? 'Fichier'}`;
      default:
        return '📎 Pièce jointe';
    }
  }

  // ─── Feed comment handler ─────────────────────────────────────────────────

  private async handleFeedChange(
    connectionId: string,
    pageId: string,
    feedValue: FbFeedValue,
  ): Promise<void> {
    if (feedValue.item !== 'comment' || feedValue.verb !== 'add') return;
    const fbCommentId = feedValue.comment_id;
    if (!fbCommentId || !feedValue.message) return;
    if (feedValue.from?.id === pageId) return;

    const isDuplicate = await this.recordWebhookEvent(
      connectionId,
      fbCommentId,
      WebhookEventType.FEED_COMMENT,
      feedValue,
    );
    if (isDuplicate) return;

    if (!feedValue.post_id) {
      await this.markWebhookEventFailed(
        connectionId,
        fbCommentId,
        WebhookEventType.FEED_COMMENT,
        'Missing post_id',
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
        `Post ${feedValue.post_id} not synced`,
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
      update: { message: feedValue.message, lastSyncedAt: new Date() },
    });

    await this.markWebhookEventProcessed(
      connectionId,
      fbCommentId,
      WebhookEventType.FEED_COMMENT,
      savedComment.id,
    );
  }

  // ─── SSE emitter helper ───────────────────────────────────────────────────

  private emitNewMessage(
    userId: string,
    conversationId: string,
    savedMessage: {
      id: string;
      content: string | null;
      imageUrl: string | null;
      fileUrl: string | null;
      status: string;
      externalId: string | null;
      createdAt: Date;
    },
    createdAt: Date,
  ): void {
    this.sseEmitter.newMessage(userId, {
      conversationId,
      message: {
        id: savedMessage.id,
        conversationId,
        sender: 'CLIENT',
        content: savedMessage.content,
        imageUrl: savedMessage.imageUrl,
        fileUrl: savedMessage.fileUrl,
        referenceImageUrls: [],
        status: savedMessage.status,
        externalId: savedMessage.externalId,
        createdAt,
      },
    });
  }

  // ─── URL normalization ────────────────────────────────────────────────────

  private normalizeUrl(rawUrl: string | null): string | null {
    if (!rawUrl) return null;
    if (rawUrl.startsWith('http://')) return `https://${rawUrl.slice(7)}`;
    return rawUrl;
  }

  // ─── Webhook event idempotency ────────────────────────────────────────────

  private async recordWebhookEvent(
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
        this.logger.debug(
          `Duplicate ${eventType} externalId=${externalId} — skipped`,
        );
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
