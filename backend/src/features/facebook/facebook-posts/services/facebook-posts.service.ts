/**
 * @file features/facebook-posts/services/facebook-posts.service.ts
 *
 * REWRITE — managed posts concept:
 *   - Posts are NOT auto-synced into the UI. Only explicitly "added" posts appear.
 *   - `getPostsForProfile` now returns ONLY posts where PostAiConfig exists.
 *   - `getPageFeed` returns live Facebook feed for the "add post" dialog.
 *   - `addManagedPost` creates a FacebookPost + PostAiConfig from frontend data.
 *   - `deleteManagedPost` removes the post (cascades to PostAiConfig + comments).
 *   - `updatePostAiConfig` enforces a 10-post autoReply limit per businessProfile.
 */

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import { Tone, ResponseStyle } from '../../../generated/prisma/enums.js';
import { FacebookGraphClient } from '../../facebook/clients/facebook-graph.client.js';
import { FacebookApiError } from '../../facebook/clients/facebook-graph.errors.js';
import { TokenEncryptionService } from '../../facebook/security/token-encryption.service.js';

export interface SyncPostsResult    { synced: number; skipped: number }
export interface SyncCommentsResult { synced: number }
export interface ReplyResult        { success: boolean; messageId?: string }

// ─── Add post payload (sent from frontend, avoids a second FB API call) ───────

export interface AddManagedPostDto {
  businessProfileId: string;
  externalId:        string;
  message:           string | null;
  imageUrl:          string | null;
  permalinkUrl:      string | null;
  reactionsCount:    number;
  commentsCount:     number;
  sharesCount:       number;
  publishedAt:       string; // ISO date string
}

// ─── Update PostAiConfig payload ──────────────────────────────────────────────

export interface UpdatePostAiConfigData {
  autoReply?:           boolean;
  privateReplyEnabled?: boolean;
  privateReplyMessage?: string;
  customInstructions?:  string;
  replyLanguage?:       string;
  maxReplyTokens?:      number;
  tone?:                Tone;
  responseStyle?:       ResponseStyle;
}

const MAX_AUTO_REPLY_POSTS = 10;

@Injectable()
export class FacebookPostsService {
  private readonly logger = new Logger(FacebookPostsService.name);

  constructor(
    private readonly prisma:      PrismaService,
    private readonly graphClient: FacebookGraphClient,
    private readonly encryption:  TokenEncryptionService,
  ) {}

  // ─── Live Facebook feed (for add-post dialog) ─────────────────────────────

  /**
   * Returns live posts from the Facebook page feed.
   * Used by the frontend "Add Post" dialog to let users pick which post to manage.
   * Posts already in management (have PostAiConfig) are excluded.
   */
  async getPageFeed(
    businessProfileId: string,
    limit = 25,
  ): Promise<Array<{
    externalId: string;
    message: string | null;
    imageUrl: string | null;
    permalinkUrl: string | null;
    reactionsCount: number;
    commentsCount: number;
    sharesCount: number;
    publishedAt: string;
    alreadyAdded: boolean;
  }>> {
    const connection = await this.getConnection(businessProfileId);
    const token = this.encryption.decrypt(connection.encryptedAccessToken);

    let fbPosts;
    try {
      fbPosts = await this.graphClient.getPagePosts(connection.pageId, token, limit);
    } catch (err) {
      if (err instanceof FacebookApiError) {
        this.logger.warn(`Feed fetch failed: ${err.message}`);
        return [];
      }
      throw err;
    }

    // Get already-managed external IDs
    const existingPosts = await this.prisma.facebookPost.findMany({
      where: {
        businessProfileId,
        postAiConfig: { isNot: null },
      },
      select: { externalId: true },
    });
    const managedIds = new Set(existingPosts.map((p) => p.externalId));

    return fbPosts.map((p) => ({
      externalId:     p.id,
      message:        p.message ?? null,
      imageUrl:       p.full_picture ?? null,
      permalinkUrl:   p.permalink_url ?? null,
      reactionsCount: p.reactions?.summary?.total_count ?? 0,
      commentsCount:  p.comments?.summary?.total_count  ?? 0,
      sharesCount:    p.shares?.count                   ?? 0,
      publishedAt:    p.created_time,
      alreadyAdded:   managedIds.has(p.id),
    }));
  }

  // ─── Add a post to management ─────────────────────────────────────────────

  /**
   * Creates a FacebookPost record (or updates if already exists) and
   * creates a PostAiConfig to mark it as "managed".
   * The frontend passes all the post data (no second FB API call needed).
   */
  async addManagedPost(dto: AddManagedPostDto) {
    const { businessProfileId, externalId, publishedAt, ...rest } = dto;

    // Upsert the post record
    const post = await this.prisma.facebookPost.upsert({
      where:  { externalId },
      create: {
        businessProfileId,
        externalId,
        ...rest,
        publishedAt:  new Date(publishedAt),
        lastSyncedAt: new Date(),
      },
      update: {
        ...rest,
        lastSyncedAt: new Date(),
      },
    });

    // Ensure PostAiConfig exists (mark as managed)
    await this.prisma.postAiConfig.upsert({
      where:  { postId: post.id },
      create: {
        postId:              post.id,
        autoReply:           false,   // off by default until user enables
        privateReplyEnabled: false,
      },
      update: {}, // don't overwrite existing config
    });

    this.logger.log(
      `Post added to management: externalId=${externalId} profile=${businessProfileId}`,
    );

    return this.prisma.facebookPost.findUniqueOrThrow({
      where:   { id: post.id },
      include: { postAiConfig: true, _count: { select: { comments: true } } },
    });
  }

  // ─── Delete a managed post ────────────────────────────────────────────────

  /**
   * Removes a post from management.
   * Deletes the FacebookPost record — PostAiConfig and comments cascade.
   */
  async deleteManagedPost(postId: string, businessProfileId: string): Promise<void> {
    const post = await this.prisma.facebookPost.findFirst({
      where: { id: postId, businessProfileId },
    });

    if (!post) {
      throw new NotFoundException(`Post ${postId} not found for this profile.`);
    }

    await this.prisma.facebookPost.delete({ where: { id: postId } });
    this.logger.log(`Post deleted: id=${postId} profile=${businessProfileId}`);
  }

  // ─── Get managed posts (those with PostAiConfig) ──────────────────────────

  async getPostsForProfile(
    businessProfileId: string,
    page     = 1,
    pageSize = 20,
    search?: string,
  ) {
    const where = {
      businessProfileId,
      postAiConfig: { isNot: null }, // only manually added posts
      ...(search ? {
        message: { contains: search, mode: 'insensitive' as const },
      } : {}),
    };

    const [posts, total] = await Promise.all([
      this.prisma.facebookPost.findMany({
        where,
        include: { postAiConfig: true, _count: { select: { comments: true } } },
        orderBy: { publishedAt: 'desc' },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
      }),
      this.prisma.facebookPost.count({ where }),
    ]);

    return {
      data: posts,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  // ─── Sync comments for a managed post ────────────────────────────────────

  async syncPostComments(
    postId: string,
    limit  = 50,
  ): Promise<SyncCommentsResult> {
    const post = await this.prisma.facebookPost.findUnique({
      where:   { id: postId },
      include: { businessProfile: { include: { facebookConnection: true } } },
    });

    if (!post || !post.businessProfile.facebookConnection) {
      throw new NotFoundException(`Post ${postId} not found or no FB connection`);
    }

    const connection = post.businessProfile.facebookConnection;
    const token      = this.encryption.decrypt(connection.encryptedAccessToken);
    let synced = 0;

    try {
      const comments = await this.graphClient.getPostComments(
        post.externalId,
        token,
        limit,
      );

      for (const comment of comments) {
        const existing = await this.prisma.postComment.findUnique({
          where: { externalId: comment.id },
        });
        if (existing) continue;

        await this.prisma.postComment.create({
          data: {
            postId,
            externalId:      comment.id,
            authorId:        comment.from?.id   ?? 'unknown',
            authorName:      comment.from?.name ?? 'Anonyme',
            authorAvatarUrl: null,
            message:         comment.message,
            commentedAt:     new Date(comment.created_time),
            lastSyncedAt:    new Date(),
          },
        });
        synced++;
      }

      if (synced > 0) {
        await this.prisma.facebookPost.update({
          where: { id: postId },
          data:  { commentsCount: { increment: synced } },
        });
      }

      this.logger.log(`Synced ${synced} comments for post=${postId}`);
    } catch (err) {
      if (err instanceof FacebookApiError) {
        this.logger.warn(`Comment sync failed for post=${postId}: ${err.message}`);
        return { synced: 0 };
      }
      throw err;
    }

    return { synced };
  }

  // ─── Get comments for a post ──────────────────────────────────────────────

  async getCommentsForPost(
    postId:   string,
    page    = 1,
    pageSize = 50,
    filter?: 'all' | 'pending' | 'replied' | 'useful',
    search?: string,
  ) {
    const where: Record<string, unknown> = { postId };

    if (filter === 'pending') where.isReplied = false;
    if (filter === 'replied') where.isReplied = true;
    if (search) {
      where.OR = [
        { message:    { contains: search, mode: 'insensitive' } },
        { authorName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [comments, total] = await Promise.all([
      this.prisma.postComment.findMany({
        where,
        orderBy: { commentedAt: 'desc' },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
      }),
      this.prisma.postComment.count({ where }),
    ]);

    return {
      data: comments,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  // ─── Reply to comment (public) ────────────────────────────────────────────

  async replyToCommentPublic(
    commentId:   string,
    replyText:   string,
    repliedByAi = false,
  ): Promise<ReplyResult> {
    const comment = await this.prisma.postComment.findUnique({
      where:   { id: commentId },
      include: {
        post: {
          include: { businessProfile: { include: { facebookConnection: true } } },
        },
      },
    });

    if (!comment) throw new NotFoundException(`Comment ${commentId} not found`);

    const connection = comment.post.businessProfile.facebookConnection;
    if (!connection) throw new NotFoundException('No active Facebook connection');

    const token = this.encryption.decrypt(connection.encryptedAccessToken);

    try {
      const result = await this.graphClient.replyToComment(
        comment.externalId,
        replyText,
        token,
      );

      await this.prisma.postComment.update({
        where: { id: commentId },
        data:  {
          isReplied:    true,
          replyContent: replyText,
          repliedAt:    new Date(),
          repliedByAi,
        },
      });

      return { success: true, messageId: result.id };
    } catch (err) {
      if (err instanceof FacebookApiError) {
        this.logger.warn(`Failed to reply to comment=${commentId}: ${err.message}`);
        return { success: false };
      }
      throw err;
    }
  }

  // ─── Private reply (DM in response to comment) ───────────────────────────

  async sendPrivateReplyToComment(
    commentId:   string,
    replyText:   string,
    repliedByAi = false,
  ): Promise<ReplyResult> {
    const comment = await this.prisma.postComment.findUnique({
      where:   { id: commentId },
      include: {
        post: {
          include: { businessProfile: { include: { facebookConnection: true } } },
        },
      },
    });

    if (!comment) throw new NotFoundException(`Comment ${commentId} not found`);

    const connection = comment.post.businessProfile.facebookConnection;
    if (!connection) throw new NotFoundException('No active Facebook connection');

    const token = this.encryption.decrypt(connection.encryptedAccessToken);

    try {
      const result = await this.graphClient.sendPrivateReplyToComment(
        connection.pageId,
        comment.externalId,
        replyText,
        token,
      );
      return { success: true, messageId: result?.message_id };
    } catch (err) {
      if (err instanceof FacebookApiError) {
        this.logger.warn(`Failed private reply comment=${commentId}: ${err.message}`);
        return { success: false };
      }
      throw err;
    }
  }

  // ─── PostAiConfig CRUD ────────────────────────────────────────────────────

  async getOrCreatePostAiConfig(postId: string) {
    return this.prisma.postAiConfig.upsert({
      where:  { postId },
      create: { postId, autoReply: false, privateReplyEnabled: false },
      update: {},
    });
  }

  /**
   * Update PostAiConfig.
   * Enforces a maximum of 10 posts with autoReply enabled per businessProfile.
   */
  async updatePostAiConfig(
    postId: string,
    data:   UpdatePostAiConfigData,
  ) {
    // 10-post auto-reply limit
    if (data.autoReply === true) {
      const post = await this.prisma.facebookPost.findUnique({
        where:  { id: postId },
        select: { businessProfileId: true },
      });

      if (!post) throw new NotFoundException(`Post ${postId} not found`);

      const enabledCount = await this.prisma.postAiConfig.count({
        where: {
          post:      { businessProfileId: post.businessProfileId },
          autoReply: true,
          NOT:       { postId }, // exclude current post (in case it's already enabled)
        },
      });

      if (enabledCount >= MAX_AUTO_REPLY_POSTS) {
        throw new BadRequestException(
          `Limite atteinte : ${MAX_AUTO_REPLY_POSTS} posts avec réponse automatique activée au maximum par page Facebook.`,
        );
      }
    }

    return this.prisma.postAiConfig.upsert({
      where:  { postId },
      create: { postId, ...data },
      update: data,
    });
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async getConnection(businessProfileId: string) {
    const connection = await this.prisma.facebookConnection.findFirst({
      where: { businessProfileId, isActive: true },
    });
    if (!connection) {
      throw new NotFoundException(
        `No active FB connection for profile=${businessProfileId}`,
      );
    }
    return connection;
  }
}
