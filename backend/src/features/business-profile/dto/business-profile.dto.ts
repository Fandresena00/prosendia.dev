/**
 * @file features/business-profile/dto/business-profile.dto.ts
 *
 * DTOs for the business profile feature.
 * One PUT request updates BOTH the BusinessProfile AND its AiConfig atomically.
 * The frontend never needs to call two separate endpoints.
 */

import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

// ─── Enums (mirror Prisma) ────────────────────────────────────────────────────

export enum BusinessTypeDto {
  HAIR_SALON = 'HAIR_SALON',
  RESTAURANT = 'RESTAURANT',
  FREELANCER = 'FREELANCER',
  SHOP       = 'SHOP',
  SERVICE    = 'SERVICE',
  OTHER      = 'OTHER',
}

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

// ─── Update ───────────────────────────────────────────────────────────────────

/**
 * Sent by the frontend on every "Sauvegarder" click.
 * All fields optional — only provided keys are updated.
 */
export class UpdateBusinessProfileDto {
  // ── BusinessProfile fields ──
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100)
  name?: string;

  @IsOptional() @IsEnum(BusinessTypeDto)
  businessType?: BusinessTypeDto;

  @IsOptional() @IsString() @MaxLength(1000)
  description?: string;

  // ── AiConfig fields ──
  @IsOptional() @IsEnum(ToneDto)
  tone?: ToneDto;

  @IsOptional() @IsEnum(ResponseStyleDto)
  responseStyle?: ResponseStyleDto;

  @IsOptional() @IsBoolean()
  autoReply?: boolean;

  /** Maps to AiConfig.systemPrompt — the main AI identity prompt. */
  @IsOptional() @IsString() @MaxLength(4000)
  aiInstructions?: string;

  /** Maps to AiConfig.commentInstructions — used when replying to post comments. */
  @IsOptional() @IsString() @MaxLength(2000)
  commentInstructions?: string;
}

// ─── Response ─────────────────────────────────────────────────────────────────

/** Reference image as exposed to the frontend. */
export interface ReferenceImageDto {
  id:          string;
  url:         string;
  description: string;
  sortOrder:   number;
}

/** Reference preset (ChatResource) as exposed to the frontend. */
export interface ReferencePresetDto {
  id:          string;
  name:        string;
  description: string;
  images:      ReferenceImageDto[];
}

/**
 * Full profile + AI config response.
 * Returned by GET /business-profiles/:id and PUT /business-profiles/:id.
 */
export interface BusinessProfileResponseDto {
  // ── BusinessProfile ──
  id:           string;
  name:         string;
  businessType: string;
  description:  string | null;

  // ── AiConfig ──
  tone:                string;
  responseStyle:       string;
  autoReply:           boolean;
  aiInstructions:      string | null;   // AiConfig.systemPrompt
  commentInstructions: string | null;   // AiConfig.commentInstructions

  // ── Facebook connection (for the page selector) ──
  facebookPageId:   string | null;
  facebookPageName: string | null;

  // ── Reference images ──
  referencePresets: ReferencePresetDto[];

  updatedAt: Date;
}

/** Lightweight summary for the profile switcher dropdown. */
export interface BusinessProfileSummaryDto {
  id:               string;
  name:             string;
  businessType:     string;
  facebookPageId:   string | null;
  facebookPageName: string | null;
  autoReply:        boolean;
  updatedAt:        Date;
}
