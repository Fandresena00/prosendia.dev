/**
 * FacebookMessagingService — outbound interactions (DMs, comment replies).
 *
 * Separated from FacebookSyncService (which is inbound/read-only) to keep
 * each service's responsibility clear:
 *  - SyncService  → pulls data from Facebook into our DB
 *  - MessagingService → sends data out to Facebook on behalf of a page
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import { TokenEncryptionService } from '../security/token-encryption.service.js';
import { FacebookGraphClient } from '../clients/facebook-graph.client.js';
import {
  ReplyToCommentResponseDto,
  SendMessageResponseDto,
} from '../dto/messaging/messaging.dto.js';
import { FacebookAccountService } from './facebook-account.service.js';

@Injectable()
export class FacebookMessagingService {
  private readonly logger = new Logger(FacebookMessagingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly graphClient: FacebookGraphClient,
    private readonly accounts: FacebookAccountService,
    private readonly encryption: TokenEncryptionService,
  ) {}

  async sendTextMessageInternal(
    pageId: string,
    psid: string,
    text: string,
    encryptedPageToken: string,
  ): Promise<SendMessageResponseDto> {
    if (!pageId || !psid || !text.trim()) {
      throw new Error('Invalid internal message payload');
    }
    const token = this.encryption.decrypt(encryptedPageToken);
    const result = await this.graphClient.sendTextMessage(psid, text, token);
    return {
      recipientId: result.recipient_id,
      messageId: result.message_id,
    };
  }

  /**
   * Internal sender for AI workflow where we already have pageId + encrypted token.
   */
  async sendImageMessageInternal(
    pageId: string,
    psid: string,
    imageUrl: string,
    encryptedPageToken: string,
  ): Promise<SendMessageResponseDto> {
    if (!pageId || !psid || !this.isSafeImageUrl(imageUrl)) {
      throw new Error('Invalid internal image payload');
    }
    const token = this.encryption.decrypt(encryptedPageToken);
    const result = await this.graphClient.sendImageMessage(psid, imageUrl, token);
    return {
      recipientId: result.recipient_id,
      messageId: result.message_id,
    };
  }

  // ─── Direct Messages ──────────────────────────────────────────────────────

  /**
   * Send a text DM to a user (identified by their PSID).
   * Persists the outbound message to the conversation timeline.
   */
  async sendMessage(
    businessProfileId: string,
    userId: string,
    recipientPsid: string,
    text: string,
  ): Promise<SendMessageResponseDto> {
    const conn = await this.accounts.requireByProfileId(
      businessProfileId,
      userId,
    );

    const result = await this.graphClient.sendTextMessage(
      recipientPsid,
      text,
      conn.decryptedToken,
    );

    // Persist the outbound message so the inbox timeline stays in sync
    await this.persistOutboundMessage(
      businessProfileId,
      recipientPsid,
      text,
      result.message_id,
    );

    this.logger.log(
      `Sent DM mid=${result.message_id} to PSID=${recipientPsid} via page=${conn.pageId}`,
    );

    return {
      recipientId: result.recipient_id,
      messageId: result.message_id,
    };
  }

  async sendImageMessage(
    businessProfileId: string,
    userId: string,
    recipientPsid: string,
    imageUrl: string,
  ): Promise<SendMessageResponseDto> {
    if (!this.isSafeImageUrl(imageUrl)) {
      throw new Error('Image URL must be a valid HTTPS URL');
    }
    const conn = await this.accounts.requireByProfileId(
      businessProfileId,
      userId,
    );

    const result = await this.graphClient.sendImageMessage(
      recipientPsid,
      imageUrl,
      conn.decryptedToken,
    );

    await this.persistOutboundImage(
      businessProfileId,
      recipientPsid,
      imageUrl,
      result.message_id,
    );

    this.logger.log(
      `Sent image mid=${result.message_id} to PSID=${recipientPsid} via page=${conn.pageId}`,
    );

    return {
      recipientId: result.recipient_id,
      messageId: result.message_id,
    };
  }

  // ─── Comments ─────────────────────────────────────────────────────────────

  /**
   * Reply to a Facebook comment.
   * The commentId is the *external* Facebook comment ID (e.g. "123_456").
   */
  async replyToComment(
    businessProfileId: string,
    userId: string,
    externalCommentId: string,
    message: string,
  ): Promise<ReplyToCommentResponseDto> {
    const conn = await this.accounts.requireByProfileId(
      businessProfileId,
      userId,
    );

    const result = await this.graphClient.replyToComment(
      externalCommentId,
      message,
      conn.decryptedToken,
    );

    this.logger.log(
      `Replied to comment ${externalCommentId} — new comment id=${result.id}`,
    );

    return { commentId: result.id };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Creates or updates the conversation record, then appends an outbound message.
   * This mirrors what WebhookService does for inbound messages.
   */
  private async persistOutboundMessage(
    businessProfileId: string,
    clientPsid: string,
    text: string,
    externalMessageId: string,
  ): Promise<void> {
    const now = new Date();

    const conversation = await this.prisma.conversation.upsert({
      where: {
        businessProfileId_externalId: {
          businessProfileId,
          externalId: clientPsid,
        },
      },
      create: {
        businessProfileId,
        externalId: clientPsid,
        clientPsid,
        lastMessage: text,
        lastMessageAt: now,
      },
      update: {
        lastMessage: text,
        lastMessageAt: now,
      },
    });

    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        sender: 'PAGE',
        content: text,
        externalId: externalMessageId,
        status: 'SENT',
      },
    });
  }

  private async persistOutboundImage(
    businessProfileId: string,
    clientPsid: string,
    imageUrl: string,
    externalMessageId: string,
  ): Promise<void> {
    const now = new Date();

    const conversation = await this.prisma.conversation.upsert({
      where: {
        businessProfileId_externalId: {
          businessProfileId,
          externalId: clientPsid,
        },
      },
      create: {
        businessProfileId,
        externalId: clientPsid,
        clientPsid,
        lastMessage: `Image: ${imageUrl}`,
        lastMessageAt: now,
      },
      update: {
        lastMessage: `Image: ${imageUrl}`,
        lastMessageAt: now,
      },
    });

    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        sender: 'PAGE',
        imageUrl,
        externalId: externalMessageId,
        status: 'SENT',
      },
    });
  }

  private isSafeImageUrl(value: string): boolean {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }
}
