/**
 * @file features/ai/dto/ai.dto.ts
 *
 * All DTOs for the AI feature:
 *   - AiConfigDto   : read/update AI behaviour settings (prompts, tone, thresholds)
 *   - AiModelDto    : read/update OpenRouter model selection
 *   - AiReplyLogDto : read AI reply audit logs
 *   - OpenRouterModelDto : model catalogue item returned to the frontend
 */

import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

// ─── Enums (mirrored from Prisma for validation) ──────────────────────────────

export enum ToneDto {
  FRIENDLY     = 'FRIENDLY',
  PROFESSIONAL = 'PROFESSIONAL',
  FORMAL       = 'FORMAL',
}

export enum ResponseStyleDto {
  SHORT    = 'SHORT',
  DETAILED = 'DETAILED',
  MIXED    = 'MIXED',
}

// ─── AiConfig ─────────────────────────────────────────────────────────────────

export class UpdateAiConfigDto {
  @IsOptional() @IsEnum(ToneDto)          tone?:            ToneDto;
  @IsOptional() @IsEnum(ResponseStyleDto) responseStyle?:   ResponseStyleDto;
  @IsOptional() @IsBoolean()              autoReply?:       boolean;

  @IsOptional() @IsString() @MaxLength(4000) systemPrompt?:        string;
  @IsOptional() @IsString() @MaxLength(2000) inboxInstructions?:   string;
  @IsOptional() @IsString() @MaxLength(2000) commentInstructions?: string;
  @IsOptional() @IsString() @MaxLength(10)   replyLanguage?:       string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(50)  @Max(1000) maxReplyTokens?:      number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)   @Max(60)   replyDelaySeconds?:   number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(4)   @Max(30)   maxContextMessages?:  number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(5)   @Max(50)   summaryEveryN?:       number;
  @IsOptional() @IsBoolean()                            personalizeGreeting?: boolean;

  @IsOptional() @IsArray() @IsString({ each: true }) blockedKeywords?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) allowedTopics?:   string[];

  @IsOptional() @IsBoolean() escalateOnLowConfidence?: boolean;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(1) escalationThreshold?: number;
}

export class AiConfigResponseDto {
  id!:                    string;
  businessProfileId!:     string;
  tone!:                  string;
  responseStyle!:         string;
  autoReply!:             boolean;
  systemPrompt!:          string | null;
  inboxInstructions!:     string | null;
  commentInstructions!:   string | null;
  replyLanguage!:         string | null;
  maxReplyTokens!:        number;
  replyDelaySeconds!:     number;
  maxContextMessages!:    number;
  summaryEveryN!:         number;
  personalizeGreeting!:   boolean;
  blockedKeywords!:       string[];
  allowedTopics!:         string[];
  escalateOnLowConfidence!: boolean;
  escalationThreshold!:   number;
  updatedAt!:             Date;
}

// ─── AiModelConfig ────────────────────────────────────────────────────────────

export class UpdateAiModelConfigDto {
  /** OpenRouter model ID for customer-facing replies (Messenger inbox) */
  @IsOptional() @IsString() replyModelId?:     string;
  @IsOptional() @IsString() replyModelName?:   string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(50) @Max(2000) replyMaxTokens?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(2)  replyTemperature?: number;

  /**
   * OpenRouter model override for Facebook post comment replies.
   * Distinct from replyModelId (Messenger inbox) — see
   * features/ai/config/ai-models.config.ts COMMENT_AI_MODEL.
   * Null/unset = use the COMMENT_AI_MODEL default.
   */
  @IsOptional() @IsString() commentModelId?:    string;
  @IsOptional() @IsString() commentModelName?:  string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(50) @Max(1000) commentMaxTokens?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(2)  commentTemperature?: number;

  /** OpenRouter model ID for conversation summarisation */
  @IsOptional() @IsString() summaryModelId?:   string;
  @IsOptional() @IsString() summaryModelName?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(50) @Max(500)  summaryMaxTokens?: number;
}

export class AiModelConfigResponseDto {
  id!:               string;
  businessProfileId!: string;
  replyModelId!:     string;
  replyModelName!:   string;
  replyMaxTokens!:   number;
  replyTemperature!: number;
  commentModelId!:   string | null;
  commentModelName!: string | null;
  commentMaxTokens!: number | null;
  commentTemperature!: number | null;
  summaryModelId!:   string;
  summaryModelName!: string;
  summaryMaxTokens!: number;
  updatedAt!:        Date;
}

// ─── OpenRouter model catalogue ────────────────────────────────────────────────

export class OpenRouterModelDto {
  id!:              string;
  name!:            string;
  contextLength!:   number;
  promptCostPer1k!: number;
  replyCostPer1k!:  number;
  isFree!:          boolean;
}

// ─── AI Reply Log ─────────────────────────────────────────────────────────────

export class AiReplyLogResponseDto {
  id!:               string;
  conversationId!:   string;
  inboundMessageId!: string | null;
  decision!:         string;
  modelId!:          string;
  promptTokens!:     number;
  replyTokens!:      number;
  latencyMs!:        number;
  replyText!:        string | null;
  escalationReason!: string | null;
  confidence!:       number | null;
  errorMessage!:     string | null;
  createdAt!:        Date;
}

// ─── Conversation summary ──────────────────────────────────────────────────────

export class ConversationSummaryResponseDto {
  id!:              string;
  conversationId!:  string;
  summary!:         string;
  messagesCovered!: number;
  modelId!:         string;
  tokensUsed!:      number;
  createdAt!:       Date;
}
