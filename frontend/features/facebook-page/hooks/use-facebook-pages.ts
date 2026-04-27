/**
 * @file features/facebook/hooks/use-facebook-pages.ts
 *
 * - Fetches connections and maps them to UI pages
 * - On sync: fetches real page stats (fan_count, followers) from Facebook Graph
 * - Handles partial sync failures gracefully (posts may fail on missing permissions)
 * - Auto-syncs all pages at 12:00 and 00:00 every day
 * - Exposes per-page SyncSummary for rich UI feedback
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  disconnectPage,
  fetchPagePublicInfo,
  listConnections,
  syncPageConversations,
  syncPagePosts,
} from "../services/facebook.service";
import type {
  FacebookConnection,
  FacebookPage,
  SyncSummary,
} from "../types/facebook.types";

/* ─────────────────────────────────────────────
   Mapper helpers
───────────────────────────────────────────── */

function formatLastSync(isoDate: string | null | undefined): string {
  if (!isoDate) return "Jamais";
  return new Date(isoDate).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function mapConnection(conn: FacebookConnection): FacebookPage {
  return {
    id:                  conn.pageId,
    accountId:           conn.businessProfileId,
    name:                conn.pageName,
    connected:           conn.isActive,
    active:              conn.isActive,
    lastSync:            formatLastSync(conn.lastSyncedAt),
    lastSyncedAt:        conn.lastSyncedAt,
    category:            "Page Facebook",
    avatar:              `https://graph.facebook.com/${conn.pageId}/picture?type=large`,
    pageUrl:             `https://facebook.com/${conn.pageId}`,
    webhookSubscribed:   conn.webhookSubscribed,
    tokenStatus:         conn.tokenStatus,
    /* Stats — updated by syncPage() */
    followersCount:      0,
    fanCount:            0,
    conversationsSynced: 0,
    postsSynced:         0,
  };
}

/* ─────────────────────────────────────────────
   Milliseconds until next 12:00 or 00:00
───────────────────────────────────────────── */
function msUntilNextAutoSync(): number {
  const now   = new Date();
  const next  = new Date(now);
  const h     = now.getHours();

  if (h < 0) {
    next.setHours(0, 0, 0, 0);
  } else if (h < 12) {
    next.setHours(12, 0, 0, 0);
  } else {
    // after 12pm → next sync at midnight tomorrow
    next.setDate(next.getDate() + 1);
    next.setHours(0, 0, 0, 0);
  }

  return next.getTime() - now.getTime();
}

/* ─────────────────────────────────────────────
   Hook
───────────────────────────────────────────── */

export interface UseFacebookPagesResult {
  pages:      FacebookPage[];
  loading:    boolean;
  /** businessProfileIds currently being synced */
  syncingIds: Set<string>;
  /** Per-page last sync summary — keyed by businessProfileId */
  syncSummaries: Map<string, SyncSummary>;
  refresh:    () => Promise<void>;
  removePage: (businessProfileId: string) => Promise<void>;
  syncPage:   (businessProfileId: string) => Promise<SyncSummary>;
}

export function useFacebookPages(): UseFacebookPagesResult {
  const [pages,         setPages]         = useState<FacebookPage[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [syncingIds,    setSyncingIds]    = useState<Set<string>>(new Set());
  const [syncSummaries, setSyncSummaries] = useState<Map<string, SyncSummary>>(new Map());

  /* Keep a stable ref to pages for the auto-sync callback */
  const pagesRef = useRef<FacebookPage[]>([]);
  pagesRef.current = pages;

  /* ── Fetch connections from backend ── */
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const connections = await listConnections();
      setPages((prev) => {
        // Preserve synced stats that are not in the connection response
        const statsMap = new Map(prev.map((p) => [p.accountId, {
          followersCount:      p.followersCount,
          fanCount:            p.fanCount,
          conversationsSynced: p.conversationsSynced,
          postsSynced:         p.postsSynced,
        }]));
        return connections.map((conn) => ({
          ...mapConnection(conn),
          ...(statsMap.get(conn.businessProfileId) ?? {}),
        }));
      });
    } finally {
      setLoading(false);
    }
  }, []);

  /* ── Disconnect ── */
  const removePage = useCallback(
    async (businessProfileId: string) => {
      await disconnectPage(businessProfileId);
      await refresh();
    },
    [refresh],
  );

  /* ── Sync a single page ── */
  const syncPage = useCallback(
    async (businessProfileId: string): Promise<SyncSummary> => {
      setSyncingIds((prev) => new Set(prev).add(businessProfileId));

      /* Find the pageId for this businessProfile */
      const page = pagesRef.current.find((p) => p.accountId === businessProfileId);
      const pageId = page?.id;

      let conversationsSynced = -1;
      let postsSynced         = -1;

      try {
        /* ── 1. Sync conversations (should always succeed) ── */
        const [convsResult, postsResult] = await Promise.allSettled([
          syncPageConversations(businessProfileId),
          syncPagePosts(businessProfileId),
        ]);

        if (convsResult.status === "fulfilled") {
          conversationsSynced = convsResult.value.synced;
        }
        if (postsResult.status === "fulfilled") {
          postsSynced = postsResult.value.synced;
        }
        // If posts failed with permission error, we silently swallow it.
        // conversationsSynced will still be a positive number.

        /* ── 2. Fetch real page stats from Facebook Graph API ── */
        const pageInfo = pageId ? await fetchPagePublicInfo(pageId) : null;

        /* ── 3. Refresh connections to pick up new lastSyncedAt ── */
        const connections = await listConnections();
        setPages((prev) => {
          const statsMap = new Map(prev.map((p) => [p.accountId, {
            followersCount:      p.followersCount,
            fanCount:            p.fanCount,
            conversationsSynced: p.conversationsSynced,
            postsSynced:         p.postsSynced,
          }]));
          return connections.map((conn) => {
            const base   = { ...mapConnection(conn), ...(statsMap.get(conn.businessProfileId) ?? {}) };
            const isThis = conn.businessProfileId === businessProfileId;
            return isThis ? {
              ...base,
              followersCount:      pageInfo?.followers_count ?? base.followersCount,
              fanCount:            pageInfo?.fan_count        ?? base.fanCount,
              category:            pageInfo?.category         ?? base.category,
              conversationsSynced: Math.max(0, conversationsSynced),
              postsSynced:         Math.max(0, postsSynced),
            } : base;
          });
        });

        const summary: SyncSummary = {
          businessProfileId,
          conversations: conversationsSynced,
          posts:         postsSynced,
          timestamp:     new Date(),
        };
        setSyncSummaries((prev) => new Map(prev).set(businessProfileId, summary));
        return summary;

      } finally {
        setSyncingIds((prev) => {
          const next = new Set(prev);
          next.delete(businessProfileId);
          return next;
        });
      }
    },
    [],
  );

  /* ── Auto-sync all pages at 12:00 and 00:00 ── */
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const scheduleNext = () => {
      const delay = msUntilNextAutoSync();
      timeoutId = setTimeout(async () => {
        const current = pagesRef.current;
        // Fire-and-forget — don't block UI
        for (const page of current) {
          await syncPage(page.accountId).catch(() => { /* silent */ });
        }
        scheduleNext(); // schedule the next occurrence
      }, delay);
    };

    scheduleNext();
    return () => clearTimeout(timeoutId);
  }, [syncPage]);

  /* ── Initial fetch ── */
  useEffect(() => { refresh(); }, [refresh]);

  return { pages, loading, syncingIds, syncSummaries, refresh, removePage, syncPage };
}
