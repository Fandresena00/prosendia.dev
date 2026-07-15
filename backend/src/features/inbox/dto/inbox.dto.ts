/**
 * @file features/inbox/dto/inbox.dto.ts
 *
 * All DTOs for the inbox feature.
 * Covers: conversations list, paginated messages, send payload, realtime events.
 *
 * CHANGES (realtime upgrade):
 *   - ConversationResponseDto: added lastClientMessageAt, messagingWindowExpiresAt,
 *     canSendFreeform, messengerDeepLink — powers the Messenger 24h window banner.
 *   - SseEventType renamed conceptually to InboxEventType (WebSocket-driven now);
 *     SseEventType kept as an alias so existing imports keep compiling.
 *   - Added ai_typing_start / ai_typing_stop event payloads (AI "typing…" bubble).
 *   - Added RequestAiSuggestionDto + AiSuggestion*Payload for the reply-suggestion
 *     feature, streamed over the inbox WebSocket gateway.
 *
 * BUILD FIX: ConversationUpdatedEvent.conversation used to be typed as the
 * full ConversationResponseDto, which made the 4 new window fields REQUIRED
 * at every emission site across the codebase — including
 * facebook-sync.service.ts and webhook.service.ts, which build lighter
 * conversation snapshots (e.g. just after bumping unreadCount) and don't
 * necessarily have businessProfile.facebookConnection.pageId loaded.
 * ConversationEventSnapshot makes exactly those 4 fields optional for
 * REALTIME EVENTS ONLY — ConversationResponseDto (the REST response shape)
 * is untouched and still guarantees all 4 are always present.
 * Frontend consumers must merge (not replace) these 4 fields when handling
 * conversation_updated, since "absent" here means "unchanged", not "reset
 * to default" — see useInbox.ts's onConversationUpdated handler.
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

  /** Timestamp of the last message received FROM the client (Messenger 24h window basis). */
  lastClientMessageAt!: Date | null;
  /** When the standard messaging window closes. Null if it was never opened. */
  messagingWindowExpiresAt!: Date | null;
  /**
   * False once more than 24h have passed since the client's last message.
   * Facebook blocks free-form Page → client sends outside this window —
   * the frontend must replace the composer with a "reply on Messenger" banner.
   */
  canSendFreeform!: boolean;
  /** Deep link to open this Page's Messenger inbox in Meta Business Suite. Null if no page connected. */
  messengerDeepLink!: string | null;
}

/**
 * Shape used by `conversation_updated` realtime events. Identical to
 * ConversationResponseDto except the 4 messaging-window fields are OPTIONAL —
 * an emitter that doesn't have businessProfile.facebookConnection loaded (or
 * is just patching unreadCount/lastMessage) can build one without computing
 * them. Frontend must treat "field absent" as "unchanged, keep what I had",
 * never as "reset to default".
 */
export type ConversationEventSnapshot = Omit<
  ConversationResponseDto,
  'lastClientMessageAt' | 'messagingWindowExpiresAt' | 'canSendFreeform' | 'messengerDeepLink'
> &
  Partial<
    Pick<
      ConversationResponseDto,
      'lastClientMessageAt' | 'messagingWindowExpiresAt' | 'canSendFreeform' | 'messengerDeepLink'
    >
  >;

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

// ─── AI reply suggestion ────────────────────────────────────────────────────────

/** Emitted by the client over the WebSocket gateway (`request_ai_suggestion`). */
export class RequestAiSuggestionDto {
  @IsString()
  @IsNotEmpty()
  conversationId!: string;
}

/** One streamed token/word chunk of a suggestion being generated. */
export interface AiSuggestionChunkPayload {
  conversationId: string;
  /** Correlates chunks/done/error for a single suggestion request. */
  requestId: string;
  textChunk: string;
}

/** Sent once generation is complete. */
export interface AiSuggestionDonePayload {
  conversationId: string;
  requestId: string;
  fullText: string;
  tokensUsed: number;
}

/** Sent if generation fails (OpenRouter error, no credits, etc). */
export interface AiSuggestionErrorPayload {
  conversationId: string;
  requestId: string;
  message: string;
}

// ─── Realtime events (WebSocket — formerly SSE) ────────────────────────────────

export type InboxEventType =
  | 'new_message'
  | 'conversation_updated'
  | 'notification'
  | 'sync_complete'
  | 'ai_typing_start'
  | 'ai_typing_stop'
  | 'typing'
  | 'ping';

/**
 * @deprecated kept as an alias of InboxEventType so older imports referencing
 * `SseEventType` keep compiling after the SSE → WebSocket migration.
 */
export type SseEventType = InboxEventType;

export interface SseEvent<T = unknown> {
  type: InboxEventType;
  data: T;
  /** ISO timestamp */
  at: string;
}

export interface NewMessageEvent {
  conversationId: string;
  message: MessageResponseDto;
}

/**
 * `conversation` is a ConversationEventSnapshot, NOT the full
 * ConversationResponseDto — see the type's doc comment above. Any emitter
 * (InboxSyncService, InboxSyncSchedulerService, ReplyAiService,
 * facebook-sync.service.ts, webhook.service.ts, …) can build one without
 * necessarily knowing the 24h-window state.
 */
export interface ConversationUpdatedEvent {
  conversation: ConversationEventSnapshot;
}

export interface SyncCompleteEvent {
  businessProfileId: string;
  newMessages: number;
  newConversations: number;
}

/** conversationId only — the AI is composing a reply for this conversation. */
export interface AiTypingEvent {
  conversationId: string;
}
