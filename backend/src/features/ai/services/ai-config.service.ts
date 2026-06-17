/**
 * @file features/ai/services/ai-config.service.ts
 *
 * CRUD operations for AI configuration per business profile.
 *
 * Manages two related models:
 *   AiConfig      — behaviour settings (prompts, tone, escalation, filters)
 *   AiModelConfig — OpenRouter model selection (which model for reply / summary)
 *
 * Both are auto-created with sensible defaults on first access (upsert pattern).
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import { OpenRouterClient } from '../clients/openrouter.client.js';
import type {
  AiConfigResponseDto,
  AiModelConfigResponseDto,
  OpenRouterModelDto,
  UpdateAiConfigDto,
  UpdateAiModelConfigDto,
} from '../dto/ai.dto.js';

@Injectable()
export class AiConfigService {
  constructor(
    private readonly prisma:      PrismaService,
    private readonly openRouter:  OpenRouterClient,
  ) {}

  // ─── Guard helper ─────────────────────────────────────────────────────────

  /** Verify the business profile belongs to this user. */
  private async assertOwnership(businessProfileId: string, userId: string): Promise<void> {
    const profile = await this.prisma.businessProfile.findFirst({
      where: { id: businessProfileId, userId },
    });
    if (!profile) {
      throw new NotFoundException(`Business profile ${businessProfileId} not found.`);
    }
  }

  // ─── AiConfig ─────────────────────────────────────────────────────────────

  /**
   * Get or auto-create the AI config for a business profile.
   * First access will create it with defaults.
   */
  async getAiConfig(
    businessProfileId: string,
    userId: string,
  ): Promise<AiConfigResponseDto> {
    await this.assertOwnership(businessProfileId, userId);

    const config = await this.prisma.aiConfig.upsert({
      where:  { businessProfileId },
      create: { businessProfileId },
      update: {},
    });

    return this.toAiConfigDto(config);
  }

  async updateAiConfig(
    businessProfileId: string,
    userId: string,
    dto: UpdateAiConfigDto,
  ): Promise<AiConfigResponseDto> {
    await this.assertOwnership(businessProfileId, userId);

    const config = await this.prisma.aiConfig.upsert({
      where:  { businessProfileId },
      create: {
        businessProfileId,
        ...(this.buildAiConfigData(dto)),
      },
      update: this.buildAiConfigData(dto),
    });

    return this.toAiConfigDto(config);
  }

  private buildAiConfigData(dto: UpdateAiConfigDto): Record<string, unknown> {
    const data: Record<string, unknown> = {};

    if (dto.tone               !== undefined) data.tone               = dto.tone;
    if (dto.responseStyle      !== undefined) data.responseStyle      = dto.responseStyle;
    if (dto.autoReply          !== undefined) data.autoReply          = dto.autoReply;
    if (dto.systemPrompt       !== undefined) data.systemPrompt       = dto.systemPrompt;
    if (dto.inboxInstructions  !== undefined) data.inboxInstructions  = dto.inboxInstructions;
    if (dto.commentInstructions !== undefined) data.commentInstructions = dto.commentInstructions;
    if (dto.replyLanguage      !== undefined) data.replyLanguage      = dto.replyLanguage;
    if (dto.maxReplyTokens     !== undefined) data.maxReplyTokens     = dto.maxReplyTokens;
    if (dto.replyDelaySeconds  !== undefined) data.replyDelaySeconds  = dto.replyDelaySeconds;
    if (dto.maxContextMessages !== undefined) data.maxContextMessages = dto.maxContextMessages;
    if (dto.summaryEveryN      !== undefined) data.summaryEveryN      = dto.summaryEveryN;
    if (dto.personalizeGreeting !== undefined) data.personalizeGreeting = dto.personalizeGreeting;
    if (dto.blockedKeywords    !== undefined) data.blockedKeywords    = dto.blockedKeywords;
    if (dto.allowedTopics      !== undefined) data.allowedTopics      = dto.allowedTopics;
    if (dto.escalateOnLowConfidence !== undefined) data.escalateOnLowConfidence = dto.escalateOnLowConfidence;
    if (dto.escalationThreshold    !== undefined) data.escalationThreshold     = dto.escalationThreshold;

    return data;
  }

  private toAiConfigDto(config: {
    id: string; businessProfileId: string; tone: string; responseStyle: string;
    autoReply: boolean; systemPrompt: string | null; inboxInstructions: string | null;
    commentInstructions: string | null; replyLanguage: string | null;
    maxReplyTokens: number; replyDelaySeconds: number; maxContextMessages: number;
    summaryEveryN: number; personalizeGreeting: boolean;
    blockedKeywords: unknown; allowedTopics: unknown;
    escalateOnLowConfidence: boolean; escalationThreshold: number;
    updatedAt: Date;
  }): AiConfigResponseDto {
    return {
      id:                     config.id,
      businessProfileId:      config.businessProfileId,
      tone:                   config.tone,
      responseStyle:          config.responseStyle,
      autoReply:              config.autoReply,
      systemPrompt:           config.systemPrompt,
      inboxInstructions:      config.inboxInstructions,
      commentInstructions:    config.commentInstructions,
      replyLanguage:          config.replyLanguage,
      maxReplyTokens:         config.maxReplyTokens,
      replyDelaySeconds:      config.replyDelaySeconds,
      maxContextMessages:     config.maxContextMessages,
      summaryEveryN:          config.summaryEveryN,
      personalizeGreeting:    config.personalizeGreeting,
      blockedKeywords:        (config.blockedKeywords as string[]) ?? [],
      allowedTopics:          (config.allowedTopics as string[]) ?? [],
      escalateOnLowConfidence: config.escalateOnLowConfidence,
      escalationThreshold:    config.escalationThreshold,
      updatedAt:              config.updatedAt,
    };
  }

  // ─── AiModelConfig ────────────────────────────────────────────────────────

  async getModelConfig(
    businessProfileId: string,
    userId: string,
  ): Promise<AiModelConfigResponseDto> {
    await this.assertOwnership(businessProfileId, userId);

    const config = await this.prisma.aiModelConfig.upsert({
      where:  { businessProfileId },
      create: { businessProfileId },
      update: {},
    });

    return this.toModelConfigDto(config);
  }

  async updateModelConfig(
    businessProfileId: string,
    userId: string,
    dto: UpdateAiModelConfigDto,
  ): Promise<AiModelConfigResponseDto> {
    await this.assertOwnership(businessProfileId, userId);

    const data: Record<string, unknown> = {};
    if (dto.replyModelId      !== undefined) data.replyModelId      = dto.replyModelId;
    if (dto.replyModelName    !== undefined) data.replyModelName    = dto.replyModelName;
    if (dto.replyMaxTokens    !== undefined) data.replyMaxTokens    = dto.replyMaxTokens;
    if (dto.replyTemperature  !== undefined) data.replyTemperature  = dto.replyTemperature;
    if (dto.commentModelId    !== undefined) data.commentModelId    = dto.commentModelId;
    if (dto.commentModelName  !== undefined) data.commentModelName  = dto.commentModelName;
    if (dto.commentMaxTokens  !== undefined) data.commentMaxTokens  = dto.commentMaxTokens;
    if (dto.commentTemperature !== undefined) data.commentTemperature = dto.commentTemperature;
    if (dto.summaryModelId    !== undefined) data.summaryModelId    = dto.summaryModelId;
    if (dto.summaryModelName  !== undefined) data.summaryModelName  = dto.summaryModelName;
    if (dto.summaryMaxTokens  !== undefined) data.summaryMaxTokens  = dto.summaryMaxTokens;

    const config = await this.prisma.aiModelConfig.upsert({
      where:  { businessProfileId },
      create: { businessProfileId, ...data },
      update: data,
    });

    return this.toModelConfigDto(config);
  }

  private toModelConfigDto(config: {
    id: string; businessProfileId: string;
    replyModelId: string; replyModelName: string;
    replyMaxTokens: number; replyTemperature: number;
    commentModelId: string | null; commentModelName: string | null;
    commentMaxTokens: number | null; commentTemperature: number | null;
    summaryModelId: string; summaryModelName: string;
    summaryMaxTokens: number; updatedAt: Date;
  }): AiModelConfigResponseDto {
    return {
      id:               config.id,
      businessProfileId: config.businessProfileId,
      replyModelId:     config.replyModelId,
      replyModelName:   config.replyModelName,
      replyMaxTokens:   config.replyMaxTokens,
      replyTemperature: config.replyTemperature,
      commentModelId:   config.commentModelId,
      commentModelName: config.commentModelName,
      commentMaxTokens: config.commentMaxTokens,
      commentTemperature: config.commentTemperature,
      summaryModelId:   config.summaryModelId,
      summaryModelName: config.summaryModelName,
      summaryMaxTokens: config.summaryMaxTokens,
      updatedAt:        config.updatedAt,
    };
  }

  // ─── OpenRouter model catalogue ───────────────────────────────────────────

  /**
   * Proxy to OpenRouter's model list, filtered and formatted for the UI.
   * No caching — results are fresh each time (call sparingly).
   */
  async listAvailableModels(): Promise<OpenRouterModelDto[]> {
    const models = await this.openRouter.listModels();
    return models.map((m) => ({
      id:              m.id,
      name:            m.name,
      contextLength:   m.contextLength,
      promptCostPer1k: m.promptCostPer1k,
      replyCostPer1k:  m.replyCostPer1k,
      isFree:          m.isFree,
    }));
  }

  // ─── Reply logs ───────────────────────────────────────────────────────────

  async getReplyLogs(
    conversationId: string,
    userId: string,
    page = 1,
    pageSize = 20,
  ) {
    // Verify ownership via conversation
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, businessProfile: { userId } },
    });
    if (!conv) throw new NotFoundException(`Conversation ${conversationId} not found.`);

    const [logs, total] = await Promise.all([
      this.prisma.aiReplyLog.findMany({
        where:   { conversationId },
        orderBy: { createdAt: 'desc' },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
      }),
      this.prisma.aiReplyLog.count({ where: { conversationId } }),
    ]);

    return {
      data: logs,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }
}
