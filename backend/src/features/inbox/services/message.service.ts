/**
 * @file features/inbox/services/message.service.ts
 *
 * Paginated message retrieval (cursor-based) + send all message types to Facebook.
 *
 * Pagination strategy:
 *   - Messages are ordered by createdAt DESC (newest first in DB query)
 *   - Cursor = ID of the oldest message already loaded on the client
 *   - Each page returns up to `limit` messages older than the cursor
 *   - Frontend displays them in chronological order (reverse the returned array)
 *
 * Send strategy:
 *   - Text/image/file → send to Facebook Graph API immediately via FacebookGraphClient
 *   - Store the sent message in DB with status=SENT + externalId from FB response
 *   - Preset reference images are stored in the backend; their URLs are sent as FB
 *     image message attachments (one message per image)
 */

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import { FacebookGraphClient } from '../../facebook/clients/facebook-graph.client.js';
import { FacebookApiError } from '../../facebook/clients/facebook-graph.errors.js';
import { FacebookAccountService } from '../../facebook/services/facebook-account.service.js';
import type {
  GetMessagesQueryDto,
  MessageResponseDto,
  MessagesPageDto,
} from '../dto/inbox.dto.js';

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: FacebookAccountService,
    private readonly graphClient: FacebookGraphClient,
  ) {}

  // ── Paginated messages ────────────────────────────────────────────────────

  /**
   * Returns messages for a conversation, newest-first with cursor pagination.
   * The frontend reverses the array to display in chronological order.
   */
  async getMessages(
    conversationId: string,
    userId: string,
    { before, limit = 30 }: GetMessagesQueryDto,
  ): Promise<MessagesPageDto> {
    // Verify ownership
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, businessProfile: { userId } },
    });
    if (!conv)
      throw new NotFoundException(`Conversation ${conversationId} not found.`);

    // Cursor filter
    let cursorFilter: Record<string, unknown> = {};
    if (before) {
      const cursorMsg = await this.prisma.message.findUnique({
        where: { id: before },
      });
      if (cursorMsg) {
        cursorFilter = { createdAt: { lt: cursorMsg.createdAt } };
      }
    }

    const messages = await this.prisma.message.findMany({
      where: { conversationId, ...cursorFilter },
      orderBy: { createdAt: 'desc' },
      take: limit + 1, // fetch one extra to determine hasMore
    });

    const hasMore = messages.length > limit;
    const page = hasMore ? messages.slice(0, limit) : messages;
    const nextCursor = hasMore ? page[page.length - 1].id : null;

    return {
      messages: page.map((m) => this.toDto(m)),
      nextCursor,
      hasMore,
    };
  }

  // ── Send text ─────────────────────────────────────────────────────────────

  async sendText(
    conversationId: string,
    text: string,
    userId: string,
  ): Promise<MessageResponseDto> {
    const { conn, conv } = await this.resolveConversation(
      conversationId,
      userId,
    );

    const fbResult = await this.sendToFacebook(() =>
      this.graphClient.sendTextMessage(
        conv.clientPsid!,
        text,
        conn.decryptedToken,
      ),
    );

    const msg = await this.prisma.message.create({
      data: {
        conversationId,
        sender: 'PAGE',
        content: text,
        externalId: fbResult.message_id,
        status: 'SENT',
      },
    });

    await this.updateLastMessage(conversationId, text);
    this.logger.log(
      `Sent text mid=${fbResult.message_id} conv=${conversationId}`,
    );
    return this.toDto(msg);
  }

  // ── Send images ───────────────────────────────────────────────────────────

  /**
   * Sends one or more images to Facebook.
   * Each image is sent as a separate FB image attachment message.
   * If a caption is provided it is sent as a follow-up text message.
   * Only the last message (caption or last image) is stored in DB as lastMessage.
   */
  async sendImages(
    conversationId: string,
    imageUrls: string[],
    caption: string | undefined,
    userId: string,
  ): Promise<MessageResponseDto[]> {
    const { conn, conv } = await this.resolveConversation(
      conversationId,
      userId,
    );

    const results: MessageResponseDto[] = [];

    for (const url of imageUrls) {
      const fbResult = await this.sendToFacebook(() =>
        this.graphClient.sendImageMessage(
          conv.clientPsid!,
          url,
          conn.decryptedToken,
        ),
      );
      const msg = await this.prisma.message.create({
        data: {
          conversationId,
          sender: 'PAGE',
          imageUrl: url,
          externalId: fbResult.message_id,
          status: 'SENT',
        },
      });
      results.push(this.toDto(msg));
    }

    // Optional text caption after images
    if (caption?.trim()) {
      const fbResult = await this.sendToFacebook(() =>
        this.graphClient.sendTextMessage(
          conv.clientPsid!,
          caption,
          conn.decryptedToken,
        ),
      );
      const msg = await this.prisma.message.create({
        data: {
          conversationId,
          sender: 'PAGE',
          content: caption,
          externalId: fbResult.message_id,
          status: 'SENT',
        },
      });
      results.push(this.toDto(msg));
      await this.updateLastMessage(conversationId, caption);
    } else {
      await this.updateLastMessage(
        conversationId,
        `📷 ${imageUrls.length} photo(s)`,
      );
    }

    return results;
  }

  // ── Send file ─────────────────────────────────────────────────────────────

  async sendFile(
    conversationId: string,
    fileUrl: string,
    fileName: string,
    userId: string,
  ): Promise<MessageResponseDto> {
    const { conn, conv } = await this.resolveConversation(
      conversationId,
      userId,
    );

    // Facebook file attachment — use image message with file URL
    // (FB supports generic file attachments via /messages with type:file)
    const response = await this.sendToFacebook(() =>
      this.graphClient.post<{
        message_id: string;
        recipient_id: string;
      }>(
        '/me/messages',
        {
          messaging_type: 'RESPONSE',
          recipient: { id: conv.clientPsid },
          message: {
            attachment: {
              type: 'file',
              payload: { url: fileUrl, is_reusable: false },
            },
          },
        },
        { access_token: conn.decryptedToken },
      ),
    );

    const msg = await this.prisma.message.create({
      data: {
        conversationId,
        sender: 'PAGE',
        fileUrl,
        content: fileName,
        externalId: response.message_id,
        status: 'SENT',
      },
    });

    await this.updateLastMessage(conversationId, `📎 ${fileName}`);
    return this.toDto(msg);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async resolveConversation(conversationId: string, userId: string) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, businessProfile: { userId } },
    });
    if (!conv)
      throw new NotFoundException(`Conversation ${conversationId} not found.`);
    if (!conv.clientPsid)
      throw new NotFoundException('No PSID for this conversation.');

    const conn = await this.accounts.requireByProfileId(
      conv.businessProfileId,
      userId,
    );
    return { conn, conv };
  }

  private async updateLastMessage(
    conversationId: string,
    text: string,
  ): Promise<void> {
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessage: text, lastMessageAt: new Date() },
    });
  }

  private async sendToFacebook<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof FacebookApiError) {
        if (
          error.code === 10 ||
          error.message.toLowerCase().includes('délai autorisé') ||
          error.message.toLowerCase().includes('allowed window')
        ) {
          throw new BadRequestException(
            'Facebook refuse cet envoi car la conversation est hors de la fenêtre Messenger autorisée. Le client doit envoyer un nouveau message avant que vous puissiez répondre.',
          );
        }

        throw new BadRequestException(error.message);
      }

      throw error;
    }
  }

  private toDto(msg: any): MessageResponseDto {
    return {
      id: msg.id,
      conversationId: msg.conversationId,
      sender: msg.sender,
      content: msg.content,
      imageUrl: msg.imageUrl,
      fileUrl: msg.fileUrl,
      referenceImageUrls: (msg.referenceImageUrls as string[]) ?? [],
      status: msg.status,
      externalId: msg.externalId,
      createdAt: msg.createdAt,
    };
  }
}
