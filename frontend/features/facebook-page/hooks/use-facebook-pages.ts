/**
 * @file features/facebook/hooks/use-facebook-pages.ts
 *
 * Manages the full lifecycle of Facebook page connections in the UI:
 * - Fetches and maps connections to UI-enriched FacebookPage objects
 * - Syncs page stats (conversations, posts, Graph API follower counts)
 * - Schedules automatic syncs at 00:00 and 12:00 every day
 * - Exposes per-page SyncSummary for rich feedback in the card
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
import { getTokenHealth } from "../types/facebook.types";

// ─── Mapper ───────────────────────────────────────────────────────────────────

function formatLastSync(isoDate: string | null | undefined): string {
  if (!isoDate) return "Jamais synchronisée";
  return new Date(isoDate).toLocaleString("fr-FR", {
    day:    "2-digit",
    month:  "short",
    hour:   "2-digit",
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
    tokenExpiresAt:      conn.tokenExpiresAt ?? null,
    tokenHealth:         getTokenHealth(conn.tokenStatus, conn.tokenExpiresAt),
    followersCount:      0,
    fanCount:            0,
    conversationsSynced: 0,
    postsSynced:         0,
  };
}

// ─── Auto-sync scheduling ─────────────────────────────────────────────────────

/** Returns milliseconds until the next 00:00 or 12:00 target. */
function msUntilNextAutoSync(): number {
  const now  = new Date();
  const next = new Date(now);
  const h    = now.getHours();

  if (h < 12) {
    // Before noon → next target is today at 12:00
    next.setHours(12, 0, 0, 0);
  } else {
    // After noon (or exactly noon) → next target is midnight tomorrow
    next.setDate(next.getDate() + 1);
    next.setHours(0, 0, 0, 0);
  }

  return next.getTime() - now.getTime();
}

// ─── Hook interface ───────────────────────────────────────────────────────────

export interface UseFacebookPagesResult {
  pages:         FacebookPage[];
  loading:       boolean;
  /** Set of businessProfileIds currently being synced */
  syncingIds:    Set<string>;
  /** Last sync result per businessProfileId */
  syncSummaries: Map<string, SyncSummary>;
  refresh:       () => Promise<void>;
  removePage:    (businessProfileId: string) => Promise<void>;
  syncPage:      (businessProfileId: string) => Promise<SyncSummary>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useFacebookPages(): UseFacebookPagesResult {
  const [pages,         setPages]         = useState<FacebookPage[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [syncingIds,    setSyncingIds]    = useState<Set<string>>(new Set());
  const [syncSummaries, setSyncSummaries] = useState<Map<string, SyncSummary>>(new Map());

  // Stable ref so the auto-sync timeout can always read the latest pages
  const pagesRef = useRef<FacebookPage[]>([]);
  pagesRef.current = pages;

  // ── Fetch from backend ──────────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const connections = await listConnections();

      setPages((prev) => {
        // Preserve live stats (followers, conversations) that are not in the API response
        const statsMap = new Map(
          prev.map((p) => [
            p.accountId,
            {
              followersCount:      p.followersCount,
              fanCount:            p.fanCount,
              conversationsSynced: p.conversationsSynced,
              postsSynced:         p.postsSynced,
            },
          ]),
        );
        return connections.map((conn) => ({
          ...mapConnection(conn),
          ...(statsMap.get(conn.businessProfileId) ?? {}),
        }));
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Disconnect ──────────────────────────────────────────────────────────────

  const removePage = useCallback(
    async (businessProfileId: string) => {
      await disconnectPage(businessProfileId);
      await refresh();
    },
    [refresh],
  );

  // ── Sync a single page ──────────────────────────────────────────────────────

  const syncPage = useCallback(
    async (businessProfileId: string): Promise<SyncSummary> => {
      setSyncingIds((prev) => new Set(prev).add(businessProfileId));

      const targetPage = pagesRef.current.find((p) => p.accountId === businessProfileId);
      const pageId     = targetPage?.id;

      let conversationsSynced = -1;
      let postsSynced         = -1;

      try {
        // Run sync + Graph API call in parallel — posts failure is non-fatal
        const [convsResult, postsResult, pageInfo] = await Promise.allSettled([
          syncPageConversations(businessProfileId),
          syncPagePosts(businessProfileId),
          pageId ? fetchPagePublicInfo(pageId) : Promise.resolve(null),
        ]);

        if (convsResult.status === "fulfilled") {
          conversationsSynced = convsResult.value.synced;
        }
        if (postsResult.status === "fulfilled") {
          postsSynced =
            postsResult.value.status === "skipped" ||
            postsResult.value.code === "MISSING_PERMISSION"
              ? -1
              : postsResult.value.synced;
        }

        const graphInfo =
          pageInfo.status === "fulfilled" ? pageInfo.value : null;

        // Refresh connections to pick up the new lastSyncedAt timestamp
        // then merge live stats for this specific page
        const freshConnections = await listConnections();

        setPages(
          freshConnections.map((conn): FacebookPage => {
            const base     = mapConnection(conn);
            const isTarget = conn.businessProfileId === businessProfileId;

            if (!isTarget) {
              // Preserve stats for unrelated pages
              const existing = pagesRef.current.find((p) => p.accountId === conn.businessProfileId);
              return existing ? { ...base, ...pickStats(existing) } : base;
            }

            return {
              ...base,
              followersCount:      graphInfo?.followers_count ?? targetPage?.followersCount ?? 0,
              fanCount:            graphInfo?.fan_count        ?? targetPage?.fanCount        ?? 0,
              category:            graphInfo?.category         ?? base.category,
              conversationsSynced: Math.max(0, conversationsSynced),
              postsSynced:         Math.max(0, postsSynced),
            };
          }),
        );

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

  // ── Auto-sync at 00:00 and 12:00 ───────────────────────────────────────────

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const scheduleNext = () => {
      timeoutId = setTimeout(async () => {
        // Fire-and-forget — sync all connected pages, swallow individual failures
        for (const page of pagesRef.current) {
          await syncPage(page.accountId).catch(() => undefined);
        }
        scheduleNext();
      }, msUntilNextAutoSync());
    };

    scheduleNext();
    return () => clearTimeout(timeoutId);
  }, [syncPage]);

  // ── Initial fetch ───────────────────────────────────────────────────────────

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { pages, loading, syncingIds, syncSummaries, refresh, removePage, syncPage };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pickStats(
  page: FacebookPage,
): Pick<FacebookPage, "followersCount" | "fanCount" | "conversationsSynced" | "postsSynced"> {
  return {
    followersCount:      page.followersCount,
    fanCount:            page.fanCount,
    conversationsSynced: page.conversationsSynced,
    postsSynced:         page.postsSynced,
  };
}
