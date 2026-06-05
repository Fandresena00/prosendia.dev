/**
 * @file features/dashboard/dto/dashboard.dto.ts
 */

import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum NotificationSeverityDto {
  INFO     = 'INFO',
  WARNING  = 'WARNING',
  CRITICAL = 'CRITICAL',
  SUCCESS  = 'SUCCESS',
}

export enum NotificationTypeDto {
  PAYMENT_CONFIRMED        = 'PAYMENT_CONFIRMED',
  SUBSCRIPTION_EXPIRING    = 'SUBSCRIPTION_EXPIRING',
  CREDITS_LOW              = 'CREDITS_LOW',
  CREDITS_CRITICAL         = 'CREDITS_CRITICAL',
  CREDITS_DEPLETED         = 'CREDITS_DEPLETED',
  FACEBOOK_TOKEN_EXPIRED   = 'FACEBOOK_TOKEN_EXPIRED',
  SYNC_FAILED              = 'SYNC_FAILED',
  POST_LIMIT_REACHED       = 'POST_LIMIT_REACHED',
  PAGE_CONNECTED           = 'PAGE_CONNECTED',
  HUMAN_TAKEOVER_REQUIRED  = 'HUMAN_TAKEOVER_REQUIRED',
  ANGRY_CLIENT_DETECTED    = 'ANGRY_CLIENT_DETECTED',
  AI_STUCK_LOOP            = 'AI_STUCK_LOOP',
  HOT_PROSPECT             = 'HOT_PROSPECT',
  UNANSWERED_HUMAN         = 'UNANSWERED_HUMAN',
  MESSENGER_WINDOW_EXPIRED = 'MESSENGER_WINDOW_EXPIRED',
}

// ─── Query DTOs ───────────────────────────────────────────────────────────────

export class NotificationsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  pageSize?: number = 20;

  @IsOptional() @IsEnum(NotificationSeverityDto)
  severity?: NotificationSeverityDto;

  @IsOptional() @IsEnum(NotificationTypeDto)
  type?: NotificationTypeDto;

  @IsOptional() @IsBoolean() @Type(() => Boolean)
  unreadOnly?: boolean;

  @IsOptional() @IsString()
  search?: string;
}

export class MarkReadDto {
  @IsOptional() ids?: string[];
  @IsOptional() @IsBoolean() all?: boolean;
}

export class WebPushSubscribeDto {
  @IsString() endpoint!: string;
  @IsString() p256dh!: string;
  @IsString() auth!: string;
  @IsOptional() @IsString() userAgent?: string;
}

// ─── Response interfaces ──────────────────────────────────────────────────────

export interface NotificationDto {
  id:                 string;
  type:               string;
  severity:           string;
  title:              string;
  message:            string;
  isRead:             boolean;
  createdAt:          Date;
  conversationId:     string | null;
  postId:             string | null;
  commentId:          string | null;
  clientName:         string | null;
  conversationUrl:    string | null;
  facebookProfileUrl: string | null;
  postUrl:            string | null;
  commentUrl:         string | null;
  actionLabel:        string | null;
  actionUrl:          string | null;
}

export interface NotificationsPageDto {
  data:        NotificationDto[];
  unreadCount: number;
  pagination:  { page: number; pageSize: number; total: number; totalPages: number };
}

export interface DailyActivityDto {
  date:         string;
  day:          string;
  messages:     number;
  aiReplies:    number;
  humanReplies: number;
  comments:     number;
}

export interface AiStatsDto {
  repliesToday:         number;
  repliesThisMonth:     number;
  conversationsHandled: number;
  commentsHandled:      number;
}

export interface ResponseRateDto {
  globalRate:      number;
  aiRate:          number;
  humanRate:       number;
  unansweredCount: number;
}

export interface ActivityTodayDto {
  messagesReceived:   number;
  commentsReceived:   number;
  aiRepliesSent:      number;
  humanInterventions: number;
}

export interface SubscriptionUsageDto {
  planName:           string;
  planId:             string;
  creditBalance:      number;
  creditsGranted:     number | null;
  creditRemainingPct: number;
  creditIsLow:        boolean;
  creditIsCritical:   boolean;
  creditIsDepleted:   boolean;
  periodEnd:          Date | null;
  daysRemaining:      number | null;
  pagesUsed:          number;
  pagesLimit:         number | null;
  postsManaged:       number;
  postsLimit:         number | null;
  referenceImages:    number;
  imagesLimit:        number | null;
}

export interface DashboardResponseDto {
  subscription:  SubscriptionUsageDto;
  aiStats:       AiStatsDto;
  responseRate:  ResponseRateDto;
  activityToday: ActivityTodayDto;
  weeklyChart:   DailyActivityDto[];
  notifications: NotificationDto[];
  unreadCount:   number;
  criticalCount: number;
  generatedAt:   Date;
}
