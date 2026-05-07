/**
 * @file features/inbox/types/inbox.types.ts
 *
 * All types for the inbox feature.
 *
 * CHANGES:
 *   - Account: added optional `avatarUrl` for Facebook page profile pictures.
 */

// ─── Core enums ───────────────────────────────────────────────────────────────

export type MsgSender      = 'client' | 'ai' | 'human' | 'page';
export type ConvMode       = 'ai' | 'human';
export type MsgKind        = 'text' | 'photos' | 'file';
export type HandoverStatus = 'AI' | 'HUMAN' | 'RESOLVED';

// ─── Attachments ──────────────────────────────────────────────────────────────

export interface PhotoAttachment {
  kind:       'photo';
  name:       string;
  /** blob: URL (local pick) or https: URL (from backend) */
  objectUrl?: string;
  gradient:   string;
}

export interface FileAttachment {
  kind:        'file';
  name:        string;
  size?:       string;
  /** blob: URL for upload preview */
  objectUrl?:  string;
}

// ─── Photo preset ─────────────────────────────────────────────────────────────

export interface PresetPhoto {
  id:          string;
  objectUrl?:  string;
  gradient:    string;
}

export interface PhotoPreset {
  /** Backend ChatResource UUID */
  id:                   string;
  name:                 string;
  description:          string;
  photos:               PresetPhoto[];
  /** Permanent backend URLs — used when sending to Facebook */
  referenceImageUrls?:  string[];
}

// ─── Message ──────────────────────────────────────────────────────────────────

export interface Msg {
  /** Backend UUID or local temp ID */
  id:           string;
  sender:       MsgSender;
  time:         string;
  date:         string;
  kind:         MsgKind;
  content?:     string;
  photos?:      PhotoAttachment[];
  file?:        FileAttachment;
  pending?:     boolean;
  failed?:      boolean;
  reactions?:   string[];
  externalId?:  string | null;
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

// ─── Account (Facebook Page) ──────────────────────────────────────────────────

export interface Account {
  /** businessProfileId */
  id:          string;
  name:        string;
  initials:    string;
  color:       string;
  pageType:    string;
  verified:    boolean;
  pageId:      string;
  /** Facebook page profile picture URL (computed from CDN) */
  avatarUrl?:  string;
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
  imageUrl:            string | null;
  fileUrl:             string | null;
  referenceImageUrls:  string[];
  status:              string;
  externalId:          string | null;
  createdAt:           string;
}

export interface MessagesPageApiResponse {
  messages:    MessageApiResponse[];
  nextCursor:  string | null;
  hasMore:     boolean;
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
  businessProfileId:  string;
  newMessages:        number;
  newConversations:   number;
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
  createdAt:  string;
  updatedAt:  string;
}
