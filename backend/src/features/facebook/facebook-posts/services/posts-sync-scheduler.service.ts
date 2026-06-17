/**
 * @file features/facebook-posts/services/posts-sync-scheduler.service.ts
 *
 * Runs TWO pg-boss jobs:
 *
 *   1. `__posts.sync.fallback__` — every 5 minutes. Full Graph API sync:
 *      fetches comments, repairs author names, refreshes commentsCount,
 *      and enqueues AI replies for unreplied comments on autoReply posts.
 *
 *   2. `__posts.ai.recheck__` — every 10 minutes (NEW). A LIGHTWEIGHT,
 *      DB-ONLY safety net: finds unreplied comments on autoReply posts and
 *      (re-)enqueues a comment.ai_reply job for each. No Graph API calls —
 *      cheap enough to run often, catches anything the real-time webhook
 *      trigger or the 5-minute sync missed (e.g. a webhook delivery that
 *      failed, or a comment whose config changed after being spam-filtered).
 *
 * INSTANT REPLIES — why the 5/10-minute jobs are now "safety nets", not the
 * primary path:
 *   WebhookService.handleFeedChange() enqueues a comment.ai_reply job
 *   IMMEDIATELY when a new comment arrives, and CommentAiReplyWorker polls
 *   that queue every ~2 seconds. The 5/10-minute cycles here exist purely to
 *   catch comments the webhook missed (delivery failures, comments posted
 *   while the app was down, config changes after a spam-skip) — NOT as the
 *   primary AI-reply trigger. This is what turns "3 hours for one comment"
 *   into "a few seconds" for the common case.
 *
 * Both jobs enqueue via AiQueueProducer.enqueueCommentAiReply() with
 * `force: false` — the spam-score filter, keyword rules, and
 * replyToAllComments switch are all still respected (no AI-credit abuse on
 * comments the user hasn't asked to bypass).
 *
 * emitNew:false is used for the AI jobs enqueued here because the comments
 * are already in the DB and visible (or were already emitted by the
 * webhook/initial sync). comment:replied is still emitted by
 * PostCommentAiService after each successful reply.
 */

import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PgBoss } from 'pg-boss';
import { PrismaService } from '../../../../database/prisma.service.js';
import { AiQueueProducer } from '../../../queue/producers/ai-queue.producer.js';
import { PG_BOSS_TOKEN } from '../../../queue/providers/pg-boss.provider.js';
import { FacebookGraphClient } from '../../clients/facebook-graph.client.js';
import { TokenEncryptionService } from '../../security/token-encryption.service.js';
import { PostsEventEmitter } from '../posts-events/posts-event-emitter.js';

const SCHEDULER_JOB   = '__posts.sync.fallback__';
const CRON_5MIN       = '*/5 * * * *';
const RECHECK_JOB     = '__posts.ai.recheck__';
const CRON_10MIN      = '*/10 * * * *';
const MAX_AI_PER_POST = 20; // max AI jobs enqueued per post per 5-min cycle
const MAX_RECHECK     = 50; // max AI jobs enqueued per 10-min recheck cycle
const FALLBACK_AUTHOR = 'Utilisateur Facebook';

interface SyncProfile {
  id:                string;
  userId:            string;
  facebookConnection: {
    pageId:                string;
    encryptedAccessToken:  string;
    tokenStatus:           string;
  } | null;
  managedPosts: Array<{
    id:         string;
    externalId: string;
    autoReply:  boolean;
  }>;
}

@Injectable()
export class PostsSyncSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(PostsSyncSchedulerService.name);

  constructor(
    @Inject(PG_BOSS_TOKEN)
    private readonly boss:            PgBoss,
    private readonly prisma:          PrismaService,
    private readonly graphClient:     FacebookGraphClient,
    private readonly encryption:      TokenEncryptionService,
    private readonly sseEmitter:      PostsEventEmitter,
    private readonly aiQueueProducer: AiQueueProducer,
  ) {}

  async onModuleInit(): Promise<void> {
    // Job 1 — full sync, every 5 minutes
    await this.boss.createQueue(SCHEDULER_JOB);
    await this.boss.schedule(SCHEDULER_JOB, CRON_5MIN, {});
    await this.boss.work(SCHEDULER_JOB, async () => { await this.runFallbackSync(); });
    this.logger.log(`Posts fallback sync registered (cron: ${CRON_5MIN})`);

    // Job 2 — lightweight AI recheck, every 10 minutes (NEW)
    await this.boss.createQueue(RECHECK_JOB);
    await this.boss.schedule(RECHECK_JOB, CRON_10MIN, {});
    await this.boss.work(RECHECK_JOB, async () => { await this.runAiRecheck(); });
    this.logger.log(`Posts AI recheck registered (cron: ${CRON_10MIN}, DB-only)`);
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

    const token = this.encryption.decrypt(profile.facebookConnection.encryptedAccessToken);

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
            where:  { id: post.id },
            data:   { commentsCount: { increment: newCount } },
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
    postId:    string,
    externalId: string,
    pageId:    string,
    userId:    string,
    token:     string,
  ): Promise<number> {
    let fbComments;
    try {
      fbComments = await this.graphClient.getPostComments(externalId, token, 50);
    } catch {
      return 0;
    }

    let newCount = 0;

    for (const fc of fbComments) {
      // Resolve author info with fallback chain.
      let authorId   = fc.from?.id?.trim()   || null;
      let authorName = fc.from?.name?.trim() || null;

      if (!authorId || !authorName) {
        try {
          const full = await this.graphClient.getCommentById(fc.id, token);
          authorId   = authorId   ?? full.from?.id?.trim()   ?? null;
          authorName = authorName ?? full.from?.name?.trim() ?? null;
        } catch { /* keep null */ }
      }

      if (!authorName && authorId) {
        try { authorName = await this.graphClient.getUserNameById(authorId, token); }
        catch { /* keep null */ }
      }

      // Resolve page name for comments from the page itself.
      const resolvedAuthorName =
        (authorId && authorId === pageId ? await this.resolvePageName(postId) : null) ||
        authorName ||
        (authorId ? `Compte ${authorId}` : FALLBACK_AUTHOR);

      const pageReply = await this.findPageReply(fc.id, token, pageId);

      const existing = await this.prisma.postComment.findUnique({
        where:  { externalId: fc.id },
        select: { id: true, authorId: true, authorName: true },
      });

      if (existing) {
        // Update: repair fallback author names and sync reply status.
        await this.prisma.postComment.update({
          where: { id: existing.id },
          data: {
            message:    fc.message,
            authorId:   existing.authorId === 'unknown' && authorId ? authorId : existing.authorId,
            authorName: isFallbackName(existing.authorName) ? resolvedAuthorName : existing.authorName,
            ...(pageReply
              ? {
                  isReplied:    true,
                  replyContent: pageReply.message,
                  repliedAt:    new Date(pageReply.created_time),
                  repliedByAi:  false,
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
          externalId:      fc.id,
          authorId:        authorId ?? 'unknown',
          authorName:      resolvedAuthorName,
          authorAvatarUrl: null,
          message:         fc.message,
          commentedAt:     new Date(fc.created_time),
          isReplied:       !!pageReply,
          replyContent:    pageReply?.message ?? null,
          repliedAt:       pageReply ? new Date(pageReply.created_time) : null,
          repliedByAi:     pageReply ? false : null,
          lastSyncedAt:    new Date(),
        },
      });

      newCount++;

      // Emit comment:new for truly new comments.
      this.sseEmitter.commentAdded(userId, postId, {
        id:              created.id,
        postId:          created.postId,
        externalId:      created.externalId,
        authorId:        created.authorId,
        authorName:      created.authorName,
        authorAvatarUrl: null,
        message:         created.message,
        commentedAt:     created.commentedAt.toISOString(),
        isReplied:       created.isReplied,
        replyContent:    created.replyContent,
        repliedAt:       created.repliedAt?.toISOString() ?? null,
        repliedByAi:     created.repliedByAi,
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
    postId:     string,
    externalId: string,
    token:      string,
  ): Promise<void> {
    try {
      const result = await this.graphClient.get<{
        comments?: { summary?: { total_count?: number } };
      }>(`/${externalId}`, {
        access_token: token,
        fields:       'comments.summary(true)',
      });

      const count = result.comments?.summary?.total_count;
      if (typeof count === 'number') {
        await this.prisma.facebookPost.update({
          where: { id: postId },
          data:  { commentsCount: count, lastSyncedAt: new Date() },
        });
      }
    } catch { /* non-fatal */ }
  }

  // ─── Process pending (unreplied) comments — 5-min cycle ──────────────────────

  /**
   * Enqueues a comment.ai_reply job for unreplied comments on this post.
   * `force: false` — spam filter / keyword rules / replyToAllComments still
   * apply. emitNew:false — the comment was already shown to the frontend
   * (either by the real-time webhook, or by syncPostComments() above).
   */
  private async processPendingComments(postId: string): Promise<void> {
    const pending = await this.prisma.postComment.findMany({
      where:   { postId, isReplied: false },
      orderBy: { commentedAt: 'asc' },
      take:    MAX_AI_PER_POST,
      select:  { id: true },
    });

    for (const { id } of pending) {
      await this.aiQueueProducer.enqueueCommentAiReply({ commentId: id, force: false });
    }
  }

  // ─── Lightweight AI recheck — 10-min cycle (NEW, DB-only) ─────────────────────

  /**
   * Safety net: re-enqueues comment.ai_reply for unreplied comments on
   * autoReply-enabled posts, WITHOUT any Graph API calls. This is the
   * lightweight complement to the 5-minute full sync — it exists so that:
   *   - a webhook delivery that failed/was missed, or
   *   - a comment that was spam-filtered BEFORE the user enabled
   *     `replyToAllComments` or added a matching keyword rule,
   * still gets picked up within 10 minutes, with near-zero cost (a single
   * indexed query + enqueue — no Facebook API calls at all).
   *
   * Capped at MAX_RECHECK comments per cycle, oldest first, across ALL
   * businesses — this is a global safety net, not a per-post loop.
   */
  private async runAiRecheck(): Promise<void> {
    const pending = await this.prisma.postComment.findMany({
      where: {
        isReplied: false,
        post: {
          postAiConfig: { autoReply: true },
          businessProfile: {
            facebookConnection: { isActive: true, NOT: { tokenStatus: 'INVALID' } },
          },
        },
      },
      orderBy: { commentedAt: 'asc' },
      take:    MAX_RECHECK,
      select:  { id: true },
    });

    if (pending.length === 0) {
      this.logger.debug('AI recheck — nothing pending');
      return;
    }

    for (const { id } of pending) {
      await this.aiQueueProducer.enqueueCommentAiReply({ commentId: id, force: false });
    }

    this.logger.debug(`AI recheck — re-enqueued ${pending.length} pending comment(s)`);
  }

  // ─── Data loading ────────────────────────────────────────────────────────────

  private async loadProfiles(): Promise<SyncProfile[]> {
    const rows = await this.prisma.businessProfile.findMany({
      where: {
        facebookConnection: { isActive: true, NOT: { tokenStatus: 'INVALID' } },
        facebookPosts:      { some: { postAiConfig: { isNot: null } } },
      },
      select: {
        id:     true,
        userId: true,
        facebookConnection: {
          select: { pageId: true, encryptedAccessToken: true, tokenStatus: true },
        },
        facebookPosts: {
          where:  { postAiConfig: { isNot: null } },
          select: {
            id:         true,
            externalId: true,
            postAiConfig: { select: { autoReply: true } },
          },
        },
      },
    });

    return rows.map((r) => ({
      id:                r.id,
      userId:            r.userId,
      facebookConnection: r.facebookConnection ?? null,
      managedPosts:      r.facebookPosts.map((p) => ({
        id:         p.id,
        externalId: p.externalId,
        autoReply:  p.postAiConfig?.autoReply ?? false,
      })),
    }));
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async resolvePageName(postId: string): Promise<string | null> {
    const post = await this.prisma.facebookPost.findUnique({
      where:   { id: postId },
      include: { businessProfile: { include: { facebookConnection: true } } },
    });
    return post?.businessProfile.facebookConnection?.pageName ?? null;
  }

  private async findPageReply(
    commentExternalId: string,
    token:             string,
    pageId:            string,
  ) {
    try {
      const replies = await this.graphClient.getCommentReplies(commentExternalId, token, 25);
      return replies
        .filter((r) => r.from?.id === pageId && r.message?.trim())
        .sort((a, b) => new Date(a.created_time).getTime() - new Date(b.created_time).getTime())[0]
        ?? null;
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
