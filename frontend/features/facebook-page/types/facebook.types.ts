/**
 * @file features/facebook/types/facebook.types.ts
 *
 * Zod schemas validate all data crossing the API boundary.
 * Types are inferred from schemas — no manual duplication.
 */

import { z } from "zod";

// ─── Token health ─────────────────────────────────────────────────────────────

/**
 * UI-friendly token health derived from the backend TokenStatus enum.
 * "expiring" is a client-side concept (token expires within 7 days).
 */
export type TokenHealth = "valid" | "invalid" | "expiring" | "unknown";

export function getTokenHealth(
  tokenStatus: string,
  tokenExpiresAt?: string | null,
): TokenHealth {
  const status = tokenStatus.toUpperCase();

  if (status === "INVALID") return "invalid";

  if (status === "VALID" && tokenExpiresAt) {
    const expiresMs = new Date(tokenExpiresAt).getTime() - Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    if (expiresMs > 0 && expiresMs < sevenDaysMs) return "expiring";
  }

  if (status === "VALID") return "valid";
  return "unknown";
}

// ─── Backend connection response ──────────────────────────────────────────────

/** Mirrors FacebookConnectionResponseDto from the backend. */
export const connectionResponseSchema = z.object({
  id:                  z.string(),
  businessProfileId:   z.string(),
  pageId:              z.string(),
  pageName:            z.string(),
  tokenStatus:         z.string(),
  tokenValidatedAt:    z.string().nullable(),
  /** Added in schema v2 — null for non-expiring page tokens. */
  tokenExpiresAt:      z.string().nullable().optional(),
  webhookSubscribed:   z.boolean(),
  isActive:            z.boolean(),
  grantedScopes:       z.array(z.string()),
  instagramAccountId:  z.string().nullable(),
  lastSyncedAt:        z.string().nullable(),
  createdAt:           z.string(),
});

/** Paginated wrapper returned by GET /facebook/connections */
export const paginatedConnectionsSchema = z.object({
  data:       z.array(connectionResponseSchema),
  pagination: z.object({
    page:       z.number(),
    pageSize:   z.number(),
    total:      z.number(),
    totalPages: z.number(),
  }),
});

// ─── OAuth ────────────────────────────────────────────────────────────────────

export const oauthUrlResponseSchema = z.object({ url: z.string().url() });

/** Mirrors OAuthPageOption from FacebookAuthService.handleCallback() */
export const oauthCallbackPageSchema = z.object({
  id:                 z.string(),
  name:               z.string(),
  category:           z.string(),
  accessToken:        z.string(),
  instagramAccountId: z.string().nullable(),
});

export const oauthCallbackResponseSchema = z.object({
  pages: z.array(oauthCallbackPageSchema),
});

// ─── Sync ─────────────────────────────────────────────────────────────────────

export const syncResultSchema = z.object({ synced: z.number() });

/** Per-page sync summary stored in the hook — tracks counts and partial failures. */
export interface SyncSummary {
  businessProfileId: string;
  /** Conversations synced, or -1 if the request failed. */
  conversations: number;
  /** Posts synced, or -1 if the request failed (e.g. missing permission). */
  posts: number;
  timestamp: Date;
}

// ─── Facebook Graph public info ───────────────────────────────────────────────

/** Subset of the Graph API response for a public page (no user token). */
export const facebookPageInfoSchema = z.object({
  id:               z.string(),
  name:             z.string().optional(),
  category:         z.string().optional(),
  fan_count:        z.number().optional(),
  followers_count:  z.number().optional(),
  about:            z.string().optional(),
  website:          z.string().optional(),
});

// ─── UI page model ────────────────────────────────────────────────────────────

/**
 * Derived, UI-enriched model rendered in FacebookPageCard.
 * Built by the hook from raw FacebookConnection data + optional Graph API stats.
 */
export const facebookPageSchema = z.object({
  id:                  z.string(),   // Facebook Page ID
  accountId:           z.string(),   // businessProfileId — used for all API calls
  name:                z.string(),
  connected:           z.boolean(),
  active:              z.boolean(),
  lastSync:            z.string(),   // Human-readable, e.g. "02 jan. à 14:00"
  lastSyncedAt:        z.string().nullable(),
  category:            z.string(),
  avatar:              z.string(),
  pageUrl:             z.string(),
  webhookSubscribed:   z.boolean(),
  tokenStatus:         z.string(),
  tokenExpiresAt:      z.string().nullable().optional(),
  tokenHealth:         z.enum(["valid", "invalid", "expiring", "unknown"]),
  /** Live stats fetched from Facebook Graph API on each sync */
  followersCount:      z.number(),
  fanCount:            z.number(),
  conversationsSynced: z.number(),
  postsSynced:         z.number(),
});

// ─── Exported types ───────────────────────────────────────────────────────────

export type FacebookPage       = z.infer<typeof facebookPageSchema>;
export type FacebookConnection = z.infer<typeof connectionResponseSchema>;
export type OAuthCallbackPage  = z.infer<typeof oauthCallbackPageSchema>;
export type SyncResult         = z.infer<typeof syncResultSchema>;
export type FacebookPageInfo   = z.infer<typeof facebookPageInfoSchema>;

/**
 * Plan-based limit info for connected Facebook pages, surfaced from
 * GET /billing/status (CreditStatusDto.maxPages). Mirrors the
 * ManagedPostsLimitInfo pattern used for the posts/comments feature.
 */
export interface ConnectedPagesLimitInfo {
  current:  number;
  max:      number | null; // null = unlimited (CUSTOM plan)
  planName: string;
}
