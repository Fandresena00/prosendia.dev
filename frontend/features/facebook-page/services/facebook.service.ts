/**
 * @file features/facebook/services/facebook.service.ts
 *
 * All backend calls route through apiClient (handles JWT auth + refresh).
 * fetchPagePublicInfo calls the Facebook Graph API directly for live page stats.
 *
 * Endpoints map:
 *   GET  /facebook/oauth/url              → getOAuthUrl
 *   POST /facebook/oauth/callback         → handleOAuthCallback
 *   GET  /facebook/connections            → listConnections       (paginated)
 *   GET  /facebook/connections/:id        → getConnection
 *   POST /facebook/connect                → connectPage
 *   DEL  /facebook/disconnect/:id         → disconnectPage
 *   POST /facebook/sync/conversations/:id → syncPageConversations
 *   POST /facebook/sync/posts/:id         → syncPagePosts
 *   POST /facebook/messages/send          → sendMessage
 *   POST /facebook/comments/:id/reply     → replyToComment
 */

import { apiClient } from "@/lib/api-client";
import {
  type FacebookConnection,
  type FacebookPageInfo,
  type OAuthCallbackPage,
  type SyncResult,
  connectionResponseSchema,
  facebookPageInfoSchema,
  oauthCallbackResponseSchema,
  oauthUrlResponseSchema,
  paginatedConnectionsSchema,
  syncResultSchema,
} from "../types/facebook.types";

const BASE       = "/facebook";
const GRAPH_BASE = "https://graph.facebook.com/v25.0";

// ─── OAuth ────────────────────────────────────────────────────────────────────

export async function getOAuthUrl(businessProfileId: string): Promise<string> {
  const data = await apiClient<{ url: string }>(
    `${BASE}/oauth/url?businessProfileId=${encodeURIComponent(businessProfileId)}`,
  );
  return oauthUrlResponseSchema.parse(data).url;
}

/**
 * Exchange OAuth code for page tokens.
 * Call this in the `/facebook/callback` route handler after Facebook redirects back.
 * Store the returned pages in sessionStorage, then redirect to `?oauth=ok`.
 */
export async function handleOAuthCallback(
  code: string,
  businessProfileId: string,
): Promise<{ pages: OAuthCallbackPage[] }> {
  const data = await apiClient<unknown>(`${BASE}/oauth/callback`, {
    method: "POST",
    body: JSON.stringify({ code, businessProfileId }),
  });
  return oauthCallbackResponseSchema.parse(data);
}

// ─── Connections ──────────────────────────────────────────────────────────────

/**
 * Fetch all Facebook connections for the authenticated user.
 * Backend returns a paginated wrapper — we extract `.data` and return the array.
 */
export async function listConnections(): Promise<FacebookConnection[]> {
  const raw = await apiClient<unknown>(`${BASE}/connections`);
  const parsed = paginatedConnectionsSchema.parse(raw);
  return parsed.data;
}

export async function getConnection(
  businessProfileId: string,
): Promise<FacebookConnection> {
  const raw = await apiClient<unknown>(
    `${BASE}/connections/${encodeURIComponent(businessProfileId)}`,
  );
  return connectionResponseSchema.parse(raw);
}

export async function connectPage(payload: {
  pageId: string;
  pageAccessToken: string;
  pageName: string;
  instagramAccountId?: string;
  grantedScopes?: string;
}): Promise<FacebookConnection> {
  const data = await apiClient<unknown>(`${BASE}/connect`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return connectionResponseSchema.parse(data);
}

export async function disconnectPage(businessProfileId: string): Promise<void> {
  await apiClient(
    `${BASE}/disconnect/${encodeURIComponent(businessProfileId)}`,
    { method: "DELETE" },
  );
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

/**
 * Sync Messenger conversations — always works if pages_messaging is granted.
 */
export async function syncPageConversations(
  businessProfileId: string,
  limit = 20,
): Promise<SyncResult> {
  const data = await apiClient<unknown>(
    `${BASE}/sync/conversations/${encodeURIComponent(businessProfileId)}?limit=${limit}`,
    { method: "POST" },
  );
  return syncResultSchema.parse(data);
}

/**
 * Sync page posts — may fail with (#10) if pages_manage_posts is not granted.
 * The hook handles this gracefully. Do not propagate permission errors to the UI.
 */
export async function syncPagePosts(
  businessProfileId: string,
  limit = 10,
): Promise<SyncResult> {
  const data = await apiClient<unknown>(
    `${BASE}/sync/posts/${encodeURIComponent(businessProfileId)}?limit=${limit}`,
    { method: "POST" },
  );
  return syncResultSchema.parse(data);
}

// ─── Messaging ────────────────────────────────────────────────────────────────

export async function sendMessage(payload: {
  businessProfileId: string;
  recipientPsid: string;
  text: string;
}): Promise<{ recipientId: string; messageId: string }> {
  return apiClient(`${BASE}/messages/send`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function replyToComment(
  externalCommentId: string,
  payload: { businessProfileId: string; message: string },
): Promise<{ commentId: string }> {
  return apiClient(`${BASE}/comments/${encodeURIComponent(externalCommentId)}/reply`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ─── Facebook Graph — public page stats ──────────────────────────────────────

/**
 * Fetches public page stats from the Facebook Graph API.
 *
 * Note: fan_count and followers_count are only available for pages the app
 * has a connection to (via the stored page token on the backend). This call
 * is made without a token and may return partial data for strictly private pages.
 * Fails gracefully — returns null on any error.
 */
export async function fetchPagePublicInfo(
  pageId: string,
): Promise<FacebookPageInfo | null> {
  try {
    const fields = "id,name,category,fan_count,followers_count,about,website";
    const res = await fetch(`${GRAPH_BASE}/${pageId}?fields=${fields}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    // Facebook returns an error object in the body (not HTTP status) for auth issues
    if ("error" in json) return null;
    return facebookPageInfoSchema.parse(json);
  } catch {
    return null;
  }
}
