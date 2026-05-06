/**
 * @file features/ai/workers/ai-reply.worker.ts
 *
 * Worker for ai.reply jobs. Registered on application startup.
 *
 * ARCHITECTURE NOTE — Why this worker lives in AiModule, not QueueModule:
 *   QueueModule exports producers (enqueue-only).
 *   Workers need access to domain services (ReplyAiService, DataAiService).
 *   Putting workers in QueueModule would create:
 *     QueueModule → AiModule → QueueModule  (circular, crashes at boot)
 *   Solution: workers live in the feature module that owns the service they call.
 *
 * Fixes applied:
 *   - job.retrycount (lowercase 'c') — correct pg-boss v10 property name
 *   - catch (err: unknown) — properly narrowed, re-thrown as Error
 *   - localConcurrency used for pg-boss v12 worker concurrency
 *   - OnModuleDestroy: set isShuttingDown flag before workers finish
 */

import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PgBoss, type JobWithMetadata } from 'pg-boss';
import { PG_BOSS_TOKEN } from '../../../features/queue/providers/pg-boss.provider.js';
import { QUEUE_JOBS, type AiReplyPayload } from '../../../features/queue/queue.constants.js';
import { AiQueueProducer } from '../../../features/queue/producers/ai-queue.producer.js';
import { ReplyAiService } from '../services/reply-ai.service.js';

const TEAM_SIZE = 3;

@Injectable()
export class AiReplyWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger     = new Logger(AiReplyWorker.name);
  private isShuttingDown      = false;

  constructor(
    @Inject(PG_BOSS_TOKEN)
    private readonly boss:     PgBoss,
    private readonly replyAi:  ReplyAiService,
    private readonly aiQueue:  AiQueueProducer,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.boss.work<AiReplyPayload>(
      QUEUE_JOBS.AI_REPLY,
      { includeMetadata: true, localConcurrency: TEAM_SIZE },
      async (jobs) => {
        for (const job of jobs) await this.handle(job);
      },
    );
    this.logger.log(
      `Worker registered: ${QUEUE_JOBS.AI_REPLY} (localConcurrency: ${TEAM_SIZE})`,
    );
  }

  onModuleDestroy(): void {
    this.isShuttingDown = true;
  }

  private async handle(job: JobWithMetadata<AiReplyPayload>): Promise<void> {
    if (this.isShuttingDown) return;

    const { conversationId, inboundMessageId, businessProfileId, inboundText, inboundCreatedAt } = job.data;
    const attempt = job.retryCount + 1;

    this.logger.log(
      `Processing ai.reply — conv=${conversationId} job=${job.id} attempt=${attempt}`,
    );

    const start = Date.now();

    try {
      await this.replyAi.replyToConversation(conversationId, {
        inboundMessageId,
        inboundText,
        inboundCreatedAt,
      });

      this.logger.log(
        `ai.reply completed — conv=${conversationId} in ${Date.now() - start}ms`,
      );

      // Enqueue summary after successful reply (low-priority, fire-and-forget via queue)
      await this.aiQueue.enqueueAiSummarize({ conversationId, businessProfileId });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const stack   = err instanceof Error ? err.stack  : undefined;

      this.logger.error(
        `ai.reply failed — conv=${conversationId} attempt=${attempt} ` +
        `in ${Date.now() - start}ms: ${message}`,
        stack,
      );

      // Re-throw as Error so pg-boss marks job FAILED and schedules retry
      throw err instanceof Error ? err : new Error(message);
    }
  }
}
