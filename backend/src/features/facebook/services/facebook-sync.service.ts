import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import { FacebookPermissionError } from '../clients/facebook-graph.errors.js';
import { FacebookGraphClient } from '../clients/facebook-graph.client.js';
import { FacebookAccountService } from './facebook-account.service.js';

export interface SyncPostsResult {
  synced: number;
  status: 'success' | 'skipped';
  code?: 'MISSING_PERMISSION';
  message?: string;
}

@Injectable()
export class FacebookSyncService {
  private readonly logger = new Logger(FacebookSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly graphClient: FacebookGraphClient,
    private readonly accounts: FacebookAccountService,
  ) {}

  // ─── Posts ────────────────────────────────────────────────────────────────

  async syncPosts(
    businessProfileId: string,
    userId: string,
    limit = 10,
  ): Promise<SyncPostsResult> {
    const conn = await this.accounts.requireByProfileId(businessProfileId, userId);
    const grantedScopes = new Set(conn.grantedScopes as unknown as string[]);
    if (!grantedScopes.has('pages_read_engagement')) {
      this.logger.warn(
        `Skipping posts sync for profile ${businessProfileId}: missing pages_read_engagement scope`,
      );
      return {
        synced: 0,
        status: 'skipped',
        code: 'MISSING_PERMISSION',
        message:
          "Missing Facebook permission 'pages_read_engagement' for this page token.",
      };
    }

    let posts: Awaited<ReturnType<FacebookGraphClient['getPagePosts']>>;
    try {
      posts = await this.graphClient.getPagePosts(
        conn.pageId,
        conn.decryptedToken,
        limit,
      );
    } catch (error) {
      if (error instanceof FacebookPermissionError) {
        this.logger.warn(
          `Skipping posts sync for profile ${businessProfileId}: ${error.message}`,
        );
        return {
          synced: 0,
          status: 'skipped',
          code: 'MISSING_PERMISSION',
          message: error.message,
        };
      }
      throw error;
    }

    let synced = 0;
    for (const post of posts) {
      await this.prisma.facebookPost.upsert({
        where: { externalId: post.id },
        create: {
          businessProfileId,
          externalId: post.id,
          message: post.message ?? null,
          imageUrl: post.full_picture ?? null,
          permalinkUrl: post.permalink_url ?? null,
          reactionsCount: post.reactions?.summary.total_count ?? 0,
          commentsCount: post.comments?.summary.total_count ?? 0,
          sharesCount: post.shares?.count ?? 0,
          publishedAt: new Date(post.created_time),
          lastSyncedAt: new Date(),
        },
        update: {
          message: post.message ?? null,
          imageUrl: post.full_picture ?? null,
          reactionsCount: post.reactions?.summary.total_count ?? 0,
          commentsCount: post.comments?.summary.total_count ?? 0,
          sharesCount: post.shares?.count ?? 0,
          lastSyncedAt: new Date(),
        },
      });
      synced++;
    }

    await this.prisma.facebookConnection.update({
      where: { id: conn.id },
      data: { lastSyncedAt: new Date() },
    });

    this.logger.log(`Synced ${synced} posts for profile ${businessProfileId}`);
    return { synced, status: 'success' };
  }

  // ─── Comments ─────────────────────────────────────────────────────────────

  async syncPostComments(
    postId: string,
    userId: string,
    limit = 25,
  ): Promise<number> {
    const post = await this.prisma.facebookPost.findUnique({
      where: { id: postId },
      include: { businessProfile: true },
    });

    if (!post || post.businessProfile.userId !== userId) {
      throw new NotFoundException(`Post ${postId} not found.`);
    }

    const conn = await this.accounts.requireByProfileId(post.businessProfileId, userId);
    const comments = await this.graphClient.getPostComments(
      post.externalId,
      conn.decryptedToken,
      limit,
    );

    let synced = 0;
    for (const comment of comments) {
      await this.prisma.postComment.upsert({
        where: { externalId: comment.id },
        create: {
          postId,
          externalId: comment.id,
          authorId: comment.from?.id ?? 'unknown',
          authorName: comment.from?.name ?? 'Unknown',
          message: comment.message,
          commentedAt: new Date(comment.created_time),
          lastSyncedAt: new Date(),
        },
        update: {
          message: comment.message,
          lastSyncedAt: new Date(),
        },
      });
      synced++;
    }

    return synced;
  }

  // ─── Conversations ────────────────────────────────────────────────────────

  async syncConversations(
    businessProfileId: string,
    userId: string,
    limit = 20,
  ): Promise<number> {
    const conn = await this.accounts.requireByProfileId(businessProfileId, userId);
    const conversations = await this.graphClient.getConversations(
      conn.pageId,
      conn.decryptedToken,
      limit,
    );

    let synced = 0;
    for (const conv of conversations) {
      const client = conv.participants?.data.find((p) => p.id !== conn.pageId);

      await this.prisma.conversation.upsert({
        where: {
          businessProfileId_externalId: {
            businessProfileId,
            externalId: conv.id,
          },
        },
        create: {
          businessProfileId,
          externalId: conv.id,
          clientPsid: client?.id ?? null,
          clientName: client?.name ?? null,
          lastMessageAt: new Date(conv.updated_time),
        },
        update: {
          clientName: client?.name ?? undefined,
          lastMessageAt: new Date(conv.updated_time),
        },
      });
      synced++;
    }

    await this.prisma.facebookConnection.update({
      where: { id: conn.id },
      data: { lastSyncedAt: new Date() },
    });

    this.logger.log(`Synced ${synced} conversations for profile ${businessProfileId}`);
    return synced;
  }

  // ─── Messages ─────────────────────────────────────────────────────────────

  /**
   * Pulls the individual messages for a specific conversation and upserts them.
   * Useful after a webhook event to backfill context or on demand from the inbox UI.
   */
  async syncConversationMessages(
    conversationId: string,
    userId: string,
    limit = 25,
  ): Promise<number> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { businessProfile: true },
    });

    if (!conversation || conversation.businessProfile.userId !== userId) {
      throw new NotFoundException(`Conversation ${conversationId} not found.`);
    }

    const conn = await this.accounts.requireByProfileId(
      conversation.businessProfileId,
      userId,
    );

    const messages = await this.graphClient.getConversationMessages(
      conversation.externalId,
      conn.decryptedToken,
      limit,
    );

    let synced = 0;
    for (const msg of messages) {
      const sender = msg.from.id === conn.pageId ? 'PAGE' : 'CLIENT';
      await this.prisma.message.upsert({
        where: { externalId: msg.id },
        create: {
          conversationId,
          externalId: msg.id,
          sender,
          content: msg.message,
          status: 'DELIVERED',
        },
        update: {
          content: msg.message,
        },
      });
      synced++;
    }

    this.logger.log(
      `Synced ${synced} messages for conversation ${conversationId}`,
    );
    return synced;
  }
}
