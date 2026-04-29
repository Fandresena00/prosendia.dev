/**
 * @file features/inbox/services/inbox.service.ts
 *
 * All HTTP calls for the inbox feature.
 * Routes through apiClient (handles JWT auth + refresh).
 *
 * For message attachments that are NOT reference images:
 *   → Upload directly to Facebook via the Graph API (never stored in backend)
 * For reference images (presets):
 *   → POST /inbox/uploads/reference → stored in backend → permanent URL returned
 */

import { apiClient } from '@/lib/api-client';
import type {
  Account,
  Conv,
  ConversationApiResponse,
  MessageApiResponse,
  MessagesPageApiResponse,
} from '../types/inbox.types';

const BASE = '/inbox';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(isoDate: string | null): string {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 0)
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Hier';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function getInitials(name: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function mapConversation(c: ConversationApiResponse): Conv {
  return {
    id:               c.id,
    businessProfileId: c.businessProfileId,
    externalId:       c.externalId,
    clientPsid:       c.clientPsid,
    client:           c.clientName ?? c.clientPsid ?? 'Inconnu',
    initials:         getInitials(c.clientName),
    avatarUrl:        c.clientAvatarUrl,
    lastMessage:      c.lastMessage ?? '',
    time:             formatTime(c.lastMessageAt),
    mode:             c.handoverStatus === 'AI' ? 'ai' : 'human',
    unread:           c.unreadCount,
    online:           false,
    handoverStatus:   c.handoverStatus,
  };
}

// ─── Accounts (Facebook Pages) ────────────────────────────────────────────────

export async function fetchAccounts(): Promise<Account[]> {
  const data = await apiClient<{ data: Array<{
    id: string;
    businessProfileId?: string;
    pageId: string;
    pageName: string;
    instagramAccountId?: string | null;
    tokenStatus: string;
    isActive: boolean;
  }> }>('/facebook/connections');
  return data.data
    .filter((c) => c.isActive)
    .map((c, i): Account => ({
      id:       c.businessProfileId ?? c.id,
      name:     c.pageName,
      initials: getInitials(c.pageName),
      color:    i % 2 === 0 ? 'bg-primary/15 text-primary' : 'bg-violet-500/15 text-violet-500',
      pageType: 'Page Facebook',
      verified: c.tokenStatus === 'VALID',
      pageId:   c.pageId,
      avatarUrl: `https://graph.facebook.com/${c.pageId}/picture?type=large`,
    }));
}

// ─── Conversations ────────────────────────────────────────────────────────────

export async function fetchConversations(params: {
  businessProfileId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ data: Conv[]; total: number }> {
  const qs = new URLSearchParams();
  if (params.businessProfileId) qs.set('businessProfileId', params.businessProfileId);
  if (params.search)            qs.set('search', params.search);
  if (params.page)              qs.set('page', String(params.page));
  if (params.pageSize)          qs.set('pageSize', String(params.pageSize));

  const res = await apiClient<{ data: ConversationApiResponse[]; pagination: { total: number } }>(
    `${BASE}/conversations?${qs}`,
  );
  return { data: res.data.map(mapConversation), total: res.pagination.total };
}

export async function markConversationRead(conversationId: string): Promise<void> {
  await apiClient(`${BASE}/conversations/${conversationId}/read`, { method: 'POST' });
}

export async function setHandover(
  conversationId: string,
  status: 'AI' | 'HUMAN' | 'RESOLVED',
): Promise<Conv> {
  const res = await apiClient<ConversationApiResponse>(
    `${BASE}/conversations/${conversationId}/handover`,
    { method: 'POST', body: JSON.stringify({ conversationId, status }) },
  );
  return mapConversation(res);
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function fetchMessages(
  conversationId: string,
  opts: { before?: string; limit?: number } = {},
): Promise<MessagesPageApiResponse> {
  const qs = new URLSearchParams();
  if (opts.before) qs.set('before', opts.before);
  if (opts.limit)  qs.set('limit',  String(opts.limit));
  return apiClient<MessagesPageApiResponse>(
    `${BASE}/conversations/${conversationId}/messages?${qs}`,
  );
}

// ─── Send ─────────────────────────────────────────────────────────────────────

export async function sendTextMessage(
  conversationId: string,
  text: string,
): Promise<MessageApiResponse> {
  return apiClient<MessageApiResponse>(`${BASE}/messages/text`, {
    method: 'POST',
    body: JSON.stringify({ conversationId, text }),
  });
}

export async function sendImagesMessage(
  conversationId: string,
  imageUrls: string[],
  caption?: string,
): Promise<MessageApiResponse[]> {
  return apiClient<MessageApiResponse[]>(`${BASE}/messages/images`, {
    method: 'POST',
    body: JSON.stringify({ conversationId, imageUrls, caption }),
  });
}

export async function sendFileMessage(
  conversationId: string,
  fileUrl: string,
  fileName: string,
): Promise<MessageApiResponse> {
  return apiClient<MessageApiResponse>(`${BASE}/messages/file`, {
    method: 'POST',
    body: JSON.stringify({ conversationId, fileUrl, fileName }),
  });
}

// ─── Reference image upload ────────────────────────────────────────────────────

/**
 * Upload reference images to the backend (persistent storage).
 * Returns permanent backend-hosted URLs.
 */
export async function uploadReferenceImages(files: File[]): Promise<string[]> {
  const form = new FormData();
  for (const f of files) form.append('images', f);
  const res = await apiClient<{ urls: string[] }>(`${BASE}/uploads/reference`, {
    method: 'POST',
    body: form,
    // apiClient must NOT set Content-Type here — let the browser set multipart boundary
  });
  return res.urls;
}

/**
 * Get a temporary public URL for a blob: file so Facebook can download it.
 * Strategy: upload to the backend as a temp file, get back a short-lived URL.
 * This URL is passed directly to the Facebook Graph API.
 */
export async function getTempUploadUrl(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await apiClient<{ url: string }>(`${BASE}/uploads/temp`, {
    method: 'POST',
    body: form,
  });
  return res.url;
}

// ─── Manual sync ──────────────────────────────────────────────────────────────

export async function triggerSync(businessProfileId: string): Promise<void> {
  await apiClient(`${BASE}/sync/${businessProfileId}`, { method: 'POST' });
}
