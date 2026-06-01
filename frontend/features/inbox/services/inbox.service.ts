/**
 * @file features/inbox/services/inbox.service.ts
 * All HTTP calls for the inbox feature.
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeAvatarUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  if (rawUrl.startsWith('http://')) return `https://${rawUrl.slice(7)}`;
  return rawUrl;
}

function formatConversationTime(isoDateString: string | null): string {
  if (!isoDateString) return '';
  const d     = new Date(isoDateString);
  const today = new Date();
  const diff  = Math.floor((today.getTime() - d.getTime()) / 86_400_000);
  if (diff === 0) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (diff === 1) return 'Hier';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function buildInitials(name: string | null): string {
  if (!name) return '?';
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

function buildFacebookPagePictureUrl(pageId: string): string {
  return `https://graph.facebook.com/${pageId}/picture?type=large`;
}

export function mapConversation(api: ConversationApiResponse): Conv {
  return {
    id:                api.id,
    businessProfileId: api.businessProfileId,
    externalId:        api.externalId,
    clientPsid:        api.clientPsid,
    client:            api.clientName ?? api.clientPsid ?? 'Inconnu',
    initials:          buildInitials(api.clientName),
    avatarUrl:         normalizeAvatarUrl(api.clientAvatarUrl),
    lastMessage:       api.lastMessage ?? '',
    time:              formatConversationTime(api.lastMessageAt),
    mode:              api.handoverStatus === 'AI' ? 'ai' : 'human',
    unread:            api.unreadCount,
    online:            false,
    handoverStatus:    api.handoverStatus,
  };
}

// ─── Accounts ─────────────────────────────────────────────────────────────────

export async function fetchAccounts(): Promise<Account[]> {
  const response = await apiClient<{
    data: Array<{
      id: string; businessProfileId?: string; pageId: string;
      pageName: string; instagramAccountId?: string | null;
      tokenStatus: string; isActive: boolean;
    }>;
  }>(`${FACEBOOK_API_BASE}/connections`);

  return response.data
    .filter((c) => c.isActive)
    .map((c, i): Account => ({
      id:        c.businessProfileId ?? c.id,
      name:      c.pageName,
      initials:  buildInitials(c.pageName),
      color:     i % 2 === 0 ? 'bg-primary/15 text-primary' : 'bg-violet-500/15 text-violet-500',
      pageType:  'Page Facebook',
      verified:  c.tokenStatus === 'VALID',
      pageId:    c.pageId,
      avatarUrl: buildFacebookPagePictureUrl(c.pageId),
    }));
}

// ─── Conversations ────────────────────────────────────────────────────────────

export async function fetchConversations(params: {
  businessProfileId?: string; search?: string; page?: number; pageSize?: number;
}): Promise<{ data: Conv[]; total: number }> {
  const qs = new URLSearchParams();
  if (params.businessProfileId) qs.set('businessProfileId', params.businessProfileId);
  if (params.search)            qs.set('search', params.search);
  if (params.page)              qs.set('page', String(params.page));
  if (params.pageSize)          qs.set('pageSize', String(params.pageSize));
  const res = await apiClient<{ data: ConversationApiResponse[]; pagination: { total: number } }>(
    `${INBOX_API_BASE}/conversations?${qs}`,
  );
  return { data: res.data.map(mapConversation), total: res.pagination.total };
}

export async function markConversationRead(conversationId: string): Promise<void> {
  await apiClient(`${INBOX_API_BASE}/conversations/${conversationId}/read`, { method: 'POST' });
}

export async function setHandover(
  conversationId: string, status: 'AI' | 'HUMAN' | 'RESOLVED',
): Promise<Conv> {
  const res = await apiClient<ConversationApiResponse>(
    `${INBOX_API_BASE}/conversations/${conversationId}/handover`,
    { method: 'POST', body: JSON.stringify({ conversationId, status }) },
  );
  return mapConversation(res);
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function fetchMessages(
  conversationId: string, options: { before?: string; limit?: number } = {},
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
  conversationId: string, text: string,
): Promise<MessageApiResponse> {
  return apiClient<MessageApiResponse>(`${INBOX_API_BASE}/messages/text`, {
    method: 'POST', body: JSON.stringify({ conversationId, text }),
  });
}

export async function sendImagesMessage(
  conversationId: string, imageUrls: string[], caption?: string,
): Promise<MessageApiResponse[]> {
  return apiClient<MessageApiResponse[]>(`${INBOX_API_BASE}/messages/images`, {
    method: 'POST', body: JSON.stringify({ conversationId, imageUrls, caption }),
  });
}

export async function sendFileMessage(
  conversationId: string, fileUrl: string, fileName: string,
): Promise<MessageApiResponse> {
  return apiClient<MessageApiResponse>(`${INBOX_API_BASE}/messages/file`, {
    method: 'POST', body: JSON.stringify({ conversationId, fileUrl, fileName }),
  });
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

/**
 * First-connection full sync: fetches 40 conversations × 50 messages.
 * The backend emits sync_complete SSE when done. The return value is
 * also available for callers that don't use SSE.
 */
export async function performInitialSync(businessProfileId: string): Promise<{
  businessProfileId: string; newMessages: number; newConversations: number;
}> {
  return apiClient(`${INBOX_API_BASE}/initial-sync/${businessProfileId}`, { method: 'POST' });
}

/** Regular on-demand sync: fetches recent conversations and messages. */
export async function syncConversationList(businessProfileId: string): Promise<{ synced: number }> {
  return apiClient<{ synced: number }>(
    `${FACEBOOK_API_BASE}/sync/conversations/${businessProfileId}`, { method: 'POST' },
  );
}

/** Syncs a single conversation's messages from Facebook. */
export async function syncConversationOnOpen(conversationId: string): Promise<{ synced: number }> {
  return apiClient<{ synced: number }>(
    `${FACEBOOK_API_BASE}/sync/messages/${conversationId}`, { method: 'POST' },
  );
}

// ─── Temp upload ──────────────────────────────────────────────────────────────

export async function getTempUploadUrl(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await apiClient<{ url: string }>(`${INBOX_API_BASE}/uploads/temp`, {
    method: 'POST', body: formData,
  });
  return res.url;
}

// ─── Reference presets ────────────────────────────────────────────────────────

function mapReferencePreset(api: ReferencePresetApiResponse): PhotoPreset {
  return {
    id:                 api.id,
    name:               api.name,
    description:        api.description ?? '',
    referenceImageUrls: api.images.map((img) => img.url),
    photos:             api.images.map((img, i) => ({
      id:        img.id,
      objectUrl: img.url,
      gradient:  PHOTO_GRADIENT_PALETTE[i % PHOTO_GRADIENT_PALETTE.length],
    })),
  };
}

export async function fetchReferencePresets(businessProfileId: string): Promise<PhotoPreset[]> {
  const qs = new URLSearchParams({ businessProfileId });
  const res = await apiClient<ReferencePresetApiResponse[]>(
    `${INBOX_API_BASE}/reference-presets?${qs}`,
  );
  return res.map(mapReferencePreset);
}

export async function createReferencePreset(params: {
  businessProfileId: string; name: string; description: string; files: File[];
}): Promise<PhotoPreset> {
  const formData = new FormData();
  formData.append('businessProfileId', params.businessProfileId);
  formData.append('name', params.name);
  formData.append('description', params.description);
  for (const file of params.files) formData.append('images', file);
  const res = await apiClient<ReferencePresetApiResponse>(
    `${INBOX_API_BASE}/reference-presets`, { method: 'POST', body: formData },
  );
  return mapReferencePreset(res);
}

export async function deleteReferencePreset(presetId: string): Promise<void> {
  await apiClient(`${INBOX_API_BASE}/reference-presets/${presetId}`, { method: 'DELETE' });
}

// Profile AI settings are managed via /business-profiles/:id (BusinessProfileModule).
// The inbox service does not duplicate those endpoints here.


// ─── UI preferences (localStorage only, no DB) ────────────────────────────────

export interface InboxUiPrefs {
  compactMode:    boolean;
  soundEnabled:   boolean;
  showTimestamps: boolean;
  groupBubbles:   boolean;
  textDensity:    "normal" | "dense" | "spacious";
}

const UI_PREFS_KEY = 'vendeoai:inbox:uiprefs';

export function loadUiPrefs(): InboxUiPrefs {
  try {
    const raw = localStorage.getItem(UI_PREFS_KEY);
    if (raw) return { ...defaultUiPrefs(), ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return defaultUiPrefs();
}

export function saveUiPrefs(prefs: Partial<InboxUiPrefs>): void {
  try {
    const current = loadUiPrefs();
    localStorage.setItem(UI_PREFS_KEY, JSON.stringify({ ...current, ...prefs }));
  } catch { /* ignore */ }
}

function defaultUiPrefs(): InboxUiPrefs {
  return {
    compactMode:    false,
    soundEnabled:   true,
    showTimestamps: true,
    groupBubbles:   true,
    textDensity:    "normal",
  };
}
