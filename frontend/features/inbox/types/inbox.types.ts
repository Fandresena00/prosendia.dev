/**
 * @file features/inbox/types/inbox.types.ts
 *
 * CHANGES:
 *   - MsgKind: added 'video' and 'audio' for Facebook media messages.
 *   - VideoAttachment and AudioAttachment interfaces added.
 *   - Msg: added video and audio optional fields.
 *   - MessageApiResponse: fileUrl is now used for videos, audio, and documents.
 */

export type MsgSender      = 'client' | 'ai' | 'human' | 'page';
export type ConvMode       = 'ai' | 'human';
export type MsgKind        = 'text' | 'photos' | 'video' | 'audio' | 'file';
export type HandoverStatus = 'AI' | 'HUMAN' | 'RESOLVED';

// ─── Attachments ──────────────────────────────────────────────────────────────

export interface PhotoAttachment {
  kind:       'photo';
  name:       string;
  objectUrl?: string;
  gradient:   string;
}

export interface FileAttachment {
  kind:       'file';
  name:       string;
  size?:      string;
  objectUrl?: string;
}

export interface VideoAttachment {
  /** Public URL of the downloaded video file (served from our backend). */
  url:           string;
  /** Optional thumbnail — not always available from Facebook. */
  thumbnailUrl?: string;
}

export interface AudioAttachment {
  /** Public URL of the downloaded audio file (served from our backend). */
  url: string;
}

// ─── Photo preset ─────────────────────────────────────────────────────────────

export interface PresetPhoto {
  id:          string;
  objectUrl?:  string;
  gradient:    string;
}

export interface PhotoPreset {
  id:                  string;
  name:                string;
  description:         string;
  photos:              PresetPhoto[];
  referenceImageUrls?: string[];
}

// ─── Message ──────────────────────────────────────────────────────────────────

export interface Msg {
  id:         string;
  sender:     MsgSender;
  time:       string;
  date:       string;
  kind:       MsgKind;
  content?:   string;
  photos?:    PhotoAttachment[];
  video?:     VideoAttachment;
  audio?:     AudioAttachment;
  file?:      FileAttachment;
  pending?:   boolean;
  failed?:    boolean;
  reactions?: string[];
  externalId?: string | null;
}

// ─── Conversation ─────────────────────────────────────────────────────────────

export interface Conv {
  id:               string;
  businessProfileId: string;
  externalId:       string;
  clientPsid:       string | null;
  client:           string;
  initials:         string;
  avatarUrl?:       string | null;
  lastMessage:      string;
  time:             string;
  mode:             ConvMode;
  unread:           number;
  online?:          boolean;
  handoverStatus:   HandoverStatus;
}

// ─── Account ──────────────────────────────────────────────────────────────────

export interface Account {
  id:         string;
  name:       string;
  initials:   string;
  color:      string;
  pageType:   string;
  verified:   boolean;
  pageId:     string;
  avatarUrl?: string;
}

// ─── API response shapes ──────────────────────────────────────────────────────

export interface ConversationApiResponse {
  id:                string;
  businessProfileId: string;
  externalId:        string;
  clientPsid:        string | null;
  clientName:        string | null;
  clientAvatarUrl:   string | null;
  lastMessage:       string | null;
  lastMessageAt:     string | null;
  handoverStatus:    HandoverStatus;
  unreadCount:       number;
  updatedAt:         string;
}

export interface MessageApiResponse {
  id:                  string;
  conversationId:      string;
  sender:              string;
  content:             string | null;
  /** URL for image and sticker attachments. */
  imageUrl:            string | null;
  /** URL for video, audio, and document attachments. */
  fileUrl:             string | null;
  referenceImageUrls:  string[];
  status:              string;
  externalId:          string | null;
  createdAt:           string;
}

export interface MessagesPageApiResponse {
  messages:   MessageApiResponse[];
  nextCursor: string | null;
  hasMore:    boolean;
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
  at:   string;
}

export interface NewMessageSsePayload {
  conversationId: string;
  message:        MessageApiResponse;
}

export interface ConversationUpdatedSsePayload {
  conversation: ConversationApiResponse;
}

export interface SyncCompleteSsePayload {
  businessProfileId: string;
  newMessages:       number;
  newConversations:  number;
}

export interface ReferencePresetApiResponse {
  id:                string;
  businessProfileId: string;
  name:              string;
  description:       string | null;
  images: Array<{
    id:          string;
    url:         string;
    description: string;
    sortOrder:   number;
  }>;
  createdAt: string;
  updatedAt: string;
}
