/**
 * @file features/billing/dto/billing.dto.ts
 */

import {
  IsEnum,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

// ─── Request ──────────────────────────────────────────────────────────────────

export enum PlanIdDto {
  FREE    = 'FREE',
  STARTER = 'STARTER',
  PRO     = 'PRO',
  CUSTOM  = 'CUSTOM',
}

export enum PaymentProviderDto {
  MVOLA        = 'MVOLA',
  ORANGE_MONEY = 'ORANGE_MONEY',
  AIRTEL_MONEY = 'AIRTEL_MONEY',
}

export class InitiatePaymentDto {
  @IsString()
  @IsNotEmpty()
  plan!: string;

  @IsEnum(PaymentProviderDto)
  provider!: PaymentProviderDto;

  /** Format: +261XXXXXXXXX */
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+261[0-9]{9}$/, {
    message: 'Le numéro doit être au format +261XXXXXXXXX (ex: +261341234567)',
  })
  payerPhone!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  payerName!: string;
}

// ─── Response ─────────────────────────────────────────────────────────────────

export interface PlanFeatureDto {
  id:                 string;
  name:               string;
  priceAriary:        number | null;
  durationDays:       number;
  credits:            number | null;
  maxPages:           number | null;
  maxManagedPosts:    number | null;
  maxReferenceImages: number | null;
  popular?:           boolean;
  supportPriority:    boolean;
  advancedStats:      boolean;
  features:           string[];
}

export interface CreditStatusDto {
  plan:               string;
  planName:           string;
  creditBalance:      number;
  creditsGranted:     number | null;
  usagePercent:       number;          // % consommé
  remainingPercent:   number;          // % restant
  isExpired:          boolean;
  isLow:              boolean;         // < 20 % restant
  isCritical:         boolean;         // < 100 crédits
  isDepleted:         boolean;         // 0 crédits
  periodEnd:          Date | null;
  daysRemaining:      number | null;
  maxPages:           number | null;
  maxManagedPosts:    number | null;
  maxReferenceImages: number | null;
}

export interface InitiatePaymentResponseDto {
  paymentId:   string;
  paymentLink: string;
  amount:      number;
  expiresAt:   Date;
  plan:        string;
  provider:    string;
}

export interface PaymentHistoryItemDto {
  id:       string;
  date:     Date;
  plan:     string;
  amount:   number;
  provider: string;
  status:   string;
  papiRef:  string | null;
}

export interface SubscriptionStatusDto {
  id:             string;
  plan:           string;
  planName:       string;
  status:         string;
  periodStart:    Date;
  periodEnd:      Date;
  isActive:       boolean;
  creditBalance:  number;
  creditsGranted: number;
}

export interface CreditLedgerEntryDto {
  id:          string;
  type:        string;
  amount:      number;
  tokensUsed:  number | null;
  modelId:     string | null;
  description: string | null;
  createdAt:   Date;
}
