/**
 * @file features/inbox/types/inbox.types.ts
 *
 * All types for the inbox feature.
 * Keeps the same UI-facing shape as the original mock so components break minimally.
 */

// ─── Core enums ───────────────────────────────────────────────────────────────

export type MsgSender    = 'client' | 'ai' | 'human' | 'page';
export type ConvMode     = 'ai' | 'human';
export type MsgKind      = 'text' | 'photos' | 'file';
export type HandoverStatus = 'AI' | 'HUMAN' | 'RESOLVED';

// ─── Attachments ──────────────────────────────────────────────────────────────

export interface PhotoAttachment {
  kind: 'photo';
  name: string;
  /** blob: URL (local pick) or https: URL (from backend) */
  objectUrl?: string;
  gradient: string;
}

export interface FileAttachment {
  kind: 'file';
  name: string;
  size?: string;
  /** blob: URL for upload preview */
  objectUrl?: string;
}

// ─── Photo preset ─────────────────────────────────────────────────────────────

export interface PresetPhoto {
  /** Client-side UUID (before upload) or undefined after save */
  id: string;
  /** blob: URL while picking, permanent backend URL after upload */
  objectUrl?: string;
  gradient: string;
}

export interface PhotoPreset {
  /** numeric id for list keys */
  id: number;
  name: string;
  description: string;
  photos: PresetPhoto[];
  /** Permanent backend URLs (populated after upload, used when sending) */
  referenceImageUrls?: string[];
}

// ─── Message ──────────────────────────────────────────────────────────────────

export interface Msg {
  /** Backend UUID or local temp ID (string for both) */
  id: string;
  sender: MsgSender;
  time: string;
  date: string;
  kind: MsgKind;
  content?: string;
  photos?: PhotoAttachment[];
  file?: FileAttachment;
  pending?: boolean;
  failed?: boolean;
  reactions?: string[];
  /** Backend message ID (undefined while pending) */
  externalId?: string | null;
}

// ─── Conversation ─────────────────────────────────────────────────────────────

export interface Conv {
  /** Backend UUID */
  id: string;
  businessProfileId: string;
  externalId: string;
  clientPsid: string | null;
  client: string;
  initials: string;
  avatarUrl: string | null;
  lastMessage: string;
  time: string;
  mode: ConvMode;
  unread: number;
  online?: boolean;
  handoverStatus: HandoverStatus;
}

// ─── Account (Facebook Page) ──────────────────────────────────────────────────

export interface Account {
  /** businessProfileId */
  id: string;
  name: string;
  initials: string;
  color: string;
  pageType: string;
  verified: boolean;
  pageId: string;
  avatarUrl: string;
}

// ─── API response shapes ──────────────────────────────────────────────────────

export interface ConversationApiResponse {
  id: string;
  businessProfileId: string;
  externalId: string;
  clientPsid: string | null;
  clientName: string | null;
  clientAvatarUrl: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  handoverStatus: HandoverStatus;
  unreadCount: number;
  updatedAt: string;
}

export interface MessageApiResponse {
  id: string;
  conversationId: string;
  sender: string;
  content: string | null;
  imageUrl: string | null;
  fileUrl: string | null;
  referenceImageUrls: string[];
  status: string;
  externalId: string | null;
  createdAt: string;
}

export interface MessagesPageApiResponse {
  messages: MessageApiResponse[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ─── SSE ──────────────────────────────────────────────────────────────────────

export type SseEventType =
  | 'new_message'
  | 'conversation_updated'
  | 'sync_complete'
  | 'typing'
  | 'ping';

export interface SseEvent<T = unknown> {
  type: SseEventType;
  data: T;
  at: string;
}

export interface NewMessageSsePayload {
  conversationId: string;
  message: MessageApiResponse;
}

export interface ConversationUpdatedSsePayload {
  conversation: ConversationApiResponse;
}

export interface SyncCompleteSsePayload {
  businessProfileId: string;
  newMessages: number;
  newConversations: number;
}
