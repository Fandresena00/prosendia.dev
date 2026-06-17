/**
 * @file features/queue/producers/ai-queue.producer.ts
 *
 * Enqueues AI jobs with deduplication.
 *
 * Fixes applied:
 *   - singletonKey built via buildSingletonKey() — plain string, not function
 *   - boss.send() return type is Promise<string> in pg-boss v10 (not string | null)
 *   - Error handling: catch (err: unknown) → toErrorMessage() helper
 *   - Removed singletonSeconds (not a valid pg-boss v10 option)
 *
 * CHANGE — enqueueCommentAiReply()
 * ──────────────────────────────────
 * New producer method for the COMMENT_AI_REPLY job. Used by:
 *   - WebhookService.handleFeedChange() → real-time AI reply on new comments
 *   - PostsSyncSchedulerService (10-min recheck) → catch up on missed comments
 *
 * Deduplicated per commentId — if both the webhook and the 10-min recheck
 * try to enqueue a reply for the same comment before either has run,
 * pg-boss drops the duplicate (singletonKey).
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { PgBoss } from 'pg-boss';
import {
  JOB_OPTIONS,
  QUEUE_JOBS,
  buildSingletonKey,
  type AiReplyPayload,
  type AiSummarizePayload,
  type CommentAiReplyPayload,
} from '../queue.constants.js';
import { PG_BOSS_TOKEN } from '../providers/pg-boss.provider.js';

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

@Injectable()
export class AiQueueProducer {
  private readonly logger = new Logger(AiQueueProducer.name);

  constructor(
    @Inject(PG_BOSS_TOKEN)
    private readonly boss: PgBoss,
  ) {}

  /**
   * Enqueue a ReplyAI job.
   * Deduplicated per conversationId — only one pending reply job at a time.
   */
  async enqueueAiReply(payload: AiReplyPayload): Promise<string | null> {
    const opts = JOB_OPTIONS.AI_REPLY;

    try {
      const jobId = await this.boss.send(QUEUE_JOBS.AI_REPLY, payload, {
        retryLimit:      opts.retryLimit,
        retryDelay:      opts.retryDelay,
        retryBackoff:    opts.retryBackoff,
        expireInSeconds: opts.expireInSeconds,
        singletonKey:    buildSingletonKey(
          QUEUE_JOBS.AI_REPLY,
          payload.inboundMessageId
            ? `${payload.conversationId}:${payload.inboundMessageId}`
            : payload.conversationId,
        ),
        priority:        opts.priority,
      });

      if (jobId) {
        this.logger.log(
          `Enqueued ai.reply — conv=${payload.conversationId} job=${jobId}`,
        );
      } else {
        this.logger.debug(
          `ai.reply deduplicated — conv=${payload.conversationId} (already pending)`,
        );
      }

      return jobId;
    } catch (err: unknown) {
      this.logger.error(
        `Failed to enqueue ai.reply for conv=${payload.conversationId}: ${toErrorMessage(err)}`,
      );
      return null;
    }
  }

  /**
   * Enqueue a DataAI summarisation job.
   * Low-priority, deduplicated per conversationId.
   */
  async enqueueAiSummarize(payload: AiSummarizePayload): Promise<string | null> {
    const opts = JOB_OPTIONS.AI_SUMMARIZE;

    try {
      const jobId = await this.boss.send(QUEUE_JOBS.AI_SUMMARIZE, payload, {
        retryLimit:      opts.retryLimit,
        retryDelay:      opts.retryDelay,
        retryBackoff:    opts.retryBackoff,
        expireInSeconds: opts.expireInSeconds,
        singletonKey:    buildSingletonKey(QUEUE_JOBS.AI_SUMMARIZE, payload.conversationId),
        priority:        opts.priority,
      });

      if (jobId) {
        this.logger.debug(
          `Enqueued ai.summarize — conv=${payload.conversationId} job=${jobId}`,
        );
      }

      return jobId;
    } catch (err: unknown) {
      // Summarisation failure is non-fatal — log and continue
      this.logger.warn(
        `Failed to enqueue ai.summarize for conv=${payload.conversationId}: ${toErrorMessage(err)}`,
      );
      return null;
    }
  }

  /**
   * Enqueue a comment AI reply job.
   *
   * Deduplicated per commentId — only one pending AI reply job per comment
   * at a time, regardless of whether it was triggered by the webhook
   * (real-time) or the 10-minute recheck cron.
   *
   * @param payload.force  When true (manual "IA" button), the worker bypasses
   *                        the spam-score filter for this comment.
   */
  async enqueueCommentAiReply(payload: CommentAiReplyPayload): Promise<string | null> {
    const opts = JOB_OPTIONS.COMMENT_AI_REPLY;

    try {
      const jobId = await this.boss.send(QUEUE_JOBS.COMMENT_AI_REPLY, payload, {
        retryLimit:      opts.retryLimit,
        retryDelay:      opts.retryDelay,
        retryBackoff:    opts.retryBackoff,
        expireInSeconds: opts.expireInSeconds,
        singletonKey:    buildSingletonKey(QUEUE_JOBS.COMMENT_AI_REPLY, payload.commentId),
        priority:        opts.priority,
      });

      if (jobId) {
        this.logger.log(
          `Enqueued comment.ai_reply — comment=${payload.commentId} job=${jobId} force=${payload.force ?? false}`,
        );
      } else {
        this.logger.debug(
          `comment.ai_reply deduplicated — comment=${payload.commentId} (already pending)`,
        );
      }

      return jobId;
    } catch (err: unknown) {
      this.logger.error(
        `Failed to enqueue comment.ai_reply for comment=${payload.commentId}: ${toErrorMessage(err)}`,
      );
      return null;
    }
  }
}
