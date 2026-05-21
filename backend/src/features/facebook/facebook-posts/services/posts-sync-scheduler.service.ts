/**
 * @file features/facebook-posts/services/posts-sync-scheduler.service.ts
 *
 * FIX — processPendingComments must NOT emit comment:new for existing comments.
 *
 * ROOT CAUSE of "Anonyme" author names
 * ─────────────────────────────────────
 * `processNewComment` emitted `comment:new` SSE for EVERY comment it processed
 * (including existing ones from the scheduler fallback). On the frontend,
 * `onCommentAdded` would receive these and — if the DB comment happened to
 * arrive before the frontend's `loadComments` API response — it prepended a
 * duplicate with whatever authorName was in the SSE payload.
 *
 * When called from the scheduler, `processNewComment` is invoked for comments
 * that are ALREADY in the DB and already visible. Re-emitting `comment:new`
 * for them can cause duplicates or overwrites depending on render timing.
 *
 * THE FIX
 * ───────
 * `processPendingComments` now calls `processNewComment(id, { emitNew: false })`.
 * The AI reply will still emit `comment:replied` after a successful reply,
 * which is the only SSE event needed for pending comments (the comment is
 * already visible, only its reply status needs updating).
 *
 * `syncPostComments` still emits `comment:new` for TRULY NEW comments
 * (those not yet in the DB) — this is correct and desired.
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
const MAX_AI_PER_POST_CYCLE = 10;
const FALLBACK_COMMENT_AUTHOR_NAME = 'Utilisateur Facebook';

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

  // ─── Main loop ────────────────────────────────────────────────────────────

  private async runFallbackSync(): Promise<void> {
    this.logger.debug('Running posts fallback sync cycle');
    const profiles = await this.loadProfiles();
    await Promise.allSettled(profiles.map((p) => this.syncProfile(p)));
  }

  private async syncProfile(profile: SyncProfile): Promise<void> {
    if (!profile.facebookConnection) return;
    if (profile.facebookConnection.tokenStatus === 'INVALID') return;

    const token = this.encryption.decrypt(
      profile.facebookConnection.encryptedAccessToken,
    );

    let totalNew = 0;

    for (const post of profile.managedPosts) {
      try {
        // 1. Sync new comments from Facebook API
        const newCount = await this.syncPostComments(
          post.id,
          post.externalId,
          profile.facebookConnection.pageId,
          profile.userId,
          token,
        );
        totalNew += newCount;

        if (newCount > 0) {
          // Update commentsCount in DB
          const updated = await this.prisma.facebookPost.update({
            where: { id: post.id },
            data: { commentsCount: { increment: newCount } },
            select: { commentsCount: true },
          });
          // Emit post:updated so frontend cards refresh inline
          this.sseEmitter.postUpdated(profile.userId, post.id, {
            commentsCount: updated.commentsCount,
          });
        }

        // 2. Fallback AI: process pending comments that weren't handled in real-time
        //    Pass emitNew:false — these comments are already visible to the user
        if (post.autoReply) {
          await this.processPendingComments(post.id);
        }
      } catch (err: unknown) {
        this.logger.warn(
          `Sync failed for post=${post.id}: ` +
            (err instanceof Error ? err.message : String(err)),
        );
      }
    }

    if (totalNew > 0) {
      // Emit sync:completed so frontend reloads the active post's comments
      this.sseEmitter.syncCompleted(profile.userId);
      this.logger.log(
        `Fallback sync: +${totalNew} new comments across ` +
          `${profile.managedPosts.length} posts for profile=${profile.id}`,
      );
    }
  }

  // ─── Sync new comments from Facebook ────────────────────────────────────

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
        25,
      );
    } catch {
      return 0;
    }

    let synced = 0;

    for (const fc of fbComments) {
      const exists = await this.prisma.postComment.findUnique({
        where: { externalId: fc.id },
        select: { id: true, authorId: true, authorName: true },
      });

      // Preserve author name; use a neutral fallback only when Facebook omits `from`.
      let authorName = fc.from?.name?.trim() || null;
      let authorId = fc.from?.id?.trim() || null;
      if (!authorId || !authorName) {
        try {
          const full = await this.graphClient.getCommentById(fc.id, token);
          authorId = authorId ?? full.from?.id?.trim() ?? null;
          authorName = authorName ?? full.from?.name?.trim() ?? null;
        } catch {
          // keep fallback flow below
        }
      }
      if (!authorName && authorId) {
        try {
          authorName = await this.graphClient.getUserNameById(authorId, token);
        } catch {
          // keep null fallback below
        }
      }

      const normalizedAuthorName =
        (authorId && authorId === pageId ? await this.resolvePageName(postId) : null) ||
        authorName ||
        (authorId ? `Compte ${authorId}` : FALLBACK_COMMENT_AUTHOR_NAME);
      const pageReply = await this.findPageReply(fc.id, token, pageId);

      if (exists) {
        await this.prisma.postComment.update({
          where: { id: exists.id },
          data: {
            message: fc.message,
            authorId:
              exists.authorId === 'unknown' && authorId ? authorId : exists.authorId,
            authorName:
              (exists.authorName === 'Anonyme' || exists.authorName === 'Unknown') &&
              normalizedAuthorName
                ? normalizedAuthorName
                : exists.authorName?.startsWith('Compte ')
                  ? normalizedAuthorName
                : exists.authorName,
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

      const created = await this.prisma.postComment.create({
        data: {
          postId,
          externalId: fc.id,
          authorId: authorId ?? 'unknown',
          authorName: normalizedAuthorName,
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

      synced++;

      // Emit comment:new for TRULY new comments — correct and desired
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

    return synced;
  }

  // ─── Fallback AI for pending comments ────────────────────────────────────

  /**
   * Process comments that weren't handled by the real-time webhook path.
   *
   * IMPORTANT: passes `emitNew: false` to processNewComment.
   * These comments are already in the DB and already visible on the frontend.
   * Re-emitting comment:new would cause duplicates or author name overwrites.
   * Only the `comment:replied` event (emitted after AI replies) is needed here.
   */
  private async processPendingComments(postId: string): Promise<void> {
    const pending = await this.prisma.postComment.findMany({
      where: { postId, isReplied: false },
      orderBy: { commentedAt: 'asc' },
      take: MAX_AI_PER_POST_CYCLE,
      select: { id: true },
    });

    for (const { id } of pending) {
      // FIX: emitNew=false — comment is already visible, no need to re-announce it
      void this.commentAi
        .processNewComment(id, { emitNew: false })
        .catch((err: unknown) => {
          this.logger.warn(
            `AI fallback failed for comment=${id}: ` +
              (err instanceof Error ? err.message : String(err)),
          );
        });
    }
  }

  // ─── Data loading ─────────────────────────────────────────────────────────

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

// ─── Internal types ───────────────────────────────────────────────────────────

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
