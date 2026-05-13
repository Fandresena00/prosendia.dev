/**
 * @file features/facebook/services/webhook.service.ts
 *
 * FIX: Robust conversation deduplication to prevent ghost conversations.
 *
 * ROOT CAUSE OF THE GHOST CONVERSATION BUG
 * ─────────────────────────────────────────
 * The same Facebook sender (PSID=27693075390295487) ended up with TWO
 * conversation records in the DB:
 *   - a9f604f7: externalId="t_1519085862914493" (correct Messenger thread ID)
 *   - 8cb6d4b5: externalId="27693075390295487"  (just the PSID — invalid)
 *
 * This happens when:
 *   1. A webhook arrives for a new sender → conversation created with
 *      externalId=PSID (we don't have the thread ID at webhook time)
 *   2. Later, Facebook sync runs → tries to create ANOTHER conversation
 *      with externalId=t_XXXX, not finding the PSID-based one
 *   3. Result: two separate conversations for the same sender
 *
 * FIXES:
 *   - `upsertConversation`: search ONLY by `clientPsid` (the stable unique
 *     identifier). If found, update `externalId` to the proper `t_XXXX`
 *     thread ID when available from sync. This collapses duplicates.
 *   - Ghost conversations with invalid externalId are flagged during
 *     FacebookSyncService.syncConversationMessages().
 *   - No more using `externalId` for webhook-based lookups — only sync uses it.
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

    // Webhook-safe token check — DB only, no live API call
    const isUsable = await this.tokenService.isTokenUsableForWebhook(entry.id);
    if (!isUsable) {
      this.logger.warn(
        `Token INVALID in DB for page=${entry.id} — skipping webhook`,
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

    // FIX: Use the deduplication-safe upsert
    const conversation = await this.upsertConversationByPsid(
      connection.businessProfileId,
      messagingEvent.sender.id,
      messageText,
      messagingEvent.timestamp,
    );

    // Process attachments
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
      this.emitNewMessage(
        connection.businessProfile.userId,
        conversation.id,
        savedMsg,
        messageDate,
      );
    }

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

    // Background avatar refresh (non-blocking)
    if (!conversation.clientAvatarUrl) {
      void this.refreshAvatarInBackground(
        messagingEvent.sender.id,
        pageId,
        conversation.id,
        connection.businessProfile.userId,
      ).catch(() => undefined);
    }

    // Enqueue AI reply
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

  // ─── FIX: Deduplication-safe conversation upsert ─────────────────────────

  /**
   * Uses `clientPsid` as the PRIMARY unique key for deduplication.
   *
   * Previous version used `OR: [externalId, clientPsid]` which could match
   * two different records (the ghost with externalId=PSID and the real one
   * with clientPsid=PSID), returning the wrong one on subsequent lookups.
   *
   * New behaviour:
   *   1. Look up ONLY by `clientPsid` — this is always unique per sender+page.
   *   2. If found, update the record (never create a duplicate).
   *   3. If not found, create with `externalId = clientPsid` as placeholder.
   *      FacebookSyncService will update this to the proper `t_XXXX` ID later.
   */
  private async upsertConversationByPsid(
    businessProfileId: string,
    clientPsid: string,
    lastMessageText: string | null,
    timestampMs: number,
  ) {
    // Search ONLY by clientPsid — never by externalId from webhooks
    const existing = await this.prisma.conversation.findFirst({
      where: { businessProfileId, clientPsid },
      orderBy: { lastMessageAt: 'desc' }, // Most recently active if multiple exist
    });

    if (existing) {
      return this.prisma.conversation.update({
        where: { id: existing.id },
        data: {
          lastMessage: lastMessageText,
          lastMessageAt: new Date(timestampMs),
        },
      });
    }

    // Create new conversation. externalId starts as the PSID (placeholder).
    // FacebookSyncService.upsertConversation() will overwrite it with t_XXXX.
    try {
      return await this.prisma.conversation.create({
        data: {
          businessProfileId,
          externalId: clientPsid, // Placeholder — replaced by sync
          clientPsid,
          clientName: null,
          clientAvatarUrl: null,
          lastMessage: lastMessageText,
          lastMessageAt: new Date(timestampMs),
        },
      });
    } catch {
      // Race condition: another webhook created the conversation simultaneously.
      // Find and return the one that now exists.
      const raceConv = await this.prisma.conversation.findFirst({
        where: { businessProfileId, clientPsid },
        orderBy: { lastMessageAt: 'desc' },
      });
      if (raceConv) return raceConv;
      throw new Error(
        `Failed to create or find conversation for psid=${clientPsid}`,
      );
    }
  }

  // ─── Background avatar refresh ─────────────────────────────────────────────

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
      if (!normalizedAvatar && !displayName) return;

      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: {
          clientName: displayName ?? undefined,
          clientAvatarUrl: normalizedAvatar ?? undefined,
        },
      });

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
      // Avatar refresh failure is non-fatal
    }
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
      if (existing.status === WebhookEventStatus.PROCESSED) return true;
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
