"use client";
/**
 * @file features/facebook/hooks/use-facebook-pages.ts
 *
 * FIXES
 * ─────
 * 1. CRASH FIX: `refresh` no longer propagates AuthenticationError as an
 *    unhandled promise rejection. It catches it, calls handleAuthError (which
 *    sets store status → "unauthenticated"), and returns silently.
 *    The global `auth:expired` event + useAuthErrorHandler then redirects.
 *
 * 2. RACE CONDITION FIX: API calls only start when `status === "authenticated"`.
 *    Previously the hook fetched on mount regardless of auth state, causing
 *    401 → silentRefresh → 401 → AuthenticationError → crash before the auth
 *    guard had a chance to redirect.
 *
 * 3. RESET ON LOGOUT: Pages state is cleared when status leaves "authenticated".
 *    Prevents stale data from a previous session appearing after re-login.
 *
 * 4. NEW — connectedPagesLimit: plan-based limit on connected Facebook pages
 *    (BILLING_PLANS.<plan>.maxPages, enforced backend-side in
 *    FacebookAuthService.connectPage). Fetched once from /billing/status and
 *    kept in sync with `pages.length` so ConnectAccountDialog / the page
 *    header can show "2/2 pages" and disable the connect CTA instead of
 *    letting the OAuth flow run all the way through only to fail at the
 *    final step with an unexplained error.
 */

import { useAuthStore } from "@/features/auth/store/auth.store";
import { apiClient } from "@/lib/api-client";
import { AuthenticationError, NetworkError } from "@/lib/errors";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  disconnectPage,
  fetchPagePublicInfo,
  listConnections,
  syncPageConversations,
  syncPagePosts,
} from "../services/facebook.service";
import type {
  ConnectedPagesLimitInfo,
  FacebookConnection,
  FacebookPage,
  SyncSummary,
} from "../types/facebook.types";
import { getTokenHealth } from "../types/facebook.types";

// ─── Mapper ───────────────────────────────────────────────────────────────────

function formatLastSync(isoDate: string | null | undefined): string {
  if (!isoDate) return "Jamais synchronisée";
  return new Date(isoDate).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function mapConnection(conn: FacebookConnection): FacebookPage {
  return {
    id: conn.pageId,
    accountId: conn.businessProfileId,
    name: conn.pageName,
    connected: conn.isActive,
    active: conn.isActive,
    lastSync: formatLastSync(conn.lastSyncedAt),
    lastSyncedAt: conn.lastSyncedAt,
    category: "Page Facebook",
    avatar: `https://graph.facebook.com/${conn.pageId}/picture?type=large`,
    pageUrl: `https://facebook.com/${conn.pageId}`,
    webhookSubscribed: conn.webhookSubscribed,
    tokenStatus: conn.tokenStatus,
    tokenExpiresAt: conn.tokenExpiresAt ?? null,
    tokenHealth: getTokenHealth(conn.tokenStatus, conn.tokenExpiresAt),
    followersCount: 0,
    fanCount: 0,
    conversationsSynced: 0,
    postsSynced: 0,
  };
}

// ─── Auto-sync scheduling ─────────────────────────────────────────────────────

function msUntilNextAutoSync(): number {
  const now = new Date();
  const next = new Date(now);
  if (now.getHours() < 12) {
    next.setHours(12, 0, 0, 0);
  } else {
    next.setDate(next.getDate() + 1);
    next.setHours(0, 0, 0, 0);
  }
  return next.getTime() - now.getTime();
}

// ─── Hook interface ───────────────────────────────────────────────────────────

export interface UseFacebookPagesResult {
  pages: FacebookPage[];
  loading: boolean;
  syncingIds: Set<string>;
  syncSummaries: Map<string, SyncSummary>;
  /** Plan-based limit on connected pages (point: limite selon le plan actuel). */
  connectedPagesLimit: ConnectedPagesLimitInfo | undefined;
  refresh: () => Promise<void>;
  removePage: (businessProfileId: string) => Promise<void>;
  syncPage: (businessProfileId: string) => Promise<SyncSummary>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useFacebookPages(): UseFacebookPagesResult {
  const [pages, setPages] = useState<FacebookPage[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [syncSummaries, setSyncSummaries] = useState<Map<string, SyncSummary>>(
    new Map(),
  );

  // NEW (point: limite selon le plan actuel) — fetched once from
  // /billing/status, which already exposes maxPages per CreditStatusDto.
  const [connectedPagesLimit, setConnectedPagesLimit] = useState<
    ConnectedPagesLimitInfo | undefined
  >(undefined);

  // FIX: Read auth status to guard all API calls
  const authStatus = useAuthStore((s) => s.status);
  const handleAuthErr = useAuthStore((s) => s.handleAuthError);

  const pagesRef = useRef<FacebookPage[]>([]);
  pagesRef.current = pages;

  // ── Fetch from backend ──────────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    // FIX: Never fetch if not authenticated — prevents 401 cascade on mount
    if (useAuthStore.getState().status !== "authenticated") return;

    setLoading(true);
    try {
      const connections = await listConnections();
      setPages((prev) => {
        const statsMap = new Map(
          prev.map((p) => [
            p.accountId,
            {
              followersCount: p.followersCount,
              fanCount: p.fanCount,
              conversationsSynced: p.conversationsSynced,
              postsSynced: p.postsSynced,
            },
          ]),
        );
        return connections.map((conn) => ({
          ...mapConnection(conn),
          ...(statsMap.get(conn.businessProfileId) ?? {}),
        }));
      });
    } catch (error) {
      // FIX: Catch AuthenticationError gracefully instead of crashing React.
      // The global `auth:expired` event + useAuthErrorHandler handles the redirect.
      if (error instanceof AuthenticationError) {
        handleAuthErr(error);
        return;
      }
      // Network errors are non-fatal — keep stale data, don't crash
      if (error instanceof NetworkError) return;
      // Re-throw unexpected errors for debugging
      throw error;
    } finally {
      setLoading(false);
    }
  }, [handleAuthErr]);

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

      const targetPage = pagesRef.current.find(
        (p) => p.accountId === businessProfileId,
      );
      const pageId = targetPage?.id;

      let conversationsSynced = -1;
      let postsSynced = -1;

      try {
        const [convsResult, postsResult, pageInfo] = await Promise.allSettled([
          syncPageConversations(businessProfileId),
          syncPagePosts(businessProfileId),
          pageId ? fetchPagePublicInfo(pageId) : Promise.resolve(null),
        ]);

        if (convsResult.status === "fulfilled")
          conversationsSynced = convsResult.value.synced;
        if (postsResult.status === "fulfilled")
          postsSynced = postsResult.value.synced;

        const graphInfo =
          pageInfo.status === "fulfilled" ? pageInfo.value : null;
        const freshConnections = await listConnections();

        setPages(
          freshConnections.map((conn): FacebookPage => {
            const base = mapConnection(conn);
            const isTarget = conn.businessProfileId === businessProfileId;
            if (!isTarget) {
              const existing = pagesRef.current.find(
                (p) => p.accountId === conn.businessProfileId,
              );
              return existing ? { ...base, ...pickStats(existing) } : base;
            }
            return {
              ...base,
              followersCount:
                graphInfo?.followers_count ?? targetPage?.followersCount ?? 0,
              fanCount: graphInfo?.fan_count ?? targetPage?.fanCount ?? 0,
              category: graphInfo?.category ?? base.category,
              conversationsSynced: Math.max(0, conversationsSynced),
              postsSynced: Math.max(0, postsSynced),
            };
          }),
        );

        const summary: SyncSummary = {
          businessProfileId,
          conversations: conversationsSynced,
          posts: postsSynced,
          timestamp: new Date(),
        };
        setSyncSummaries((prev) =>
          new Map(prev).set(businessProfileId, summary),
        );
        return summary;
      } catch (error) {
        // FIX: Graceful auth error handling in sync as well
        if (error instanceof AuthenticationError) {
          handleAuthErr(error);
          return {
            businessProfileId,
            conversations: -1,
            posts: -1,
            timestamp: new Date(),
          };
        }
        return {
          businessProfileId,
          conversations: -1,
          posts: -1,
          timestamp: new Date(),
        };
      } finally {
        setSyncingIds((prev) => {
          const next = new Set(prev);
          next.delete(businessProfileId);
          return next;
        });
      }
    },
    [handleAuthErr],
  );

  // ── Auto-sync at 00:00 and 12:00 ───────────────────────────────────────────

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    let timeoutId: ReturnType<typeof setTimeout>;
    const scheduleNext = () => {
      timeoutId = setTimeout(async () => {
        for (const page of pagesRef.current) {
          await syncPage(page.accountId).catch(() => undefined);
        }
        scheduleNext();
      }, msUntilNextAutoSync());
    };
    scheduleNext();
    return () => clearTimeout(timeoutId);
  }, [authStatus, syncPage]);

  // ── FIX: Fetch only when authenticated ─────────────────────────────────────
  // Previously used [refresh] which ran immediately on mount regardless of auth.
  // Now waits for status === "authenticated" — prevents the 401 cascade.

  useEffect(() => {
    if (authStatus === "authenticated") {
      void refresh();
    }
    // FIX: Clear stale data when user logs out
    if (authStatus === "unauthenticated") {
      setPages([]);
      setSyncSummaries(new Map());
      setConnectedPagesLimit(undefined);
    }
  }, [authStatus, refresh]);

  // NEW (point: limite selon le plan actuel) — fetch the plan's maxPages
  // once the user is authenticated. Non-critical: failure just means the
  // limit banner won't show, the backend still enforces the limit either way.
  useEffect(() => {
    if (authStatus !== "authenticated") return;
    apiClient<{ planName: string; maxPages: number | null }>("/billing/status")
      .then((status) => {
        setConnectedPagesLimit({
          current: 0,
          max: status.maxPages,
          planName: status.planName,
        });
      })
      .catch(() => undefined);
  }, [authStatus]);

  // Keep the plan-limit "current" count in sync with the pages actually
  // loaded, so the limit banner reflects reality after connect/disconnect.
  useEffect(() => {
    setConnectedPagesLimit((prev) =>
      prev ? { ...prev, current: pages.length } : prev,
    );
  }, [pages.length]);

  return {
    pages,
    loading,
    syncingIds,
    syncSummaries,
    connectedPagesLimit,
    refresh,
    removePage,
    syncPage,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pickStats(page: FacebookPage) {
  return {
    followersCount: page.followersCount,
    fanCount: page.fanCount,
    conversationsSynced: page.conversationsSynced,
    postsSynced: page.postsSynced,
  };
}
