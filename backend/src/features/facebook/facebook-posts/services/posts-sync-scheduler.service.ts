/**
 * @file features/facebook-posts/services/posts-sync-scheduler.service.ts
 *
 * Runs a pg-boss job every 5 minutes to keep managed posts and their
 * comments in sync with Facebook and to trigger AI replies for comments
 * that weren't handled in real time by the webhook.
 *
 * Per sync cycle:
 *   1. For each managed post with an active connection:
 *      a. Fetch all recent comments from the Graph API and upsert them.
 *      b. Repair any missing or fallback author names.
 *      c. Refresh the commentsCount on the post record.
 *      d. If the post has autoReply=true, process every unreplied comment.
 *   2. Emit SSE events so the frontend updates without a reload.
 *
 * Unlike the inbox scheduler, there is no 24-hour cutoff on comments:
 * all unreplied non-spam comments receive AI replies regardless of age.
 *
 * emitNew:false is passed to processNewComment for existing comments so the
 * frontend does not receive duplicate comment:new events.
 * comment:replied is still emitted after each successful AI reply.
 */

import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PgBoss } from 'pg-boss';
import { PrismaService } from '../../../../database/prisma.service.js';
import { PG_BOSS_TOKEN } from '../../../queue/providers/pg-boss.provider.js';
import { FacebookGraphClient } from '../../clients/facebook-graph.client.js';
import { TokenEncryptionService } from '../../security/token-encryption.service.js';
import { PostsEventEmitter } from '../posts-events/posts-event-emitter.js';
import { PostCommentAiService } from './post-comment-ai.service.js';

const SCHEDULER_JOB = '__posts.sync.fallback__';
const CRON_5MIN = '*/5 * * * *';
const MAX_AI_PER_POST = 20; // max AI replies per post per cycle
const FALLBACK_AUTHOR = 'Utilisateur Facebook';

interface SyncProfile {
  id: string;
  userId: string;
  facebookConnection: {
    pageId: string;
    encryptedAccessToken: string;
    tokenStatus: string;
  } | null;
  managedPosts: Array<{
    id: string;
    externalId: string;
    autoReply: boolean;
  }>;
}

@Injectable()
export class PostsSyncSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(PostsSyncSchedulerService.name);

  constructor(
    @Inject(PG_BOSS_TOKEN)
    private readonly boss: PgBoss,
    private readonly prisma: PrismaService,
    private readonly graphClient: FacebookGraphClient,
    private readonly encryption: TokenEncryptionService,
    private readonly sseEmitter: PostsEventEmitter,
    private readonly commentAi: PostCommentAiService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.boss.createQueue(SCHEDULER_JOB);
    await this.boss.schedule(SCHEDULER_JOB, CRON_5MIN, {});
    await this.boss.work(SCHEDULER_JOB, async () => {
      await this.runFallbackSync();
    });
    this.logger.log(`Posts fallback sync registered (cron: ${CRON_5MIN})`);
  }

  // ─── Main loop ──────────────────────────────────────────────────────────────

  private async runFallbackSync(): Promise<void> {
    this.logger.debug('Posts fallback sync cycle starting');
    const profiles = await this.loadProfiles();
    await Promise.allSettled(profiles.map((p) => this.syncProfile(p)));
  }

  // ─── Per-profile sync ───────────────────────────────────────────────────────

  private async syncProfile(profile: SyncProfile): Promise<void> {
    if (!profile.facebookConnection) return;
    if (profile.facebookConnection.tokenStatus === 'INVALID') return;

    const token = this.encryption.decrypt(
      profile.facebookConnection.encryptedAccessToken,
    );

    for (const post of profile.managedPosts) {
      try {
        // 1. Sync comments from Facebook and update counts.
        const newCount = await this.syncPostComments(
          post.id,
          post.externalId,
          profile.facebookConnection.pageId,
          profile.userId,
          token,
        );

        if (newCount > 0) {
          const updated = await this.prisma.facebookPost.update({
            where: { id: post.id },
            data: { commentsCount: { increment: newCount } },
            select: { commentsCount: true },
          });
          this.sseEmitter.postUpdated(profile.userId, post.id, {
            commentsCount: updated.commentsCount,
          });
        }

        // 2. Also refresh the commentsCount from Graph API for accuracy.
        await this.refreshCommentsCount(post.id, post.externalId, token);

        // 3. Process ALL unreplied comments when autoReply is enabled.
        if (post.autoReply) {
          await this.processPendingComments(post.id);
        }
      } catch (err: unknown) {
        this.logger.warn(
          `Sync failed for post=${post.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    this.sseEmitter.syncCompleted(profile.userId);
  }

  // ─── Sync comments from Facebook ────────────────────────────────────────────

  /**
   * Fetches comments from the Graph API and upserts them.
   * Resolves author names with best-effort Graph calls.
   * Returns the count of genuinely NEW comments inserted.
   */
  private async syncPostComments(
    postId: string,
    externalId: string,
    pageId: string,
    userId: string,
    token: string,
  ): Promise<number> {
    let fbComments;
    try {
      fbComments = await this.graphClient.getPostComments(
        externalId,
        token,
        50,
      );
    } catch {
      return 0;
    }

    let newCount = 0;

    for (const fc of fbComments) {
      // Resolve author info with fallback chain.
      let authorId = fc.from?.id?.trim() || null;
      let authorName = fc.from?.name?.trim() || null;

      if (!authorId || !authorName) {
        try {
          const full = await this.graphClient.getCommentById(fc.id, token);
          authorId = authorId ?? full.from?.id?.trim() ?? null;
          authorName = authorName ?? full.from?.name?.trim() ?? null;
        } catch {
          /* keep null */
        }
      }

      if (!authorName && authorId) {
        try {
          authorName = await this.graphClient.getUserNameById(authorId, token);
        } catch {
          /* keep null */
        }
      }

      // Resolve page name for comments from the page itself.
      const resolvedAuthorName =
        (authorId && authorId === pageId
          ? await this.resolvePageName(postId)
          : null) ||
        authorName ||
        (authorId ? `Compte ${authorId}` : FALLBACK_AUTHOR);

      const pageReply = await this.findPageReply(fc.id, token, pageId);

      const existing = await this.prisma.postComment.findUnique({
        where: { externalId: fc.id },
        select: { id: true, authorId: true, authorName: true },
      });

      if (existing) {
        // Update: repair fallback author names and sync reply status.
        await this.prisma.postComment.update({
          where: { id: existing.id },
          data: {
            message: fc.message,
            authorId:
              existing.authorId === 'unknown' && authorId
                ? authorId
                : existing.authorId,
            authorName: isFallbackName(existing.authorName)
              ? resolvedAuthorName
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

      // New comment not yet in DB.
      const created = await this.prisma.postComment.create({
        data: {
          postId,
          externalId: fc.id,
          authorId: authorId ?? 'unknown',
          authorName: resolvedAuthorName,
          authorAvatarUrl: null,
          message: fc.message,
          commentedAt: new Date(fc.created_time),
          isReplied: !!pageReply,
          replyContent: pageReply?.message ?? null,
          repliedAt: pageReply ? new Date(pageReply.created_time) : null,
          repliedByAi: pageReply ? false : null,
          lastSyncedAt: new Date(),
        },
      });

      newCount++;

      // Emit comment:new for truly new comments.
      this.sseEmitter.commentAdded(userId, postId, {
        id: created.id,
        postId: created.postId,
        externalId: created.externalId,
        authorId: created.authorId,
        authorName: created.authorName,
        authorAvatarUrl: null,
        message: created.message,
        commentedAt: created.commentedAt.toISOString(),
        isReplied: created.isReplied,
        replyContent: created.replyContent,
        repliedAt: created.repliedAt?.toISOString() ?? null,
        repliedByAi: created.repliedByAi,
      });
    }

    return newCount;
  }

  // ─── Refresh commentsCount from Graph API ────────────────────────────────────

  /**
   * Queries the Graph API for the accurate comment count and updates the DB.
   * Prevents drift between the incremented local counter and the real count.
   */
  private async refreshCommentsCount(
    postId: string,
    externalId: string,
    token: string,
  ): Promise<void> {
    try {
      const result = await this.graphClient.get<{
        comments?: { summary?: { total_count?: number } };
      }>(`/${externalId}`, {
        access_token: token,
        fields: 'comments.summary(true)',
      });

      const count = result.comments?.summary?.total_count;
      if (typeof count === 'number') {
        await this.prisma.facebookPost.update({
          where: { id: postId },
          data: { commentsCount: count, lastSyncedAt: new Date() },
        });
      }
    } catch {
      /* non-fatal */
    }
  }

  // ─── Process pending (unreplied) comments ────────────────────────────────────

  /**
   * Sends AI replies to ALL unreplied comments for the post.
   * Uses emitNew:false because the comments are already in the DB and visible.
   * The comment:replied event is emitted by processNewComment after each reply.
   */
  private async processPendingComments(postId: string): Promise<void> {
    const pending = await this.prisma.postComment.findMany({
      where: { postId, isReplied: false },
      orderBy: { commentedAt: 'asc' },
      take: MAX_AI_PER_POST,
      select: { id: true },
    });

    for (const { id } of pending) {
      void this.commentAi
        .processNewComment(id, { emitNew: false })
        .catch((err: unknown) =>
          this.logger.warn(
            `AI fallback failed for comment=${id}: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
    }
  }

  // ─── Data loading ────────────────────────────────────────────────────────────

  private async loadProfiles(): Promise<SyncProfile[]> {
    const rows = await this.prisma.businessProfile.findMany({
      where: {
        facebookConnection: { isActive: true, NOT: { tokenStatus: 'INVALID' } },
        facebookPosts: { some: { postAiConfig: { isNot: null } } },
      },
      select: {
        id: true,
        userId: true,
        facebookConnection: {
          select: {
            pageId: true,
            encryptedAccessToken: true,
            tokenStatus: true,
          },
        },
        facebookPosts: {
          where: { postAiConfig: { isNot: null } },
          select: {
            id: true,
            externalId: true,
            postAiConfig: { select: { autoReply: true } },
          },
        },
      },
    });

    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      facebookConnection: r.facebookConnection ?? null,
      managedPosts: r.facebookPosts.map((p) => ({
        id: p.id,
        externalId: p.externalId,
        autoReply: p.postAiConfig?.autoReply ?? false,
      })),
    }));
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async resolvePageName(postId: string): Promise<string | null> {
    const post = await this.prisma.facebookPost.findUnique({
      where: { id: postId },
      include: { businessProfile: { include: { facebookConnection: true } } },
    });
    return post?.businessProfile.facebookConnection?.pageName ?? null;
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
}

// ─── Helper ─────────────────────────────────────────────────────────────────────

function isFallbackName(name: string | null | undefined): boolean {
  if (!name) return true;
  return (
    name === 'Anonyme' ||
    name === 'Unknown' ||
    name === FALLBACK_AUTHOR ||
    name.startsWith('Compte ')
  );
}
