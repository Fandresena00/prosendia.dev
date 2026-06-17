/**
 * @file features/facebook-posts/workers/comment-ai-reply.worker.ts
 *
 * Worker for `comment.ai_reply` jobs — registered on application startup.
 *
 * WHY THIS WORKER EXISTS
 * ──────────────────────
 * Before this revision, comments were ONLY processed by
 * PostsSyncSchedulerService's 5-minute cron (and only if they passed the
 * spam-score filter). Real comments could sit unanswered for a long time —
 * up to (and sometimes beyond, if a cycle was slow/skipped) 5 minutes,
 * reported in production as "3 hours for a single comment".
 *
 * Now, BOTH:
 *   - WebhookService.handleFeedChange() (real-time, on new comments), and
 *   - PostsSyncSchedulerService's lightweight 10-minute recheck
 *     (catches anything the webhook missed)
 * enqueue a `comment.ai_reply` job. THIS worker picks it up and calls
 * PostCommentAiService.processNewComment().
 *
 * INSTANT RESPONSE — pollingIntervalSeconds
 * ──────────────────────────────────────────
 * pg-boss's default polling interval is too slow for a "real-time" feel.
 * This worker explicitly sets `pollingIntervalSeconds: 2` so a job enqueued
 * by the webhook is picked up within ~2 seconds — turning "3 hours" into
 * "a couple of seconds" for the common case.
 *
 * ARCHITECTURE NOTE — Why this worker lives in FacebookPostsModule, not
 * QueueModule or FacebookModule:
 *   It depends on PostCommentAiService (FacebookPostsModule). Putting it in
 *   QueueModule or FacebookModule would create a circular dependency
 *   (same reasoning as AiReplyWorker / FacebookSyncWorker).
 *
 * Fixes applied (matching existing worker conventions):
 *   - job.retryCount (lowercase 'c') — correct pg-boss v10 property name
 *   - catch (err: unknown) — properly narrowed, re-thrown as Error so
 *     pg-boss marks the job FAILED and retries per JOB_OPTIONS.COMMENT_AI_REPLY
 *   - localConcurrency for pg-boss v12 worker concurrency
 *   - OnModuleDestroy: stop accepting new work during shutdown
 */

import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PgBoss, type JobWithMetadata } from 'pg-boss';
import { PG_BOSS_TOKEN } from '../../../queue/providers/pg-boss.provider.js';
import {
  CommentAiReplyPayload,
  QUEUE_JOBS,
} from '../../../queue/queue.constants.js';
import { PostCommentAiService } from '../services/post-comment-ai.service.js';

const TEAM_SIZE = 3;

/**
 * How often pg-boss checks for new `comment.ai_reply` jobs.
 * Lower = more "instant" feeling replies, at the cost of slightly more
 * frequent DB polling. 2s is a good balance for a chat-adjacent feature.
 */
const POLLING_INTERVAL_SECONDS = 2;

@Injectable()
export class CommentAiReplyWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CommentAiReplyWorker.name);
  private isShuttingDown = false;

  constructor(
    @Inject(PG_BOSS_TOKEN)
    private readonly boss: PgBoss,
    private readonly commentAi: PostCommentAiService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.boss.work<CommentAiReplyPayload>(
      QUEUE_JOBS.COMMENT_AI_REPLY,
      {
        includeMetadata: true,
        localConcurrency: TEAM_SIZE,
        pollingIntervalSeconds: POLLING_INTERVAL_SECONDS,
      },
      async (jobs) => {
        for (const job of jobs) await this.handle(job);
      },
    );
    this.logger.log(
      `Worker registered: ${QUEUE_JOBS.COMMENT_AI_REPLY} ` +
        `(localConcurrency: ${TEAM_SIZE}, pollingIntervalSeconds: ${POLLING_INTERVAL_SECONDS})`,
    );
  }

  onModuleDestroy(): void {
    this.isShuttingDown = true;
  }

  private async handle(
    job: JobWithMetadata<CommentAiReplyPayload>,
  ): Promise<void> {
    if (this.isShuttingDown) return;

    const { commentId, force } = job.data;
    const attempt = job.retryCount + 1;

    this.logger.debug(
      `Processing comment.ai_reply — comment=${commentId} job=${job.id} ` +
        `attempt=${attempt} force=${force ?? false}`,
    );

    try {
      // emitNew=false: the webhook (or 10-min recheck) already emitted
      // `comment:new` when the comment was first seen — avoid duplicate
      // SSE events for the same comment.
      const result = await this.commentAi.processNewComment(commentId, {
        emitNew: false,
        force: force ?? false,
      });

      if (result.success) {
        this.logger.log(
          `comment.ai_reply completed — comment=${commentId} ` +
            (result.ruleMatched ? '(rule-based, 0 credits)' : '(AI-generated)'),
        );
      } else {
        // Not an error — the service already logged/persisted the reason
        // (autoreply off, spam-filtered, no credits, etc.). Don't retry.
        this.logger.debug(
          `comment.ai_reply skipped — comment=${commentId} reason=${result.reason}`,
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;

      this.logger.error(
        `comment.ai_reply failed — comment=${commentId} attempt=${attempt}: ${message}`,
        stack,
      );

      // Re-throw as Error so pg-boss marks the job FAILED and retries
      // per JOB_OPTIONS.COMMENT_AI_REPLY (3 retries, exponential backoff).
      throw err instanceof Error ? err : new Error(message);
    }
  }
}
