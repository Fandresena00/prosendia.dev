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
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
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
  repaired?: number;
}
export interface ReplyResult {
  success: boolean;
  messageId?: string;
}

// ─── Add post payload (sent from frontend, avoids a second FB API call) ───────

export interface AddManagedPostDto {
  businessProfileId: string;
  externalId: string;
  message: string | null;
  imageUrl: string | null;
  permalinkUrl: string | null;
  reactionsCount: number;
  commentsCount: number;
  sharesCount: number;
  publishedAt: string; // ISO date string
}

// ─── Update PostAiConfig payload ──────────────────────────────────────────────

export interface UpdatePostAiConfigData {
  autoReply?: boolean;
  privateReplyEnabled?: boolean;
  privateReplyMessage?: string;
  customInstructions?: string;
  replyLanguage?: string;
  maxReplyTokens?: number;
  tone?: Tone;
  responseStyle?: ResponseStyle;
}

const MAX_AUTO_REPLY_POSTS = 10;
const FALLBACK_COMMENT_AUTHOR_NAME = 'Utilisateur Facebook';

@Injectable()
export class FacebookPostsService {
  private readonly logger = new Logger(FacebookPostsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly graphClient: FacebookGraphClient,
    private readonly encryption: TokenEncryptionService,
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
  ): Promise<
    Array<{
      externalId: string;
      message: string | null;
      imageUrl: string | null;
      permalinkUrl: string | null;
      reactionsCount: number;
      commentsCount: number;
      sharesCount: number;
      publishedAt: string;
      alreadyAdded: boolean;
    }>
  > {
    const connection = await this.getConnection(businessProfileId);
    const token = this.encryption.decrypt(connection.encryptedAccessToken);

    let fbPosts;
    try {
      fbPosts = await this.graphClient.getPagePosts(
        connection.pageId,
        token,
        limit,
      );
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
      externalId: p.id,
      message: p.message ?? null,
      imageUrl: p.full_picture ?? null,
      permalinkUrl: p.permalink_url ?? null,
      reactionsCount: p.reactions?.summary?.total_count ?? 0,
      commentsCount: p.comments?.summary?.total_count ?? 0,
      sharesCount: p.shares?.count ?? 0,
      publishedAt: p.created_time,
      alreadyAdded: managedIds.has(p.id),
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
      where: { externalId },
      create: {
        businessProfileId,
        externalId,
        ...rest,
        publishedAt: new Date(publishedAt),
        lastSyncedAt: new Date(),
      },
      update: {
        businessProfileId,
        ...rest,
        lastSyncedAt: new Date(),
      },
    });

    // Ensure PostAiConfig exists (mark as managed)
    await this.prisma.postAiConfig.upsert({
      where: { postId: post.id },
      create: {
        postId: post.id,
        autoReply: false, // off by default until user enables
        privateReplyEnabled: false,
      },
      update: {}, // don't overwrite existing config
    });

    this.logger.log(
      `Post added to management: externalId=${externalId} profile=${businessProfileId}`,
    );

    return this.prisma.facebookPost.findUniqueOrThrow({
      where: { id: post.id },
      include: { postAiConfig: true, _count: { select: { comments: true } } },
    });
  }

  // ─── Delete a managed post ────────────────────────────────────────────────

  /**
   * Removes a post from management.
   * Deletes the FacebookPost record — PostAiConfig and comments cascade.
   */
  async deleteManagedPost(
    postId: string,
    businessProfileId: string,
  ): Promise<void> {
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
    page = 1,
    pageSize = 20,
    search?: string,
  ) {
    const where = {
      businessProfileId,
      postAiConfig: { isNot: null }, // only manually added posts
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

  // ─── Sync comments for a managed post ────────────────────────────────────

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
    const grantedScopes = (connection.grantedScopes as string[]) ?? [];
    if (!grantedScopes.includes('pages_read_engagement')) {
      this.logger.warn(
        `Missing scope pages_read_engagement for page=${connection.pageId}. Comment authors may be unavailable.`,
      );
    }
    const token = this.encryption.decrypt(connection.encryptedAccessToken);
    let synced = 0;
    let repaired = 0;

    try {
      const comments = await this.graphClient.getPostComments(
        post.externalId,
        token,
        limit,
      );

      for (const comment of comments) {
        let authorId = comment.from?.id?.trim() || 'unknown';
        let authorNameRaw = comment.from?.name?.trim() || null;
        if (authorId === 'unknown' || !authorNameRaw) {
          try {
            const full = await this.graphClient.getCommentById(comment.id, token);
            authorId = full.from?.id?.trim() || authorId;
            authorNameRaw = full.from?.name?.trim() || authorNameRaw;
          } catch {
            // keep available values
          }
        }
        if (!authorNameRaw && authorId !== 'unknown') {
          try {
            authorNameRaw = await this.graphClient.getUserNameById(
              authorId,
              token,
            );
          } catch {
            // keep null, fallback below
          }
        }

        const authorName =
          (authorId === connection.pageId ? connection.pageName : null) ||
          authorNameRaw ||
          (authorId !== 'unknown'
            ? `Compte ${authorId}`
            : FALLBACK_COMMENT_AUTHOR_NAME);
        const pageReply = await this.findPageReply(
          comment.id,
          token,
          connection.pageId,
        );

        const existing = await this.prisma.postComment.findUnique({
          where: { externalId: comment.id },
          select: { id: true, authorId: true, authorName: true },
        });

        if (existing) {
          await this.prisma.postComment.update({
            where: { id: existing.id },
            data: {
              message: comment.message,
              // Repair previously anonymous records when Graph now has author.
              authorId:
                existing.authorId === 'unknown' && authorId !== 'unknown'
                  ? authorId
                  : existing.authorId,
              authorName:
                this.isFallbackAuthorName(existing.authorName)
                  ? authorName
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
          continue;
        }

        await this.prisma.postComment.create({
          data: {
            postId,
            externalId: comment.id,
            authorId,
            authorName,
            authorAvatarUrl: null,
            message: comment.message,
            commentedAt: new Date(comment.created_time),
            isReplied: !!pageReply,
            replyContent: pageReply?.message ?? null,
            repliedAt: pageReply ? new Date(pageReply.created_time) : null,
            repliedByAi: pageReply ? false : null,
            lastSyncedAt: new Date(),
          },
        });
        synced++;
      }

      // Repair pass: old comments may already exist with anonymous author data.
      // Even when synced=0, we still try to hydrate missing author info.
      const anonymousRows = await this.prisma.postComment.findMany({
        where: {
          postId,
          OR: [
            { authorId: 'unknown' },
            { authorName: 'Anonyme' },
            { authorName: 'Unknown' },
          ],
        },
        select: { id: true, externalId: true, authorId: true, authorName: true },
        take: Math.max(limit, 50),
      });

      for (const row of anonymousRows) {
        try {
          const fullComment = await this.graphClient.getCommentById(
            row.externalId,
            token,
          );
          const hydratedId = fullComment.from?.id?.trim();
          let hydratedName = fullComment.from?.name?.trim() || null;
          if (!hydratedName && hydratedId) {
            hydratedName = await this.graphClient.getUserNameById(
              hydratedId,
              token,
            );
          }
          if (!hydratedId || !hydratedName) continue;

          const nextAuthorId = row.authorId === 'unknown' ? hydratedId : row.authorId;
          const nextAuthorName = this.isFallbackAuthorName(row.authorName)
            ? hydratedName
            : row.authorName;

          if (
            nextAuthorId !== row.authorId ||
            nextAuthorName !== row.authorName
          ) {
            await this.prisma.postComment.update({
              where: { id: row.id },
              data: {
                authorId: nextAuthorId,
                authorName: nextAuthorName,
                lastSyncedAt: new Date(),
              },
            });
            repaired++;
          }
        } catch {
          // Non-fatal: one comment may no longer be readable via Graph.
        }
      }

      if (synced > 0) {
        await this.prisma.facebookPost.update({
          where: { id: postId },
          data: { commentsCount: { increment: synced } },
        });
      }

      this.logger.log(
        `Synced ${synced} comments for post=${postId} (repaired authors: ${repaired})`,
      );
    } catch (err) {
      if (err instanceof FacebookApiError) {
        this.logger.warn(
          `Comment sync failed for post=${postId}: ${err.message}`,
        );
        return { synced: 0, repaired: 0 };
      }
      throw err;
    }

    return { synced, repaired };
  }

  // ─── Get comments for a post ──────────────────────────────────────────────

  async getCommentsForPost(
    postId: string,
    page = 1,
    pageSize = 50,
    filter?: 'all' | 'pending' | 'replied' | 'useful',
    search?: string,
  ) {
    const post = await this.prisma.facebookPost.findUnique({
      where: { id: postId },
      include: { businessProfile: { include: { facebookConnection: true } } },
    });

    const where: Record<string, unknown> = {
      postId,
      ...(post?.businessProfile.facebookConnection?.pageId
        ? {
            NOT: [
              { authorId: post.businessProfile.facebookConnection.pageId },
              { authorName: post.businessProfile.facebookConnection.pageName },
            ],
          }
        : {}),
    };

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

    // Read-time repair: resolve anonymous/unknown authors before returning.
    const conn = post?.businessProfile.facebookConnection;
    if (conn) {
      const token = this.encryption.decrypt(conn.encryptedAccessToken);
      for (const c of comments) {
        const isAnonymousName =
          this.isFallbackAuthorName(c.authorName);
        const hasUsableId = !!c.authorId && c.authorId !== 'unknown';
        if (!isAnonymousName && hasUsableId && c.replyContent) continue;

        try {
          let nextAuthorId = c.authorId;
          let resolvedName: string | null = null;

          // First try by current authorId when usable.
          if (hasUsableId) {
            resolvedName = await this.graphClient.getUserNameById(c.authorId, token);
          }

          // If still unresolved, fetch full comment by externalId.
          if (!resolvedName || !nextAuthorId || nextAuthorId === 'unknown') {
            const full = await this.graphClient.getCommentById(c.externalId, token);
            const hydratedId = full.from?.id?.trim() || null;
            const hydratedName = full.from?.name?.trim() || null;
            if (hydratedId) nextAuthorId = hydratedId;
            resolvedName =
              hydratedName ||
              (hydratedId
                ? await this.graphClient.getUserNameById(hydratedId, token)
                : null);
          }

          const pageReply = !c.replyContent
            ? await this.findPageReply(c.externalId, token, conn.pageId)
            : null;

          if ((!resolvedName || !nextAuthorId) && !pageReply) {
            if (this.isFallbackAuthorName(c.authorName)) {
              await this.prisma.postComment.update({
                where: { id: c.id },
                data: { authorName: FALLBACK_COMMENT_AUTHOR_NAME },
              });
              c.authorName = FALLBACK_COMMENT_AUTHOR_NAME;
            }
            continue;
          }

          await this.prisma.postComment.update({
            where: { id: c.id },
            data: {
              ...(resolvedName && nextAuthorId
                ? { authorId: nextAuthorId, authorName: resolvedName }
                : {}),
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
          if (resolvedName && nextAuthorId) {
            c.authorId = nextAuthorId;
            c.authorName = resolvedName;
          }
          if (pageReply) {
            c.isReplied = true;
            c.replyContent = pageReply.message;
            c.repliedAt = new Date(pageReply.created_time);
            c.repliedByAi = false;
          }
          if (this.isFallbackAuthorName(c.authorName)) {
            c.authorName = FALLBACK_COMMENT_AUTHOR_NAME;
          }
        } catch {
          if (this.isFallbackAuthorName(c.authorName)) {
            await this.prisma.postComment.update({
              where: { id: c.id },
              data: { authorName: FALLBACK_COMMENT_AUTHOR_NAME },
            });
            c.authorName = FALLBACK_COMMENT_AUTHOR_NAME;
          }
        }
      }
    }

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

  private isFallbackAuthorName(name: string | null | undefined): boolean {
    return (
      !name ||
      name === 'Anonyme' ||
      name === 'Unknown' ||
      name === FALLBACK_COMMENT_AUTHOR_NAME ||
      name.startsWith('Compte ')
    );
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
    const grantedScopes = (connection.grantedScopes as string[]) ?? [];
    if (!grantedScopes.includes('pages_manage_engagement')) {
      throw new BadRequestException(
        'Permission manquante: pages_manage_engagement. Reconnectez la page Facebook avec toutes les permissions.',
      );
    }

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

      return { success: true, messageId: result.id };
    } catch (err) {
      if (err instanceof FacebookApiError) {
        this.logger.warn(
          `Failed to reply to comment=${commentId}: ${err.message}`,
        );
        throw new BadGatewayException(
          `Facebook a refusé la réponse publique: ${err.message}`,
        );
      }
      throw err;
    }
  }

  // ─── Private reply (DM in response to comment) ───────────────────────────

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
      return { success: true, messageId: result?.message_id };
    } catch (err) {
      if (err instanceof FacebookApiError) {
        this.logger.warn(
          `Failed private reply comment=${commentId}: ${err.message}`,
        );
        throw new BadGatewayException(
          `Facebook a refusé la réponse privée: ${err.message}`,
        );
      }
      throw err;
    }
  }

  // ─── PostAiConfig CRUD ────────────────────────────────────────────────────

  async getOrCreatePostAiConfig(postId: string) {
    return this.prisma.postAiConfig.upsert({
      where: { postId },
      create: { postId, autoReply: false, privateReplyEnabled: false },
      update: {},
    });
  }

  /**
   * Update PostAiConfig.
   * Enforces a maximum of 10 posts with autoReply enabled per businessProfile.
   */
  async updatePostAiConfig(postId: string, data: UpdatePostAiConfigData) {
    // 10-post auto-reply limit
    if (data.autoReply === true) {
      const post = await this.prisma.facebookPost.findUnique({
        where: { id: postId },
        select: { businessProfileId: true },
      });

      if (!post) throw new NotFoundException(`Post ${postId} not found`);

      const enabledCount = await this.prisma.postAiConfig.count({
        where: {
          post: { businessProfileId: post.businessProfileId },
          autoReply: true,
          NOT: { postId }, // exclude current post (in case it's already enabled)
        },
      });

      if (enabledCount >= MAX_AUTO_REPLY_POSTS) {
        throw new BadRequestException(
          `Limite atteinte : ${MAX_AUTO_REPLY_POSTS} posts avec réponse automatique activée au maximum par page Facebook.`,
        );
      }
    }

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
