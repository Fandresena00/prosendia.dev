/**
 * @file features/inbox/types/inbox.types.ts
 *
 * CHANGES (realtime upgrade):
 *   - Conv: added lastClientMessageAt, messagingWindowExpiresAt,
 *     canSendFreeform, messengerDeepLink — powers the 24h-window banner.
 *     These stay REQUIRED on Conv (the internal app model) — mapConversation
 *     always fills them in with safe defaults.
 *   - ConversationApiResponse: mirrors the backend response, but the same 4
 *     fields are OPTIONAL here — REST responses always include them, but
 *     conversation_updated realtime events may omit them (see backend's
 *     ConversationEventSnapshot). "Absent" means "unchanged", not "reset to
 *     default" — see useInbox.ts's onConversationUpdated, which merges
 *     rather than replaces these 4 fields for that reason.
 *   - SseEventType renamed conceptually to WsEventType (kept both names
 *     exported so existing imports don't break); added ai_typing_start/stop.
 *   - Added AiTypingSsePayload and the AiSuggestion* payload/state types for
 *     the streamed reply-suggestion feature.
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

  /** ISO timestamp of the last message received FROM the client, or null. */
  lastClientMessageAt:      string | null;
  /** ISO timestamp at which the Messenger 24h window closes, or null. */
  messagingWindowExpiresAt: string | null;
  /** False once the 24h window has elapsed — the composer must be replaced by MessagingWindowClosedBanner. */
  canSendFreeform:          boolean;
  /** Link to open this Page's Messenger inbox in Meta Business Suite. */
  messengerDeepLink:        string | null;
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
  /**
   * Always present on REST responses (GET /inbox/conversations...). May be
   * ABSENT on a conversation_updated realtime event when the backend emitter
   * didn't compute the 24h window (e.g. a lightweight unreadCount patch from
   * the webhook handler) — absent means "unchanged", not "reset to default".
   */
  lastClientMessageAt?:      string | null;
  messagingWindowExpiresAt?: string | null;
  canSendFreeform?:          boolean;
  messengerDeepLink?:        string | null;
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

// ─── Realtime (WebSocket — formerly SSE) ───────────────────────────────────────

export type WsEventType =
  | 'new_message'
  | 'conversation_updated'
  | 'sync_complete'
  | 'ai_typing_start'
  | 'ai_typing_stop'
  | 'typing'
  | 'ping';

/** @deprecated alias of WsEventType, kept so older imports keep compiling. */
export type SseEventType = WsEventType;

export interface SseEvent<T = unknown> {
  type: WsEventType;
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

/** The AI is composing a reply for this conversation. */
export interface AiTypingSsePayload {
  conversationId: string;
}

// ─── AI reply suggestion (streamed over the WS gateway) ────────────────────────

export interface AiSuggestionChunkPayload {
  conversationId: string;
  requestId:      string;
  textChunk:      string;
}

export interface AiSuggestionDonePayload {
  conversationId: string;
  requestId:      string;
  fullText:       string;
  tokensUsed:     number;
}

export interface AiSuggestionErrorPayload {
  conversationId: string;
  requestId:      string;
  message:        string;
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
