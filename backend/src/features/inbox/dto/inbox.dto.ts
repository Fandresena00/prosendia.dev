/**
 * @file features/inbox/dto/inbox.dto.ts
 *
 * All DTOs for the inbox feature.
 * Covers: conversations list, paginated messages, send payload, SSE events.
 */

import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SenderType } from '../../../generated/prisma/enums.js';

// ─── Conversations ─────────────────────────────────────────────────────────────

export class ListConversationsQueryDto {
  @IsOptional()
  @IsString()
  businessProfileId?: string;

  /** Search by client name or last message */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  pageSize?: number = 30;
}

export class ConversationResponseDto {
  id!: string;
  businessProfileId!: string;
  externalId!: string;
  clientPsid!: string | null;
  clientName!: string | null;
  clientAvatarUrl!: string | null;
  lastMessage!: string | null;
  lastMessageAt!: Date | null;
  handoverStatus!: string;
  unreadCount!: number;
  updatedAt!: Date;
}

// ─── Messages ─────────────────────────────────────────────────────────────────

/**
 * Cursor-based pagination for messages.
 * The cursor is the ID of the oldest visible message.
 * Each page loads LIMIT messages older than the cursor.
 */
export class GetMessagesQueryDto {
  @IsOptional()
  @IsString()
  before?: string; // message ID cursor

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 30;
}

export class MessageResponseDto {
  id!: string;
  conversationId!: string;
  sender!: SenderType;
  content!: string | null;
  imageUrl!: string | null;
  fileUrl!: string | null;
  /** For preset reference images: array of stored URLs */
  referenceImageUrls!: string[];
  status!: string;
  externalId!: string | null;
  createdAt!: Date;
}

export class MessagesPageDto {
  messages!: MessageResponseDto[];
  /** ID of the oldest message returned — pass as `before` in next request */
  nextCursor!: string | null;
  hasMore!: boolean;
}

// ─── Send message ─────────────────────────────────────────────────────────────

export class SendTextMessageDto {
  @IsString()
  @IsNotEmpty()
  conversationId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  text!: string;
}

export class SendImageMessageDto {
  @IsString()
  @IsNotEmpty()
  conversationId!: string;

  /**
   * Array of image URLs to send.
   * For reference images: permanent backend URLs.
   * For ad-hoc uploads: temporary URLs resolved client-side via presigned upload.
   */
  @IsArray()
  @IsString({ each: true })
  imageUrls!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  caption?: string;
}

export class SendFileMessageDto {
  @IsString()
  @IsNotEmpty()
  conversationId!: string;

  @IsString()
  @IsNotEmpty()
  fileUrl!: string;

  @IsString()
  @IsNotEmpty()
  fileName!: string;
}

// ─── Reference image upload ────────────────────────────────────────────────────

export class UploadReferenceImagesResponseDto {
  /** Permanent backend-hosted URLs for the uploaded images */
  urls!: string[];
}

export class ReferenceImageDto {
  id!: string;
  url!: string;
  description!: string;
  sortOrder!: number;
}

export class ReferencePresetDto {
  id!: string;
  businessProfileId!: string;
  name!: string;
  description!: string | null;
  images!: ReferenceImageDto[];
  createdAt!: Date;
  updatedAt!: Date;
}

export class ListReferencePresetsQueryDto {
  @IsString()
  @IsNotEmpty()
  businessProfileId!: string;
}

export class CreateReferencePresetDto {
  @IsString()
  @IsNotEmpty()
  businessProfileId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description!: string;
}

// ─── Handover ─────────────────────────────────────────────────────────────────

export class SetHandoverDto {
  @IsString()
  @IsNotEmpty()
  conversationId!: string;

  @IsEnum(['AI', 'HUMAN', 'RESOLVED'])
  status!: 'AI' | 'HUMAN' | 'RESOLVED';
}

// ─── SSE event payloads ────────────────────────────────────────────────────────

export type SseEventType =
  | 'new_message'
  | 'conversation_updated'
  | 'sync_complete'
  | 'typing'
  | 'ping';

export interface SseEvent<T = unknown> {
  type: SseEventType;
  data: T;
  /** ISO timestamp */
  at: string;
}

export interface NewMessageEvent {
  conversationId: string;
  message: MessageResponseDto;
}

export interface ConversationUpdatedEvent {
  conversation: ConversationResponseDto;
}

export interface SyncCompleteEvent {
  businessProfileId: string;
  newMessages: number;
  newConversations: number;
}
