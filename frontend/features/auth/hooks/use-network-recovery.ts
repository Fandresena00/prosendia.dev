"use client";
/**
 * @file features/auth/hooks/use-network-recovery.ts
 *
 * FIX: The previous version triggered initializeAuth() on first mount because:
 *   - previousNetworkStatus started as "unknown"
 *   - networkMonitor.subscribe() immediately calls the listener with current status
 *   - If current status is "online", wasOffline (unknown→online) = true
 *   - → initializeAuth() fires at mount in ADDITION to useSessionInit
 *   - → double GET /auth/me in server logs
 *
 * Fix: skip the initial synchronous emission (which is just "here's the current
 * status"). Only react to genuine TRANSITIONS (offline → online).
 * The initial auth check is exclusively useSessionInit's responsibility.
 */

import { networkMonitor, type NetworkStatus } from "@/lib/network-monitor";
import { useEffect } from "react";
import { useAuthStore } from "../store/auth.store";

export function useNetworkRecovery(): void {
  const initializeAuth = useAuthStore((s) => s.initializeAuth);

  useEffect(() => {
    networkMonitor.init();

    let previousNetworkStatus: NetworkStatus | null = null; // null = not yet seen first status

    const unsubscribe = networkMonitor.subscribe((networkStatus) => {
      // FIX: Skip the first emission entirely.
      // subscribe() fires synchronously with the current status as a snapshot.
      // Treating that snapshot as a "transition" caused false recovery triggers on mount.
      // useSessionInit already handles the initial auth check independently.
      if (previousNetworkStatus === null) {
        previousNetworkStatus = networkStatus;
        return;
      }

      const wasOffline =
        previousNetworkStatus === "offline" ||
        previousNetworkStatus === "unknown";
      const isNowOnline = networkStatus === "online";

      previousNetworkStatus = networkStatus;

      if (wasOffline && isNowOnline) {
        const currentAuthStatus = useAuthStore.getState().status;
        // Only trigger if the store is actually in an offline/recovery state,
        // not on a normal authenticated session that just happened to be online.
        if (currentAuthStatus === "offline" || currentAuthStatus === "loading") {
          void initializeAuth();
        }
      }

      if (networkStatus === "offline") {
        const currentAuthStatus = useAuthStore.getState().status;
        if (currentAuthStatus === "authenticated") {
          useAuthStore.setState({ status: "offline" });
        }
      }
    });

    return () => {
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
