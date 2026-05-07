/**
 * @file features/ai/services/data-ai.service.ts
 *
 * DataAI — background AI for conversation summarisation.
 *
 * CHANGES:
 *   - DATA_AI_MODEL and AI_CONTEXT_CONFIG constants replace inlined magic numbers.
 *   - Variable names made more explicit (modelConfig → summaryModelConfig, etc.).
 *   - summaryEveryN fallback now uses AI_CONTEXT_CONFIG.SUMMARY_EVERY_N_MESSAGES.
 *   - temperature fallback now uses DATA_AI_MODEL.TEMPERATURE.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import { AI_CONTEXT_CONFIG, DATA_AI_MODEL } from '../config/ai-models.config.js';
import { OpenRouterClient } from '../clients/openrouter.client.js';
import { PromptBuilderService, type ContextMessage } from './prompt-builder.service.js';

@Injectable()
export class DataAiService {
  private readonly logger = new Logger(DataAiService.name);

  constructor(
    private readonly prisma:           PrismaService,
    private readonly openRouterClient: OpenRouterClient,
    private readonly promptBuilder:    PromptBuilderService,
  ) {}

  // ─── Check threshold and summarise if needed ──────────────────────────────

  /**
   * Called after each AI reply.
   * Counts unsummarised client messages.
   * If the count reaches the threshold, generates and stores a new summary.
   * Fire-and-forget — errors are caught and logged, never re-thrown.
   */
  async maybeGenerateSummary(conversationId: string): Promise<void> {
    try {
      await this.attemptSummaryIfThresholdReached(conversationId);
    } catch (err) {
      this.logger.error(
        `Summary generation failed for conversation=${conversationId}: ${(err as Error).message}`,
      );
    }
  }

  // ─── Core summarisation logic ─────────────────────────────────────────────

  private async attemptSummaryIfThresholdReached(conversationId: string): Promise<void> {
    const conversation = await this.prisma.conversation.findUnique({
      where:   { id: conversationId },
      include: {
        businessProfile: {
          include: { aiConfig: true, aiModelConfig: true },
        },
      },
    });
    if (!conversation) return;

    const aiConfig           = conversation.businessProfile.aiConfig;
    const summaryModelConfig = conversation.businessProfile.aiModelConfig;
    if (!aiConfig || !summaryModelConfig) return;

    // Use DB config, fall back to the central constant
    const summaryEveryNMessages = aiConfig.summaryEveryN
      ?? AI_CONTEXT_CONFIG.SUMMARY_EVERY_N_MESSAGES;

    // Determine the cutoff point for "unsummarised" messages
    const mostRecentSummary = await this.prisma.conversationSummary.findFirst({
      where:   { conversationId },
      orderBy: { createdAt: 'desc' },
    });

    const unsummarisedClientMessageCount = await this.prisma.message.count({
      where: {
        conversationId,
        sender: 'CLIENT',
        ...(mostRecentSummary?.upToMessageId
          ? {
              createdAt: {
                gt: await this.getMessageCreatedAt(mostRecentSummary.upToMessageId),
              },
            }
          : {}),
      },
    });

    if (unsummarisedClientMessageCount < summaryEveryNMessages) return;

    this.logger.log(
      `Generating summary for conversation=${conversationId} ` +
      `(${unsummarisedClientMessageCount} unsummarised messages)`,
    );

    await this.generateSummary(
      conversationId,
      conversation.clientName,
      summaryModelConfig,
      mostRecentSummary?.upToMessageId ?? undefined,
    );
  }

  /**
   * Generates and persists a new conversation summary.
   * Called directly by AiSummaryWorker (via the job queue).
   */
  async generateSummary(
    conversationId:     string,
    clientName:         string | null,
    summaryModelConfig: { summaryModelId: string; summaryMaxTokens: number },
    afterMessageId?:    string,
  ): Promise<void> {
    const cutoffDate = afterMessageId
      ? await this.getMessageCreatedAt(afterMessageId)
      : undefined;

    const messagesToSummarise = await this.prisma.message.findMany({
      where: {
        conversationId,
        ...(cutoffDate ? { createdAt: { gt: cutoffDate } } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });

    if (messagesToSummarise.length === 0) return;

    const contextMessages: ContextMessage[] = messagesToSummarise.map((msg) => ({
      sender:   this.mapSenderToContextRole(msg.sender),
      content:  msg.content,
      imageUrl: msg.imageUrl,
    }));

    const summaryPrompt = this.promptBuilder.buildSummaryPrompt(contextMessages, clientName);

    const summaryResult = await this.openRouterClient.complete({
      model:       summaryModelConfig.summaryModelId,
      messages:    [{ role: 'user', content: summaryPrompt }],
      maxTokens:   summaryModelConfig.summaryMaxTokens,
      // Use the config constant — summaries must be factual, not creative
      temperature: DATA_AI_MODEL.TEMPERATURE,
    });

    const lastSummarisedMessage = messagesToSummarise[messagesToSummarise.length - 1];

    await this.prisma.conversationSummary.create({
      data: {
        conversationId,
        summary:         summaryResult.content,
        upToMessageId:   lastSummarisedMessage.id,
        messagesCovered: messagesToSummarise.filter((m) => m.sender === 'CLIENT').length,
        modelId:         summaryResult.model,
        tokensUsed:      summaryResult.totalTokens,
      },
    });

    this.logger.log(
      `Summary saved for conversation=${conversationId} — ` +
      `tokens=${summaryResult.totalTokens} model=${summaryResult.model}`,
    );
  }

  // ─── Read latest summary ──────────────────────────────────────────────────

  async getLatestSummary(conversationId: string): Promise<string | null> {
    const latestSummary = await this.prisma.conversationSummary.findFirst({
      where:   { conversationId },
      orderBy: { createdAt: 'desc' },
    });
    return latestSummary?.summary ?? null;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async getMessageCreatedAt(messageId: string): Promise<Date> {
    const message = await this.prisma.message.findUnique({
      where:  { id: messageId },
      select: { createdAt: true },
    });
    return message?.createdAt ?? new Date(0);
  }

  private mapSenderToContextRole(dbSender: string): ContextMessage['sender'] {
    if (dbSender === 'CLIENT') return 'client';
    if (dbSender === 'AI')     return 'ai';
    if (dbSender === 'PAGE')   return 'page';
    return 'human';
  }
}
