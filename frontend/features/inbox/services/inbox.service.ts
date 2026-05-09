/**
 * @file features/inbox/services/inbox.service.ts
 *
 * All HTTP calls for the inbox feature.
 *
 * CHANGES:
 *   - syncConversationOnOpen(): calls POST /facebook/sync/messages/:id to pull
 *     the latest messages from the Graph API when a conversation is opened.
 *     This guarantees the user always sees up-to-date data from Facebook,
 *     not just what was cached by the last webhook delivery.
 *   - syncConversations(): triggers a full conversation list sync from Facebook.
 */

import { apiClient } from '@/lib/api-client';
import type {
  Account,
  Conv,
  ConversationApiResponse,
  MessageApiResponse,
  MessagesPageApiResponse,
  PhotoPreset,
  ReferencePresetApiResponse,
} from '../types/inbox.types';

const INBOX_API_BASE    = '/inbox';
const FACEBOOK_API_BASE = '/facebook';

const PHOTO_GRADIENT_PALETTE = [
  'from-blue-500/40 to-indigo-600/30',
  'from-violet-500/40 to-purple-600/30',
  'from-emerald-500/40 to-teal-600/30',
  'from-amber-500/40 to-orange-600/30',
  'from-rose-500/40 to-pink-600/30',
  'from-cyan-500/40 to-sky-600/30',
];

// ─── Shared helpers ────────────────────────────────────────────────────────────

/**
 * Normalizes a Facebook CDN image URL to HTTPS.
 * Facebook occasionally returns http:// URLs for profile pictures and attachments.
 */
function normalizeAvatarUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  if (rawUrl.startsWith('http://')) return `https://${rawUrl.slice(7)}`;
  return rawUrl;
}

function formatConversationTime(isoDateString: string | null): string {
  if (!isoDateString) return '';
  const messageDate = new Date(isoDateString);
  const today       = new Date();
  const diffDays    = Math.floor((today.getTime() - messageDate.getTime()) / 86_400_000);
  if (diffDays === 0)
    return messageDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Hier';
  return messageDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function buildInitials(displayName: string | null): string {
  if (!displayName) return '?';
  return displayName
    .split(' ')
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/**
 * Returns the public Facebook CDN URL for a page's profile picture.
 * This redirect URL works without an access token for public pages.
 */
function buildFacebookPagePictureUrl(pageId: string): string {
  return `https://graph.facebook.com/${pageId}/picture?type=large`;
}

export function mapConversation(apiConversation: ConversationApiResponse): Conv {
  return {
    id:                apiConversation.id,
    businessProfileId: apiConversation.businessProfileId,
    externalId:        apiConversation.externalId,
    clientPsid:        apiConversation.clientPsid,
    client:            apiConversation.clientName ?? apiConversation.clientPsid ?? 'Inconnu',
    initials:          buildInitials(apiConversation.clientName),
    // Normalize avatar URL — Facebook may return http://
    avatarUrl:         normalizeAvatarUrl(apiConversation.clientAvatarUrl),
    lastMessage:       apiConversation.lastMessage ?? '',
    time:              formatConversationTime(apiConversation.lastMessageAt),
    mode:              apiConversation.handoverStatus === 'AI' ? 'ai' : 'human',
    unread:            apiConversation.unreadCount,
    online:            false,
    handoverStatus:    apiConversation.handoverStatus,
  };
}

// ─── Accounts (Facebook Pages) ────────────────────────────────────────────────

export async function fetchAccounts(): Promise<Account[]> {
  const response = await apiClient<{
    data: Array<{
      id:                  string;
      businessProfileId?:  string;
      pageId:              string;
      pageName:            string;
      instagramAccountId?: string | null;
      tokenStatus:         string;
      isActive:            boolean;
    }>;
  }>(`${FACEBOOK_API_BASE}/connections`);

  return response.data
    .filter((c) => c.isActive)
    .map((c, i): Account => ({
      id:       c.businessProfileId ?? c.id,
      name:     c.pageName,
      initials: buildInitials(c.pageName),
      color:    i % 2 === 0
        ? 'bg-primary/15 text-primary'
        : 'bg-violet-500/15 text-violet-500',
      pageType: 'Page Facebook',
      verified: c.tokenStatus === 'VALID',
      pageId:   c.pageId,
      // Page avatar from Facebook CDN — no token needed for public pages
      avatarUrl: buildFacebookPagePictureUrl(c.pageId),
    }));
}

// ─── Conversations ────────────────────────────────────────────────────────────

export async function fetchConversations(params: {
  businessProfileId?: string;
  search?:            string;
  page?:              number;
  pageSize?:          number;
}): Promise<{ data: Conv[]; total: number }> {
  const qs = new URLSearchParams();
  if (params.businessProfileId) qs.set('businessProfileId', params.businessProfileId);
  if (params.search)            qs.set('search', params.search);
  if (params.page)              qs.set('page', String(params.page));
  if (params.pageSize)          qs.set('pageSize', String(params.pageSize));

  const response = await apiClient<{
    data:       ConversationApiResponse[];
    pagination: { total: number };
  }>(`${INBOX_API_BASE}/conversations?${qs}`);

  return {
    data:  response.data.map(mapConversation),
    total: response.pagination.total,
  };
}

export async function markConversationRead(conversationId: string): Promise<void> {
  await apiClient(`${INBOX_API_BASE}/conversations/${conversationId}/read`, {
    method: 'POST',
  });
}

export async function setHandover(
  conversationId: string,
  status:         'AI' | 'HUMAN' | 'RESOLVED',
): Promise<Conv> {
  const res = await apiClient<ConversationApiResponse>(
    `${INBOX_API_BASE}/conversations/${conversationId}/handover`,
    { method: 'POST', body: JSON.stringify({ conversationId, status }) },
  );
  return mapConversation(res);
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function fetchMessages(
  conversationId: string,
  options: { before?: string; limit?: number } = {},
): Promise<MessagesPageApiResponse> {
  const qs = new URLSearchParams();
  if (options.before) qs.set('before', options.before);
  if (options.limit)  qs.set('limit', String(options.limit));
  return apiClient<MessagesPageApiResponse>(
    `${INBOX_API_BASE}/conversations/${conversationId}/messages?${qs}`,
  );
}

// ─── Send ─────────────────────────────────────────────────────────────────────

export async function sendTextMessage(
  conversationId: string,
  text:           string,
): Promise<MessageApiResponse> {
  return apiClient<MessageApiResponse>(`${INBOX_API_BASE}/messages/text`, {
    method: 'POST',
    body:   JSON.stringify({ conversationId, text }),
  });
}

export async function sendImagesMessage(
  conversationId: string,
  imageUrls:      string[],
  caption?:       string,
): Promise<MessageApiResponse[]> {
  return apiClient<MessageApiResponse[]>(`${INBOX_API_BASE}/messages/images`, {
    method: 'POST',
    body:   JSON.stringify({ conversationId, imageUrls, caption }),
  });
}

export async function sendFileMessage(
  conversationId: string,
  fileUrl:        string,
  fileName:       string,
): Promise<MessageApiResponse> {
  return apiClient<MessageApiResponse>(`${INBOX_API_BASE}/messages/file`, {
    method: 'POST',
    body:   JSON.stringify({ conversationId, fileUrl, fileName }),
  });
}

// ─── Facebook sync (Graph API → DB) ───────────────────────────────────────────

/**
 * Triggers an immediate sync of a conversation's messages from the Graph API.
 *
 * Call this when:
 *   - The user opens a conversation (ensures they see fresh data from Facebook)
 *   - After an action that might have changed the conversation on Facebook
 *
 * The sync runs on the backend and updates the DB.
 * The frontend's 8-second message poll will reflect the result automatically.
 * The backend also emits SSE events for any newly discovered messages,
 * so the UI updates instantly when SSE is connected.
 *
 * Fire-and-forget safe: errors are silently ignored by the caller.
 */
export async function syncConversationOnOpen(
  conversationId: string,
): Promise<{ synced: number }> {
  return apiClient<{ synced: number }>(
    `${FACEBOOK_API_BASE}/sync/messages/${conversationId}`,
    { method: 'POST' },
  );
}

/**
 * Triggers a sync of the conversation list from Facebook.
 * Also refreshes participant names and avatars.
 * Used when switching accounts or after a long idle period.
 */
export async function syncConversationList(
  businessProfileId: string,
): Promise<{ synced: number }> {
  return apiClient<{ synced: number }>(
    `${FACEBOOK_API_BASE}/sync/conversations/${businessProfileId}`,
    { method: 'POST' },
  );
}

// ─── Temp file upload ─────────────────────────────────────────────────────────

/**
 * Uploads a file as a UUID-named temp file on the backend.
 * Returns a public HTTPS URL that the Facebook Graph API can download.
 * The file is automatically deleted after 10 minutes by TempFileCleanupService.
 */
export async function getTempUploadUrl(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient<{ url: string }>(`${INBOX_API_BASE}/uploads/temp`, {
    method: 'POST',
    body:   formData,
  });
  return response.url;
}

// ─── Reference presets ────────────────────────────────────────────────────────

function mapReferencePreset(apiPreset: ReferencePresetApiResponse): PhotoPreset {
  return {
    id:                  apiPreset.id,
    name:                apiPreset.name,
    description:         apiPreset.description ?? '',
    referenceImageUrls:  apiPreset.images.map((img) => img.url),
    photos:              apiPreset.images.map((img, i) => ({
      id:        img.id,
      objectUrl: img.url,
      gradient:  PHOTO_GRADIENT_PALETTE[i % PHOTO_GRADIENT_PALETTE.length],
    })),
  };
}

export async function fetchReferencePresets(
  businessProfileId: string,
): Promise<PhotoPreset[]> {
  const qs = new URLSearchParams({ businessProfileId });
  const response = await apiClient<ReferencePresetApiResponse[]>(
    `${INBOX_API_BASE}/reference-presets?${qs}`,
  );
  return response.map(mapReferencePreset);
}

export async function createReferencePreset(params: {
  businessProfileId: string;
  name:              string;
  description:       string;
  files:             File[];
}): Promise<PhotoPreset> {
  const formData = new FormData();
  formData.append('businessProfileId', params.businessProfileId);
  formData.append('name',              params.name);
  formData.append('description',       params.description);
  for (const file of params.files) formData.append('images', file);

  const response = await apiClient<ReferencePresetApiResponse>(
    `${INBOX_API_BASE}/reference-presets`,
    { method: 'POST', body: formData },
  );
  return mapReferencePreset(response);
}

export async function deleteReferencePreset(presetId: string): Promise<void> {
  await apiClient(`${INBOX_API_BASE}/reference-presets/${presetId}`, {
    method: 'DELETE',
  });
}
