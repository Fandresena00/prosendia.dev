/**
 * @file features/facebook/types/facebook.types.ts
 */

import { z } from "zod";

/* ─── Facebook page (UI model) ─── */
export const facebookPageSchema = z.object({
  id: z.string(),
  accountId: z.string(),          // = businessProfileId
  name: z.string(),
  connected: z.boolean(),
  active: z.boolean(),
  lastSync: z.string(),           // human-readable
  lastSyncedAt: z.string().nullable(),
  category: z.string(),
  avatar: z.string(),
  pageUrl: z.string().url(),
  webhookSubscribed: z.boolean(),
  tokenStatus: z.string(),
  /* Stats — populated from Facebook Graph API via sync */
  followersCount: z.number(),
  fanCount: z.number(),
  conversationsSynced: z.number(),
  postsSynced: z.number(),
});

/* ─── Raw API connection from backend ─── */
export const connectionResponseSchema = z.object({
  id: z.string(),
  businessProfileId: z.string(),
  pageId: z.string(),
  pageName: z.string(),
  tokenStatus: z.string(),
  tokenValidatedAt: z.string().nullable(),
  webhookSubscribed: z.boolean(),
  isActive: z.boolean(),
  grantedScopes: z.array(z.string()),
  instagramAccountId: z.string().nullable(),
  lastSyncedAt: z.string().nullable(),
  createdAt: z.string(),
});

/* ─── Page public info from Facebook Graph (no token needed for public pages) ─── */
export const facebookPageInfoSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  category: z.string().optional(),
  fan_count: z.number().optional(),
  followers_count: z.number().optional(),
  about: z.string().optional(),
  website: z.string().optional(),
});

/* ─── OAuth ─── */
export const oauthUrlResponseSchema = z.object({ url: z.string().url() });

export const oauthCallbackPageSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  accessToken: z.string(),
  instagramAccountId: z.string().nullable(),
});

export const oauthCallbackResponseSchema = z.object({
  pages: z.array(oauthCallbackPageSchema),
});

/* ─── Sync ─── */
export const syncResultSchema = z.object({ synced: z.number() });

/**
 * Per-page sync summary — tracks what was synced and any partial failures.
 */
export interface SyncSummary {
  businessProfileId: string;
  conversations: number;  // count synced, -1 = failed
  posts: number;          // count synced, -1 = failed/permission denied
  timestamp: Date;
}

/* ─── Exported types ─── */
export type FacebookPage       = z.infer<typeof facebookPageSchema>;
export type FacebookConnection = z.infer<typeof connectionResponseSchema>;
export type OAuthCallbackPage  = z.infer<typeof oauthCallbackPageSchema>;
export type SyncResult         = z.infer<typeof syncResultSchema>;
export type FacebookPageInfo   = z.infer<typeof facebookPageInfoSchema>;

export type TokenHealth = "valid" | "invalid" | "expiring" | "unknown";

export function getTokenHealth(tokenStatus: string): TokenHealth {
  switch (tokenStatus.toUpperCase()) {
    case "VALID":    return "valid";
    case "INVALID":  return "invalid";
    case "EXPIRING": return "expiring";
    default:         return "unknown";
  }
}
