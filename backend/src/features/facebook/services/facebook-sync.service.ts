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
              select: { encryptedAccessToken: true },
            },
          },
        },
      },
    });

    if (!post?.businessProfile.facebookConnection) return 0;

    const token = this.encryption.decrypt(post.businessProfile.facebookConnection.encryptedAccessToken);
    const comments = await this.graphClient.getPostComments(post.externalId, token, limit);

    let synced = 0;
    for (const c of comments) {
      await this.prisma.postComment.upsert({
        where: { externalId: c.id },
        create: {
          postId: post.id,
          externalId: c.id,
          authorId: c.from?.id ?? 'unknown',
          authorName: c.from?.name ?? 'Unknown',
          message: c.message,
          commentedAt: new Date(c.created_time),
          lastSyncedAt: new Date(),
        },
        update: {
          message: c.message,
          lastSyncedAt: new Date(),
        },
      });
      synced++;
    }

    return synced;
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
              select: { encryptedAccessToken: true },
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
        const upserted = await this.upsertMessage(conversationId, fbMsg);
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

  private async upsertMessage(conversationId: string, fbMsg: FbMessage): Promise<boolean> {
    const exists = await this.prisma.message.findFirst({
      where: { externalId: fbMsg.id },
    });
    if (exists) return false;

    const imageAttachment = fbMsg.attachments?.data?.find((a) => a.mime_type?.startsWith('image/'));
    const imageUrl = imageAttachment?.image_data?.url ?? null;

    await this.prisma.message.create({
      data: {
        conversationId,
        externalId: fbMsg.id,
        sender: 'CLIENT',
        content: fbMsg.message ?? null,
        imageUrl,
        status: 'DELIVERED',
        createdAt: new Date(fbMsg.created_time),
      },
    });

    return true;
  }
}
