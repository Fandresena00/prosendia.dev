/**
 * @file features/auth/hooks/use-network-recovery.ts
 * @description React hook that wires the NetworkMonitor to the auth store.
 *
 * Responsibilities:
 * - Initializes the network monitor on mount
 * - Subscribes to network status changes
 * - Triggers session restoration when backend becomes reachable again
 * - Updates the auth store when the app goes offline
 *
 * Mount this hook once at the root layout (or root provider).
 * It renders nothing — it is purely side-effect logic.
 *
 * @example
 * // In root layout:
 * function RootLayout({ children }) {
 *   useNetworkRecovery();
 *   return <>{children}</>;
 * }
 */

"use client";

import { networkMonitor, type NetworkStatus } from "@/lib/network-monitor";
import { useEffect } from "react";
import { useAuthStore } from "../store/auth.store";

export function useNetworkRecovery(): void {
  const initializeAuth = useAuthStore((s) => s.initializeAuth);

  useEffect(() => {
    // Initialize the network monitor (idempotent — safe to call multiple times)
    networkMonitor.init();

    let previousNetworkStatus: NetworkStatus = networkMonitor.getStatus();

    const unsubscribe = networkMonitor.subscribe((networkStatus) => {
      const wasOffline =
        previousNetworkStatus === "offline" ||
        previousNetworkStatus === "unknown";
      const isNowOnline = networkStatus === "online";

      previousNetworkStatus = networkStatus;

      if (wasOffline && isNowOnline) {
        // Backend is back — try to restore the session
        const currentAuthStatus = useAuthStore.getState().status;

        if (
          currentAuthStatus === "offline" ||
          currentAuthStatus === "loading"
        ) {
          void initializeAuth();
        }
      }

      if (networkStatus === "offline") {
        // Backend went down — if currently authenticated, go to offline state
        // WITHOUT clearing the user (they should still see the UI)
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
  }, []); // Mount once — initializeAuth is a stable Zustand reference
}
