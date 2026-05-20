/**
 * @file features/facebook-posts/services/posts-sync-scheduler.service.ts
 *
 * 5-minute pg-boss scheduler — fallback for missed real-time events.
 *
 * RESPONSIBILITIES
 * ────────────────
 * Every 5 minutes:
 *   1. For each user with active FB connections and managed posts:
 *      a. Fetch latest comments from Facebook API
 *      b. Insert any new comments into the DB
 *      c. Emit comment:new SSE for each new comment
 *      d. If autoReply is enabled, process pending (unresolved) comments
 *      e. Emit post:updated SSE with new comment counts
 *      f. Emit sync:completed SSE so the frontend knows to refresh
 *
 * This ensures that if a webhook is missed or the SSE connection was
 * down, the frontend eventually shows the correct state.
 *
 * ARCHITECTURE NOTE
 * ─────────────────
 * Uses pg-boss schedule() directly (same pattern as QueueMonitorService).
 * Does NOT add a new entry to QUEUE_JOBS to keep queue.constants.ts clean.
 * The job name uses a double-underscore prefix to mark it as internal.
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
const MAX_COMMENTS_PER_CYCLE = 10; // max AI jobs launched per post per cycle

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

  // ─── Main sync loop ───────────────────────────────────────────────────────

  private async runFallbackSync(): Promise<void> {
    this.logger.debug('Running posts fallback sync cycle');

    const profiles = await this.loadProfilesWithManagedPosts();

    await Promise.allSettled(profiles.map((p) => this.syncProfile(p)));
  }

  private async syncProfile(profile: SyncProfile): Promise<void> {
    if (!profile.facebookConnection) return;
    if (profile.facebookConnection.tokenStatus === 'INVALID') return;

    const token = this.encryption.decrypt(
      profile.facebookConnection.encryptedAccessToken,
    );

    let totalNewComments = 0;

    for (const post of profile.managedPosts) {
      try {
        const newCount = await this.syncPostComments(
          post.id,
          post.externalId,
          profile.userId,
          token,
        );
        totalNewComments += newCount;

        if (newCount > 0) {
          // Update commentsCount and notify frontend
          const updated = await this.prisma.facebookPost.update({
            where: { id: post.id },
            data: { commentsCount: { increment: newCount } },
            select: { commentsCount: true },
          });

          this.sseEmitter.postUpdated(profile.userId, post.id, {
            commentsCount: updated.commentsCount,
          });
        }

        // Fallback AI processing for comments that weren't handled in real-time
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

    // Notify the frontend that a sync cycle is done
    if (totalNewComments > 0) {
      this.sseEmitter.syncCompleted(profile.userId);
      this.logger.log(
        `Fallback sync: +${totalNewComments} comments for profile=${profile.id}`,
      );
    }
  }

  // ─── Comment sync ─────────────────────────────────────────────────────────

  private async syncPostComments(
    postId: string,
    externalId: string,
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
      return 0; // Network / API error — skip silently, next cycle will retry
    }

    let synced = 0;

    for (const fc of fbComments) {
      const exists = await this.prisma.postComment.findUnique({
        where: { externalId: fc.id },
        select: { id: true },
      });
      if (exists) continue;

      const created = await this.prisma.postComment.create({
        data: {
          postId,
          externalId: fc.id,
          authorId: fc.from?.id ?? 'unknown',
          authorName: fc.from?.name ?? 'Anonyme',
          authorAvatarUrl: null,
          message: fc.message,
          commentedAt: new Date(fc.created_time),
          lastSyncedAt: new Date(),
        },
      });

      synced++;

      // Emit SSE so frontend sees new comment without page reload
      this.sseEmitter.commentAdded(userId, postId, {
        id: created.id,
        postId: created.postId,
        externalId: created.externalId,
        authorId: created.authorId,
        authorName: created.authorName,
        authorAvatarUrl: null,
        message: created.message,
        commentedAt: created.commentedAt.toISOString(),
        isReplied: false,
        replyContent: null,
        repliedAt: null,
        repliedByAi: null,
      });
    }

    return synced;
  }

  // ─── AI fallback for unresolved comments ──────────────────────────────────

  /**
   * Process comments that weren't handled by the real-time webhook path.
   * Fire-and-forget per comment to avoid blocking the sync cycle.
   */
  private async processPendingComments(postId: string): Promise<void> {
    const pending = await this.prisma.postComment.findMany({
      where: { postId, isReplied: false },
      orderBy: { commentedAt: 'asc' },
      take: MAX_COMMENTS_PER_CYCLE,
      select: { id: true },
    });

    for (const { id } of pending) {
      void this.commentAi.processNewComment(id).catch((err: unknown) => {
        this.logger.warn(
          `AI fallback failed for comment=${id}: ` +
            (err instanceof Error ? err.message : String(err)),
        );
      });
    }
  }

  // ─── Data loading ─────────────────────────────────────────────────────────

  private async loadProfilesWithManagedPosts(): Promise<SyncProfile[]> {
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
