/**
 * @file features/ai/workers/ai-summary.worker.ts
 *
 * Worker for ai.summarize jobs.
 * Lives in AiModule (see architecture note in ai-reply.worker.ts).
 *
 * Fixes applied:
 *   - Moved out of QueueModule to avoid circular dependency
 *   - catch (err: unknown) properly typed
 *   - Prisma select added for clientName to avoid fetching full record
 *   - Non-fatal config-missing case returns without throwing (no retry needed)
 */

import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PgBoss, type JobWithMetadata } from 'pg-boss';
import { PrismaService } from '../../../database/prisma.service.js';
import { PG_BOSS_TOKEN } from '../../queue/providers/pg-boss.provider.js';
import { QUEUE_JOBS, type AiSummarizePayload } from '../../queue/queue.constants.js';
import { DataAiService } from '../services/data-ai.service.js';

const TEAM_SIZE = 5;

@Injectable()
export class AiSummaryWorker implements OnModuleInit {
  private readonly logger = new Logger(AiSummaryWorker.name);

  constructor(
    @Inject(PG_BOSS_TOKEN)
    private readonly boss:   PgBoss,
    private readonly dataAi: DataAiService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.boss.work<AiSummarizePayload>(
      QUEUE_JOBS.AI_SUMMARIZE,
      { includeMetadata: true, localConcurrency: TEAM_SIZE },
      async (jobs) => {
        for (const job of jobs) await this.handle(job);
      },
    );
    this.logger.log(
      `Worker registered: ${QUEUE_JOBS.AI_SUMMARIZE} (localConcurrency: ${TEAM_SIZE})`,
    );
  }

  private async handle(job: JobWithMetadata<AiSummarizePayload>): Promise<void> {
    const { conversationId, businessProfileId } = job.data;

    this.logger.debug(
      `Processing ai.summarize — conv=${conversationId} job=${job.id}`,
    );

    try {
      const modelConfig = await this.prisma.aiModelConfig.findUnique({
        where:  { businessProfileId },
        select: { summaryModelId: true, summaryMaxTokens: true },
      });

      if (!modelConfig) {
        // Config doesn't exist — skip without retrying (config issue, not transient)
        this.logger.warn(
          `No AiModelConfig for profile=${businessProfileId} — ai.summarize skipped`,
        );
        return;
      }

      const conversation = await this.prisma.conversation.findUnique({
        where:  { id: conversationId },
        select: { clientName: true },
      });

      if (!conversation) {
        // Conversation deleted — skip without retrying
        this.logger.warn(
          `Conversation ${conversationId} not found — ai.summarize skipped`,
        );
        return;
      }

      await this.dataAi.generateSummary(
        conversationId,
        conversation.clientName,
        {
          summaryModelId:   modelConfig.summaryModelId,
          summaryMaxTokens: modelConfig.summaryMaxTokens,
        },
      );

      this.logger.debug(`ai.summarize completed — conv=${conversationId}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `ai.summarize failed — conv=${conversationId}: ${message}`,
        err instanceof Error ? err.stack : undefined,
      );
      throw err instanceof Error ? err : new Error(message);
    }
  }
}
