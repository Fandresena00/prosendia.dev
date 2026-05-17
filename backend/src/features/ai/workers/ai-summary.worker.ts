/**
 * @file features/ai/workers/ai-summary.worker.ts
 *
 * FIX — Root cause of repeated ERROR "No endpoints found for mistral-small-3.1-24b":
 *
 * The previous version used `upsert({ update: {} })` which:
 *   - Creates with DATA_AI_MODEL defaults if missing ✓
 *   - BUT does NOT update the model ID if the row already exists ✗
 *
 * So once the DB had the old broken model ID, every upsert was a no-op on
 * the model field, and the error repeated indefinitely.
 *
 * Fix:
 *   1. On upsert, always reset summaryModelId to DATA_AI_MODEL.MODEL_ID if
 *      the stored model is no longer in the known-working list.
 *   2. Add a fallback list for summary models, same pattern as reply models.
 *   3. If all models fail, log and skip without rethrowing (summaries are
 *      optional — they improve quality but aren't required for the reply to work).
 */

import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PgBoss, type JobWithMetadata } from 'pg-boss';
import { PrismaService } from '../../../database/prisma.service.js';
import { PG_BOSS_TOKEN } from '../../queue/providers/pg-boss.provider.js';
import { QUEUE_JOBS, type AiSummarizePayload } from '../../queue/queue.constants.js';
import {
  DATA_AI_MODEL,
  SUMMARY_AI_FALLBACK_MODELS,
} from '../config/ai-models.config.js';
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
      // FIX: Update the model ID if it is no longer in the working list.
      // This heals stale rows created when old models were still available.
      const existing = await this.prisma.aiModelConfig.findUnique({
        where:  { businessProfileId },
        select: { summaryModelId: true, summaryMaxTokens: true },
      });

      const isModelBroken = !existing ||
        !SUMMARY_AI_FALLBACK_MODELS.includes(existing.summaryModelId as typeof SUMMARY_AI_FALLBACK_MODELS[number]);

      const modelConfig = await this.prisma.aiModelConfig.upsert({
        where:  { businessProfileId },
        create: {
          businessProfileId,
          summaryModelId:   DATA_AI_MODEL.MODEL_ID,
          summaryModelName: DATA_AI_MODEL.MODEL_NAME,
          summaryMaxTokens: DATA_AI_MODEL.MAX_TOKENS,
        },
        // FIX: Only reset model ID if it's no longer working.
        // This prevents overwriting a valid custom model the user may have set.
        update: isModelBroken ? {
          summaryModelId:   DATA_AI_MODEL.MODEL_ID,
          summaryModelName: DATA_AI_MODEL.MODEL_NAME,
        } : {},
        select: { summaryModelId: true, summaryMaxTokens: true },
      });

      if (isModelBroken) {
        this.logger.warn(
          `Reset stale summaryModelId for profile=${businessProfileId} → ${DATA_AI_MODEL.MODEL_ID}`,
        );
      }

      const conversation = await this.prisma.conversation.findUnique({
        where:  { id: conversationId },
        select: { clientName: true },
      });

      if (!conversation) {
        this.logger.warn(`Conversation ${conversationId} not found — ai.summarize skipped`);
        return;
      }

      // Try primary model, then fallbacks
      const modelsToTry = [
        modelConfig.summaryModelId,
        ...SUMMARY_AI_FALLBACK_MODELS.filter((m) => m !== modelConfig.summaryModelId),
      ];

      let succeeded = false;
      for (const modelId of modelsToTry) {
        try {
          await this.dataAi.generateSummary(
            conversationId,
            conversation.clientName,
            {
              summaryModelId:   modelId,
              summaryMaxTokens: modelConfig.summaryMaxTokens,
            },
          );
          succeeded = true;
          break;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            `Summary model ${modelId} failed for conv=${conversationId}: ${msg}` +
            (modelsToTry.indexOf(modelId) < modelsToTry.length - 1 ? ' — trying next' : ''),
          );
        }
      }

      if (!succeeded) {
        // Summaries are optional — don't rethrow, don't block the pipeline
        this.logger.warn(
          `All summary models failed for conv=${conversationId}. Summary skipped (non-fatal).`,
        );
        return;
      }

      this.logger.debug(`ai.summarize completed — conv=${conversationId}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `ai.summarize unexpected error — conv=${conversationId}: ${message}`,
        err instanceof Error ? err.stack : undefined,
      );
      // Re-throw unexpected errors (DB failures, etc.) so pg-boss retries
      throw err instanceof Error ? err : new Error(message);
    }
  }
}
