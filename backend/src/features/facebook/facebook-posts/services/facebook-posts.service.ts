/**
 * @file features/facebook/services/facebook-posts.service.ts
 *
 * Manages Facebook posts and their comments:
 *   - Sync posts from page feed
 *   - Sync comments for a post
 *   - Reply to a comment publicly
 *   - Send a private reply (DM) to a comment author via Facebook Private Reply API
 *
 * FACEBOOK PRIVATE REPLY:
 *   Allowed by Facebook Policy when the DM is sent AS A RESPONSE to a specific comment.
 *   API: POST /{page-id}/messages with recipient: { comment_id: "..." }
 *   Requires pages_messaging permission (same as regular DMs).
 *   Unlike unsolicited DMs, this is explicitly permitted because the user initiated
 *   contact by commenting on the page's post.
 *
 * FIXES
 * ─────
 * 1. FIX (line ~54): `post.attachments?.data?.[0]?.media?.image?.src` removed.
 *    FbPost has no `attachments` field — only `full_picture` (see facebook-graph.client.ts).
 *    Using `post.full_picture` is consistent with FacebookSyncService.syncPosts().
 *
 * 2. FIX (updatePostAiConfig): `tone` and `responseStyle` were typed as `string`,
 *    which is incompatible with Prisma's generated `Tone` and `ResponseStyle` enums.
 *    Fix: import the enums from generated/prisma/enums.js and use them as parameter types.
 *    The spread `{ postId, ...data }` now satisfies Prisma's XOR constraint cleanly.
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service.js';
import { ResponseStyle, Tone } from '../../../../generated/prisma/enums.js';
import { FacebookGraphClient } from '../../clients/facebook-graph.client.js';
import { FacebookApiError } from '../../clients/facebook-graph.errors.js';
import { TokenEncryptionService } from '../../security/token-encryption.service.js';

export interface SyncPostsResult {
  synced: number;
  skipped: number;
}
export interface SyncCommentsResult {
  synced: number;
}
export interface ReplyResult {
  success: boolean;
  messageId?: string;
}

// ─── UpdatePostAiConfigData ───────────────────────────────────────────────────

/**
 * Uses Prisma enum types directly so the spread into upsert() is type-safe.
 * FIX: `tone` and `responseStyle` were previously `string`, causing TS2322.
 */
export interface UpdatePostAiConfigData {
  autoReply?: boolean;
  privateReplyEnabled?: boolean;
  privateReplyMessage?: string;
  customInstructions?: string;
  replyLanguage?: string;
  maxReplyTokens?: number;
  tone?: Tone; // FIX: was `string`
  responseStyle?: ResponseStyle; // FIX: was `string`
}

@Injectable()
export class FacebookPostsService {
  private readonly logger = new Logger(FacebookPostsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly graphClient: FacebookGraphClient,
    private readonly encryption: TokenEncryptionService,
  ) {}

  // ─── Sync posts from Facebook feed ────────────────────────────────────────

  async syncPagePosts(
    businessProfileId: string,
    limit = 20,
  ): Promise<SyncPostsResult> {
    const connection = await this.getConnection(businessProfileId);
    const token = this.encryption.decrypt(connection.encryptedAccessToken);

    let synced = 0,
      skipped = 0;

    try {
      const posts = await this.graphClient.getPageFeed(
        connection.pageId,
        token,
        limit,
      );

      for (const post of posts) {
        try {
          // FIX: FbPost has no `attachments` field — use `full_picture` instead.
          // `attachments` only exists on FbMessage (Messenger), not on feed posts.
          const imageUrl = post.full_picture ?? null;

          await this.prisma.facebookPost.upsert({
            where: { externalId: post.id },
            create: {
              businessProfileId,
              externalId: post.id,
              message: post.message ?? null,
              imageUrl,
              permalinkUrl: post.permalink_url ?? null,
              reactionsCount: post.reactions?.summary?.total_count ?? 0,
              commentsCount: post.comments?.summary?.total_count ?? 0,
              sharesCount: post.shares?.count ?? 0,
              publishedAt: new Date(post.created_time),
              lastSyncedAt: new Date(),
            },
            update: {
              message: post.message ?? null,
              imageUrl,
              permalinkUrl: post.permalink_url ?? null,
              reactionsCount: post.reactions?.summary?.total_count ?? 0,
              commentsCount: post.comments?.summary?.total_count ?? 0,
              sharesCount: post.shares?.count ?? 0,
              lastSyncedAt: new Date(),
            },
          });
          synced++;
        } catch {
          skipped++;
        }
      }

      this.logger.log(
        `Synced ${synced} posts for profile=${businessProfileId}`,
      );
    } catch (err) {
      if (err instanceof FacebookApiError) {
        this.logger.warn(
          `Post sync failed for profile=${businessProfileId}: ${err.message}`,
        );
        return { synced: 0, skipped: 0 };
      }
      throw err;
    }

    return { synced, skipped };
  }

  // ─── Sync comments for a post ──────────────────────────────────────────────

  async syncPostComments(
    postId: string,
    limit = 50,
  ): Promise<SyncCommentsResult> {
    const post = await this.prisma.facebookPost.findUnique({
      where: { id: postId },
      include: { businessProfile: { include: { facebookConnection: true } } },
    });

    if (!post || !post.businessProfile.facebookConnection) {
      throw new NotFoundException(
        `Post ${postId} not found or no FB connection`,
      );
    }

    const connection = post.businessProfile.facebookConnection;
    const token = this.encryption.decrypt(connection.encryptedAccessToken);
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
            externalId: comment.id,
            authorId: comment.from?.id ?? 'unknown',
            authorName: comment.from?.name ?? 'Anonyme',
            authorAvatarUrl: null,
            message: comment.message,
            commentedAt: new Date(comment.created_time),
            lastSyncedAt: new Date(),
          },
        });
        synced++;
      }

      // Update commentsCount on post
      if (synced > 0) {
        await this.prisma.facebookPost.update({
          where: { id: postId },
          data: { commentsCount: { increment: synced } },
        });
      }

      this.logger.log(`Synced ${synced} comments for post=${postId}`);
    } catch (err) {
      if (err instanceof FacebookApiError) {
        this.logger.warn(
          `Comment sync failed for post=${postId}: ${err.message}`,
        );
        return { synced: 0 };
      }
      throw err;
    }

    return { synced };
  }

  // ─── Get posts with their config ──────────────────────────────────────────

  async getPostsForProfile(
    businessProfileId: string,
    page = 1,
    pageSize = 20,
    search?: string,
  ) {
    const where = {
      businessProfileId,
      ...(search
        ? {
            message: { contains: search, mode: 'insensitive' as const },
          }
        : {}),
    };

    const [posts, total] = await Promise.all([
      this.prisma.facebookPost.findMany({
        where,
        include: { postAiConfig: true, _count: { select: { comments: true } } },
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.facebookPost.count({ where }),
    ]);

    return {
      data: posts,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  // ─── Get comments for a post ──────────────────────────────────────────────

  async getCommentsForPost(
    postId: string,
    page = 1,
    pageSize = 50,
    filter?: 'all' | 'pending' | 'replied' | 'useful',
    search?: string,
  ) {
    const where: Record<string, unknown> = { postId };

    if (filter === 'pending') where.isReplied = false;
    if (filter === 'replied') where.isReplied = true;
    if (search) {
      where.OR = [
        { message: { contains: search, mode: 'insensitive' } },
        { authorName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [comments, total] = await Promise.all([
      this.prisma.postComment.findMany({
        where,
        orderBy: { commentedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.postComment.count({ where }),
    ]);

    return {
      data: comments,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  // ─── Reply to comment (public) ────────────────────────────────────────────

  async replyToCommentPublic(
    commentId: string,
    replyText: string,
    repliedByAi = false,
  ): Promise<ReplyResult> {
    const comment = await this.prisma.postComment.findUnique({
      where: { id: commentId },
      include: {
        post: {
          include: {
            businessProfile: { include: { facebookConnection: true } },
          },
        },
      },
    });

    if (!comment) throw new NotFoundException(`Comment ${commentId} not found`);

    const connection = comment.post.businessProfile.facebookConnection;
    if (!connection)
      throw new NotFoundException('No active Facebook connection');

    const token = this.encryption.decrypt(connection.encryptedAccessToken);

    try {
      const result = await this.graphClient.replyToComment(
        comment.externalId,
        replyText,
        token,
      );

      await this.prisma.postComment.update({
        where: { id: commentId },
        data: {
          isReplied: true,
          replyContent: replyText,
          repliedAt: new Date(),
          repliedByAi,
        },
      });

      this.logger.log(
        `Replied to comment=${commentId} ${repliedByAi ? '[AI]' : '[human]'}`,
      );

      return { success: true, messageId: result.id };
    } catch (err) {
      if (err instanceof FacebookApiError) {
        this.logger.warn(
          `Failed to reply to comment=${commentId}: ${err.message}`,
        );
        return { success: false };
      }
      throw err;
    }
  }

  // ─── Private reply (DM in response to comment) ────────────────────────────

  /**
   * Sends a Facebook Private Reply — a DM sent as a direct response to a comment.
   *
   * Facebook Policy: This is explicitly allowed when the DM is triggered by a
   * comment on the page's post. The user initiated contact by commenting.
   *
   * API endpoint: POST /{page-id}/messages
   * Body: { recipient: { comment_id: "COMMENT_ID" }, message: { text: "..." } }
   *
   * Requirements:
   *   - pages_messaging permission (same as regular Messenger DMs)
   *   - The comment must be on a post belonging to the page
   *   - Only one private reply per comment is allowed
   */
  async sendPrivateReplyToComment(
    commentId: string,
    replyText: string,
    repliedByAi = false,
  ): Promise<ReplyResult> {
    const comment = await this.prisma.postComment.findUnique({
      where: { id: commentId },
      include: {
        post: {
          include: {
            businessProfile: { include: { facebookConnection: true } },
          },
        },
      },
    });

    if (!comment) throw new NotFoundException(`Comment ${commentId} not found`);

    const connection = comment.post.businessProfile.facebookConnection;
    if (!connection)
      throw new NotFoundException('No active Facebook connection');

    const token = this.encryption.decrypt(connection.encryptedAccessToken);

    try {
      const result = await this.graphClient.sendPrivateReplyToComment(
        connection.pageId,
        comment.externalId,
        replyText,
        token,
      );

      this.logger.log(
        `Private reply sent to comment=${commentId} author=${comment.authorId} ` +
          `${repliedByAi ? '[AI]' : '[human]'}`,
      );

      return { success: true, messageId: result?.message_id };
    } catch (err) {
      if (err instanceof FacebookApiError) {
        this.logger.warn(
          `Failed to send private reply to comment=${commentId}: ${err.message}`,
        );
        return { success: false };
      }
      throw err;
    }
  }

  // ─── Upsert PostAiConfig ───────────────────────────────────────────────────

  async getOrCreatePostAiConfig(postId: string) {
    return this.prisma.postAiConfig.upsert({
      where: { postId },
      create: {
        postId,
        autoReply: true,
        privateReplyEnabled: false,
      },
      update: {},
    });
  }

  /**
   * FIX: Parameter type now uses Prisma's `Tone` and `ResponseStyle` enums instead
   * of `string`. This resolves TS2322 on the upsert create/update spreads.
   *
   * Callers (e.g. FacebookPostsController) must pass enum values, not raw strings.
   * The controller receives them from the request body and should validate with
   * @IsEnum(Tone) / @IsEnum(ResponseStyle) in the DTO.
   */
  async updatePostAiConfig(postId: string, data: UpdatePostAiConfigData) {
    return this.prisma.postAiConfig.upsert({
      where: { postId },
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
