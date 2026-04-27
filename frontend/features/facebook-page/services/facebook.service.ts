/**
 * @file features/facebook/services/facebook.service.ts
 *
 * All backend calls go through apiClient (auto auth + refresh).
 * fetchPagePublicInfo fetches real stats directly from Facebook Graph API.
 */

import { apiClient } from "@/lib/api-client";
import {
  connectionResponseSchema,
  FacebookConnection,
  FacebookPageInfo,
  facebookPageInfoSchema,
  oauthCallbackResponseSchema,
  oauthUrlResponseSchema,
  OAuthCallbackPage,
  SyncResult,
  syncResultSchema,
} from "../types/facebook.types";

const BASE         = "/facebook";
const GRAPH_BASE   = "https://graph.facebook.com/v25.0";

/* ─── OAuth ─── */

export async function getOAuthUrl(businessProfileId: string): Promise<string> {
  const data = await apiClient<{ url: string }>(
    `${BASE}/oauth/url?businessProfileId=${encodeURIComponent(businessProfileId)}`,
  );
  return oauthUrlResponseSchema.parse(data).url;
}

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

/* ─── Connections ─── */

export async function listConnections(): Promise<FacebookConnection[]> {
  const data = await apiClient<unknown[]>(`${BASE}/connections`);
  return data.map((item) => connectionResponseSchema.parse(item));
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

/* ─── Sync ─── */

/**
 * Sync conversations — should succeed for all pages with pages_messaging.
 * Returns number of conversations synced.
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
 * Sync posts — may fail with (#10) if pages_read_engagement is not granted.
 * The hook handles this gracefully; never throw to the UI.
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

/* ─── Facebook Graph — public page info ─── */

/**
 * Fetches publicly available page stats directly from Facebook Graph API.
 * Works for public pages without a user token (uses app-level access or public data).
 *
 * Fields: fan_count, followers_count, category, about, website.
 * Note: fan_count requires the page to be public. Falls back gracefully on error.
 */
export async function fetchPagePublicInfo(pageId: string): Promise<FacebookPageInfo | null> {
  try {
    const fields = "id,name,category,fan_count,followers_count,about,website";
    const url    = `${GRAPH_BASE}/${pageId}?fields=${fields}`;
    const res    = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const json   = await res.json();
    // Facebook returns an error object, not HTTP error status, for auth failures
    if ("error" in json) return null;
    return facebookPageInfoSchema.parse(json);
  } catch {
    return null;
  }
}
