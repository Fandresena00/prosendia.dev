"use client";
/**
 * @file features/auth/hooks/use-auth-error-handler.ts
 *
 * Global handler for the `auth:expired` DOM event dispatched by api-client.ts
 * whenever silentRefresh() returns 401/403.
 *
 * WHY THIS EXISTS
 * ───────────────
 * Without this, every hook that calls apiClient must individually catch
 * AuthenticationError and redirect. That approach has two problems:
 *   1. Easy to forget — any new hook becomes a crash vector.
 *   2. Causes React "unhandled promise rejection" overlays in dev.
 *
 * With this pattern:
 *   - api-client dispatches `auth:expired` once
 *   - This hook catches it centrally and does the redirect
 *   - Individual hooks only need to suppress AuthenticationError (not redirect)
 *
 * MOUNT LOCATION
 * ──────────────
 * Mount this hook ONCE in the root layout or a top-level provider:
 *
 *   function RootLayout({ children }) {
 *     useNetworkRecovery();
 *     useAuthErrorHandler();    // ← add this
 *     return <>{children}</>;
 *   }
 */

import { AuthenticationError } from "@/lib/errors";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthStore } from "../store/auth.store";

export function useAuthErrorHandler(): void {
  const router = useRouter();

  useEffect(() => {
    const handleAuthExpired = () => {
      // Update the Zustand store to unauthenticated so any hook
      // watching authStatus stops making API calls
      useAuthStore.getState().handleAuthError(new AuthenticationError());

      // Redirect to login — preserve current path as callbackUrl
      const callbackUrl = encodeURIComponent(window.location.pathname);
      router.replace(`/sign-in?callbackUrl=${callbackUrl}`);
    };

    window.addEventListener("auth:expired", handleAuthExpired);
    return () => window.removeEventListener("auth:expired", handleAuthExpired);
  }, [router]);
}
