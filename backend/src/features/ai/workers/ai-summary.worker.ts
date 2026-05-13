/**
 * @file features/ai/workers/ai-summary.worker.ts
 *
 * FIX: Auto-create AiModelConfig with defaults when missing.
 *
 * Previously: if no AiModelConfig row existed for a profile, the worker
 * logged a WARN and skipped silently — on every summary job indefinitely.
 *
 * New behaviour: if the config is missing, create it with the central
 * defaults from ai-models.config.ts, then proceed with summarisation.
 * This eliminates the repeated WARN and unblocks the summarisation pipeline
 * without requiring manual DB intervention or an API call to create the config.
 */

import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PgBoss, type JobWithMetadata } from 'pg-boss';
import { PrismaService } from '../../../database/prisma.service.js';
import { PG_BOSS_TOKEN } from '../../queue/providers/pg-boss.provider.js';
import { QUEUE_JOBS, type AiSummarizePayload } from '../../queue/queue.constants.js';
import { DATA_AI_MODEL } from '../config/ai-models.config.js';
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

    this.logger.debug(`Processing ai.summarize — conv=${conversationId} job=${job.id}`);

    try {
      // FIX: Auto-create AiModelConfig with defaults if missing.
      // Uses upsert — no-op if already exists, creates with defaults otherwise.
      const modelConfig = await this.prisma.aiModelConfig.upsert({
        where:  { businessProfileId },
        create: {
          businessProfileId,
          // Use the central constants as defaults — same values as the Prisma schema defaults
          summaryModelId:   DATA_AI_MODEL.MODEL_ID,
          summaryModelName: DATA_AI_MODEL.MODEL_NAME,
          summaryMaxTokens: DATA_AI_MODEL.MAX_TOKENS,
        },
        update: {},
        select: { summaryModelId: true, summaryMaxTokens: true },
      });

      const conversation = await this.prisma.conversation.findUnique({
        where:  { id: conversationId },
        select: { clientName: true },
      });

      if (!conversation) {
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
