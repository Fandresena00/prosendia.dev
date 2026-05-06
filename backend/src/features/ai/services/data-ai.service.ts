/**
 * @file features/ai/services/data-ai.service.ts
 *
 * DataAI — lightweight background AI for conversation summarisation.
 *
 * Purpose:
 *   Compress conversation history into a short summary so that ReplyAI never
 *   needs to read the full message list. This keeps token usage low even for
 *   long-running conversations.
 *
 * Trigger:
 *   Called by ReplyAI after every reply, when the number of new client messages
 *   since the last summary reaches `summaryEveryN` (default: 10).
 *
 * Model:
 *   Uses a cheap/fast model (e.g. Llama 3.1 8B free) — quality requirements
 *   are low because the summary is only read by another AI, not a human.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import { OpenRouterClient } from '../clients/openrouter.client.js';
import { PromptBuilderService, type ContextMessage } from './prompt-builder.service.js';

@Injectable()
export class DataAiService {
  private readonly logger = new Logger(DataAiService.name);

  constructor(
    private readonly prisma:   PrismaService,
    private readonly openRouter: OpenRouterClient,
    private readonly builder:  PromptBuilderService,
  ) {}

  // ─── Check and summarise ──────────────────────────────────────────────────

  /**
   * Called after each AI reply.
   * Counts unsummarised client messages. If ≥ summaryEveryN, generates a new summary.
   * Fire-and-forget — errors are caught and logged, never re-thrown.
   */
  async maybeGenerateSummary(conversationId: string): Promise<void> {
    try {
      await this.attemptSummary(conversationId);
    } catch (err) {
      this.logger.error(
        `Summary generation failed for conv ${conversationId}: ${(err as Error).message}`,
      );
    }
  }

  // ─── Core summarisation ───────────────────────────────────────────────────

  private async attemptSummary(conversationId: string): Promise<void> {
    const conversation = await this.prisma.conversation.findUnique({
      where:   { id: conversationId },
      include: { businessProfile: { include: { aiConfig: true, aiModelConfig: true } } },
    });
    if (!conversation) return;

    const aiConfig    = conversation.businessProfile.aiConfig;
    const modelConfig = conversation.businessProfile.aiModelConfig;
    if (!aiConfig || !modelConfig) return;

    const summaryEveryN = aiConfig.summaryEveryN ?? 10;

    // Find the last summary to know where we left off
    const lastSummary = await this.prisma.conversationSummary.findFirst({
      where:   { conversationId },
      orderBy: { createdAt: 'desc' },
    });

    // Count client messages that have NOT been summarised yet
    const unsummarisedCount = await this.prisma.message.count({
      where: {
        conversationId,
        sender: 'CLIENT',
        ...(lastSummary?.upToMessageId
          ? { createdAt: { gt: await this.getMessageDate(lastSummary.upToMessageId) } }
          : {}),
      },
    });

    if (unsummarisedCount < summaryEveryN) return;

    this.logger.log(
      `Generating summary for conv ${conversationId} (${unsummarisedCount} unsummarised msgs)`,
    );

    await this.generateSummary(conversationId, conversation.clientName, modelConfig, lastSummary?.upToMessageId ?? undefined);
  }

  async generateSummary(
    conversationId:   string,
    clientName:       string | null,
    modelConfig:      { summaryModelId: string; summaryMaxTokens: number },
    afterMessageId?:  string,
  ): Promise<void> {
    // Fetch messages to summarise (everything after the last summary)
    const afterDate = afterMessageId
      ? await this.getMessageDate(afterMessageId)
      : undefined;

    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        ...(afterDate ? { createdAt: { gt: afterDate } } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });

    if (messages.length === 0) return;

    const contextMessages: ContextMessage[] = messages.map((m) => ({
      sender:   this.mapSender(m.sender),
      content:  m.content,
      imageUrl: m.imageUrl,
    }));

    const prompt = this.builder.buildSummaryPrompt(contextMessages, clientName);

    const result = await this.openRouter.complete({
      model:       modelConfig.summaryModelId,
      messages:    [{ role: 'user', content: prompt }],
      maxTokens:   modelConfig.summaryMaxTokens,
      temperature: 0.3, // Low temperature — summaries must be factual
    });

    const lastMsg = messages[messages.length - 1];

    await this.prisma.conversationSummary.create({
      data: {
        conversationId,
        summary:         result.content,
        upToMessageId:   lastMsg.id,
        messagesCovered: messages.filter((m) => m.sender === 'CLIENT').length,
        modelId:         result.model,
        tokensUsed:      result.totalTokens,
      },
    });

    this.logger.log(
      `Summary saved for conv ${conversationId} — ` +
      `${result.totalTokens}t, model=${result.model}`,
    );
  }

  // ─── Get latest summary ───────────────────────────────────────────────────

  async getLatestSummary(conversationId: string): Promise<string | null> {
    const summary = await this.prisma.conversationSummary.findFirst({
      where:   { conversationId },
      orderBy: { createdAt: 'desc' },
    });
    return summary?.summary ?? null;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async getMessageDate(messageId: string): Promise<Date> {
    const msg = await this.prisma.message.findUnique({ where: { id: messageId } });
    return msg?.createdAt ?? new Date(0);
  }

  private mapSender(sender: string): ContextMessage['sender'] {
    if (sender === 'CLIENT') return 'client';
    if (sender === 'AI')     return 'ai';
    if (sender === 'PAGE')   return 'page';
    return 'human';
  }
}
