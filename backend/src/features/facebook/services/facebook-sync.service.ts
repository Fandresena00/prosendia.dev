import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import { InboxEventEmitter } from '../../inbox/gateways/inbox-sse.gateway.js';
import { FacebookApiError, FacebookTemporaryError } from '../clients/facebook-graph.errors.js';
import { FacebookGraphClient, type FbMessage } from '../clients/facebook-graph.client.js';
import { TokenEncryptionService } from '../security/token-encryption.service.js';

export interface SyncConversationsResult {
  synced: number;
  skipped: number;
}

export interface SyncMessagesResult {
  synced: number;
}

@Injectable()
export class FacebookSyncService {
  private readonly logger = new Logger(FacebookSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly graphClient: FacebookGraphClient,
    private readonly encryption: TokenEncryptionService,
    private readonly sseEmitter: InboxEventEmitter,
  ) {}

  async syncPosts(
    businessProfileId: string,
    userId: string,
    limit = 10,
  ): Promise<number> {
    const connection = await this.prisma.facebookConnection.findFirst({
      where: {
        businessProfileId,
        isActive: true,
        businessProfile: { userId },
      },
      select: { pageId: true, encryptedAccessToken: true },
    });

    if (!connection) return 0;
    const pageToken = this.encryption.decrypt(connection.encryptedAccessToken);
    const posts = await this.graphClient.getPagePosts(connection.pageId, pageToken, limit);

    let synced = 0;
    for (const post of posts) {
      await this.prisma.facebookPost.upsert({
        where: {
          externalId: post.id,
        },
        create: {
          businessProfileId,
          externalId: post.id,
          message: post.message ?? null,
          imageUrl: post.full_picture ?? null,
          permalinkUrl: post.permalink_url ?? null,
          reactionsCount: post.reactions?.summary?.total_count ?? 0,
          commentsCount: post.comments?.summary?.total_count ?? 0,
          sharesCount: post.shares?.count ?? 0,
          publishedAt: new Date(post.created_time),
          lastSyncedAt: new Date(),
        },
        update: {
          message: post.message ?? null,
          imageUrl: post.full_picture ?? null,
          permalinkUrl: post.permalink_url ?? null,
          reactionsCount: post.reactions?.summary?.total_count ?? 0,
          commentsCount: post.comments?.summary?.total_count ?? 0,
          sharesCount: post.shares?.count ?? 0,
          publishedAt: new Date(post.created_time),
          lastSyncedAt: new Date(),
        },
      });
      synced++;
    }

    return synced;
  }

  async syncPostComments(postId: string, userId: string, limit = 25): Promise<number> {
    const post = await this.prisma.facebookPost.findFirst({
      where: {
        id: postId,
        businessProfile: { userId },
      },
      include: {
        businessProfile: {
          include: {
            facebookConnection: {
              where: { isActive: true },
              select: {
                encryptedAccessToken: true,
                pageId: true,
                pageName: true,
              },
            },
          },
        },
      },
    });

    if (!post?.businessProfile.facebookConnection) return 0;

    const connection = post.businessProfile.facebookConnection;
    const token = this.encryption.decrypt(connection.encryptedAccessToken);
    const comments = await this.graphClient.getPostComments(post.externalId, token, limit);

    let synced = 0;
    for (const c of comments) {
      const existing = await this.prisma.postComment.findUnique({
        where: { externalId: c.id },
        select: { id: true, authorId: true, authorName: true },
      });

      let authorId = c.from?.id?.trim() || null;
      let authorName = c.from?.name?.trim() || null;
      if (!authorId || !authorName) {
        try {
          const full = await this.graphClient.getCommentById(c.id, token);
          authorId = authorId ?? full.from?.id?.trim() ?? null;
          authorName = authorName ?? full.from?.name?.trim() ?? null;
        } catch {
          // Keep available values and fall back below.
        }
      }
      if (!authorName && authorId) {
        try {
          authorName = await this.graphClient.getUserNameById(authorId, token);
        } catch {
          // Keep fallback below.
        }
      }

      const normalizedAuthorId = authorId ?? existing?.authorId ?? 'unknown';
      const existingNameIsFallback =
        existing?.authorName === 'Anonyme' ||
        existing?.authorName === 'Unknown' ||
        existing?.authorName?.startsWith('Compte ');
      const normalizedAuthorName =
        (normalizedAuthorId === connection.pageId ? connection.pageName : null) ||
        authorName ||
        (!existingNameIsFallback ? existing?.authorName : null) ||
        (normalizedAuthorId !== 'unknown'
          ? `Compte ${normalizedAuthorId}`
          : 'Anonyme');
      const pageReply = await this.findPageReply(c.id, token, connection.pageId);

      await this.prisma.postComment.upsert({
        where: { externalId: c.id },
        create: {
          postId: post.id,
          externalId: c.id,
          authorId: normalizedAuthorId,
          authorName: normalizedAuthorName,
          message: c.message,
          commentedAt: new Date(c.created_time),
          isReplied: !!pageReply,
          replyContent: pageReply?.message ?? null,
          repliedAt: pageReply ? new Date(pageReply.created_time) : null,
          repliedByAi: pageReply ? false : null,
          lastSyncedAt: new Date(),
        },
        update: {
          message: c.message,
          authorId:
            existing?.authorId === 'unknown' && authorId
              ? authorId
              : normalizedAuthorId,
          authorName:
            existingNameIsFallback || !existing?.authorName
              ? normalizedAuthorName
              : existing.authorName,
          ...(pageReply
            ? {
                isReplied: true,
                replyContent: pageReply.message,
                repliedAt: new Date(pageReply.created_time),
                repliedByAi: false,
              }
            : {}),
          lastSyncedAt: new Date(),
        },
      });
      synced++;
    }

    return synced;
  }

  private async findPageReply(
    commentExternalId: string,
    token: string,
    pageId: string,
  ) {
    try {
      const replies = await this.graphClient.getCommentReplies(
        commentExternalId,
        token,
        25,
      );
      return (
        replies
          .filter((r) => r.from?.id === pageId && r.message?.trim())
          .sort(
            (a, b) =>
              new Date(a.created_time).getTime() -
              new Date(b.created_time).getTime(),
          )[0] ?? null
      );
    } catch {
      return null;
    }
  }

  async syncConversations(
    businessProfileId: string,
    userId: string,
    limit = 20,
  ): Promise<SyncConversationsResult> {
    const connection = await this.prisma.facebookConnection.findFirst({
      where: {
        businessProfileId,
        isActive: true,
        businessProfile: { userId },
      },
      select: { pageId: true, encryptedAccessToken: true },
    });

    if (!connection) {
      return { synced: 0, skipped: 0 };
    }

    const pageToken = this.encryption.decrypt(connection.encryptedAccessToken);
    let synced = 0;
    let skipped = 0;

    try {
      const fbConversations = await this.graphClient.getConversations(connection.pageId, pageToken, limit);

      for (const fbConv of fbConversations) {
        try {
          await this.upsertConversation(businessProfileId, fbConv);
          synced++;
        } catch {
          skipped++;
        }
      }
    } catch (err) {
      if (err instanceof FacebookTemporaryError) {
        this.logger.warn(`Conversation sync temporarily unavailable for ${businessProfileId}`);
        return { synced: 0, skipped: 0 };
      }
      throw err;
    }

    return { synced, skipped };
  }

  async syncConversationMessages(
    conversationId: string,
    userId?: string,
    limit = 25,
  ): Promise<SyncMessagesResult> {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        ...(userId ? { businessProfile: { userId } } : {}),
      },
      include: {
        businessProfile: {
          include: {
            facebookConnection: {
              where: { isActive: true },
              select: { encryptedAccessToken: true, pageId: true },
            },
          },
        },
      },
    });

    if (!conversation || !conversation.businessProfile.facebookConnection) {
      return { synced: 0 };
    }

    if (!conversation.externalId || !conversation.externalId.startsWith('t_')) {
      this.logger.warn(`Invalid conversation externalId for ${conversationId}`);
      return { synced: 0 };
    }

    const pageToken = this.encryption.decrypt(conversation.businessProfile.facebookConnection.encryptedAccessToken);

    try {
      const fbMessages = await this.graphClient.getConversationMessages(
        conversation.externalId,
        pageToken,
        limit,
      );

      let synced = 0;
      for (const fbMsg of fbMessages) {
        const upserted = await this.upsertMessage(
          conversationId,
          fbMsg,
          conversation.businessProfile.facebookConnection.pageId,
        );
        if (upserted) synced++;
      }

      if (synced > 0) {
        this.sseEmitter.conversationUpdated(conversation.businessProfile.userId, {
          conversation: {
            ...conversation,
            updatedAt: new Date(),
            unreadCount: 0,
          },
        });
      }

      return { synced };
    } catch (err) {
      if (err instanceof FacebookApiError || err instanceof FacebookTemporaryError) {
        this.logger.warn(`Cannot sync messages for conversation=${conversationId}: ${err.message}`);
        return { synced: 0 };
      }
      throw err;
    }
  }

  private async upsertConversation(
    businessProfileId: string,
    fbConv: {
      id: string;
      participants?: { data: ReadonlyArray<{ id: string; name: string }> };
      updated_time: string;
      messages?: {
        data: ReadonlyArray<{
          id: string;
          message: string;
          from: { id: string; name: string };
          created_time: string;
        }>;
      };
    },
  ): Promise<void> {
    const participants = fbConv.participants?.data ?? [];
    const clientParticipant = participants.find((p) => !p.id.startsWith('app_'));
    if (!clientParticipant) return;

    const snippet = fbConv.messages?.data?.[0]?.message ?? null;

    await this.prisma.conversation.upsert({
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
        clientName: clientParticipant.name,
        lastMessage: snippet,
        lastMessageAt: new Date(fbConv.updated_time),
      },
      update: {
        clientName: clientParticipant.name,
        lastMessage: snippet,
        lastMessageAt: new Date(fbConv.updated_time),
      },
    });
  }

  private async upsertMessage(
    conversationId: string,
    fbMsg: FbMessage,
    pageId: string,
  ): Promise<boolean> {
    const exists = await this.prisma.message.findFirst({
      where: { externalId: fbMsg.id },
    });
    if (exists) return false;

    const imageAttachment = fbMsg.attachments?.data?.find(
      (a) =>
        a.mime_type?.startsWith('image/') ||
        Boolean(a.image_data?.url) ||
        (a.file_url?.match(/\.(png|jpg|jpeg|gif|webp)(\?|$)/i) ?? false),
    );
    const imageUrl =
      imageAttachment?.image_data?.url ?? imageAttachment?.file_url ?? null;
    const fileAttachment = fbMsg.attachments?.data?.find(
      (a) => Boolean(a.file_url) && a.file_url !== imageUrl,
    );
    const fileUrl = fileAttachment?.file_url ?? null;

    await this.prisma.message.create({
      data: {
        conversationId,
        externalId: fbMsg.id,
        sender: fbMsg.from?.id === pageId ? 'PAGE' : 'CLIENT',
        content: fbMsg.message ? normalizeMessageText(fbMsg.message) : null,
        imageUrl,
        fileUrl,
        status: 'DELIVERED',
        createdAt: new Date(fbMsg.created_time),
      },
    });

    return true;
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
