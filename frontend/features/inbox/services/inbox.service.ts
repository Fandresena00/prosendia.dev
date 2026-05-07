/**
 * @file features/inbox/services/inbox.service.ts
 *
 * All HTTP calls for the inbox feature.
 * Routes through apiClient (handles JWT auth + token refresh).
 *
 * CHANGES:
 *   - fetchAccounts: added avatarUrl from Facebook Graph CDN for page profile pictures.
 *     Facebook provides a public redirect URL: graph.facebook.com/{pageId}/picture
 *     No access token required for public pages.
 *   - normalizeAvatarUrl: extracted as a module-level helper used by both
 *     mapConversation and fetchAccounts.
 *   - mapConversation: uses normalizeAvatarUrl for client avatar URLs.
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

const INBOX_API_BASE = '/inbox';

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
 * Normalizes a Facebook CDN image URL:
 * - Upgrades http:// to https:// (Facebook CDN sometimes returns http)
 * - Returns null for empty/null inputs
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
 * This is a redirect URL — no access token required for public pages.
 * Format: https://graph.facebook.com/{pageId}/picture?type=large
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
      id:                   string;
      businessProfileId?:   string;
      pageId:               string;
      pageName:             string;
      instagramAccountId?:  string | null;
      tokenStatus:          string;
      isActive:             boolean;
    }>;
  }>('/facebook/connections');

  return response.data
    .filter((connection) => connection.isActive)
    .map((connection, index): Account => ({
      id:       connection.businessProfileId ?? connection.id,
      name:     connection.pageName,
      initials: buildInitials(connection.pageName),
      color:    index % 2 === 0
        ? 'bg-primary/15 text-primary'
        : 'bg-violet-500/15 text-violet-500',
      pageType: 'Page Facebook',
      verified: connection.tokenStatus === 'VALID',
      pageId:   connection.pageId,
      // FIX: Build page avatar URL from Facebook CDN (no token needed for public pages)
      avatarUrl: buildFacebookPagePictureUrl(connection.pageId),
    }));
}

// ─── Conversations ────────────────────────────────────────────────────────────

export async function fetchConversations(params: {
  businessProfileId?: string;
  search?:            string;
  page?:              number;
  pageSize?:          number;
}): Promise<{ data: Conv[]; total: number }> {
  const queryString = new URLSearchParams();
  if (params.businessProfileId) queryString.set('businessProfileId', params.businessProfileId);
  if (params.search)            queryString.set('search', params.search);
  if (params.page)              queryString.set('page', String(params.page));
  if (params.pageSize)          queryString.set('pageSize', String(params.pageSize));

  const response = await apiClient<{
    data:       ConversationApiResponse[];
    pagination: { total: number };
  }>(`${INBOX_API_BASE}/conversations?${queryString}`);

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
  const response = await apiClient<ConversationApiResponse>(
    `${INBOX_API_BASE}/conversations/${conversationId}/handover`,
    { method: 'POST', body: JSON.stringify({ conversationId, status }) },
  );
  return mapConversation(response);
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function fetchMessages(
  conversationId: string,
  options: { before?: string; limit?: number } = {},
): Promise<MessagesPageApiResponse> {
  const queryString = new URLSearchParams();
  if (options.before) queryString.set('before', options.before);
  if (options.limit)  queryString.set('limit',  String(options.limit));
  return apiClient<MessagesPageApiResponse>(
    `${INBOX_API_BASE}/conversations/${conversationId}/messages?${queryString}`,
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

// ─── Temp file upload (for ad-hoc photo/file sends) ──────────────────────────

/**
 * Uploads a file to the backend as a temporary public file.
 * Returns a publicly-accessible HTTPS URL that Facebook can download
 * when sending the file via the Graph API.
 *
 * The backend serves these files at: {BACKEND_URL}/uploads/{filename}
 * The URL is valid for a short window (backend should clean up old temp files).
 *
 * Do NOT use this for reference preset images — use createReferencePreset() instead.
 */
export async function getTempUploadUrl(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient<{ url: string }>(`${INBOX_API_BASE}/uploads/temp`, {
    method: 'POST',
    body:   formData,
    // Do NOT set Content-Type — let the browser set multipart/form-data with boundary
  });
  return response.url;
}

// ─── Reference presets ────────────────────────────────────────────────────────

function mapReferencePresetApiResponse(apiPreset: ReferencePresetApiResponse): PhotoPreset {
  return {
    id:                  apiPreset.id,
    name:                apiPreset.name,
    description:         apiPreset.description ?? '',
    referenceImageUrls:  apiPreset.images.map((image) => image.url),
    photos:              apiPreset.images.map((image, index) => ({
      id:        image.id,
      objectUrl: image.url,
      gradient:  PHOTO_GRADIENT_PALETTE[index % PHOTO_GRADIENT_PALETTE.length],
    })),
  };
}

export async function fetchReferencePresets(
  businessProfileId: string,
): Promise<PhotoPreset[]> {
  const queryString = new URLSearchParams({ businessProfileId });
  const response = await apiClient<ReferencePresetApiResponse[]>(
    `${INBOX_API_BASE}/reference-presets?${queryString}`,
  );
  return response.map(mapReferencePresetApiResponse);
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
  return mapReferencePresetApiResponse(response);
}

export async function deleteReferencePreset(presetId: string): Promise<void> {
  await apiClient(`${INBOX_API_BASE}/reference-presets/${presetId}`, {
    method: 'DELETE',
  });
}

// ─── Manual sync ──────────────────────────────────────────────────────────────

export async function triggerManualSync(businessProfileId: string): Promise<void> {
  await apiClient(`${INBOX_API_BASE}/sync/${businessProfileId}`, { method: 'POST' });
}
