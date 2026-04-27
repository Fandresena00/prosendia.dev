/**
 * @file features/auth/hooks/use-auth-guard.ts
 * @description Client-side auth guard hooks with resilient offline handling.
 *
 * Key change from previous version:
 * Guards check `status` (the state machine) instead of `user !== null`.
 * This prevents redirecting to /sign-in when the user is just offline.
 *
 * Status → guard behavior:
 *   loading        → render nothing (skeleton) — session check in progress
 *   authenticated  → render page (or redirect from guest page)
 *   offline        → render page with offline banner (do NOT redirect to sign-in)
 *   unauthenticated→ redirect to /sign-in (confirmed: no session)
 */

"use client";

import { hasSessionCookie } from "@/lib/session-cookie";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { User } from "../schemas/user.schema";
import {
  useAuthStatus,
  useAuthStore,
  useCurrentUser,
  type AuthStatus,
} from "../store/auth.store";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthGuardResult {
  /** True when we have a definitive auth state (not still loading). */
  isReady: boolean;
  user: User | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  isOffline: boolean;
}

// ─── Session init ─────────────────────────────────────────────────────────────

/**
 * Runs initializeAuth() once per mount with StrictMode protection.
 * Returns isReady = true once status is no longer 'loading'.
 */
function useSessionInit(): { isReady: boolean } {
  const initializeAuth = useAuthStore((s) => s.initializeAuth);
  const status = useAuthStatus();
  const hasRun = useRef(false);
  const [isReady, setIsReady] = useState(status !== "loading");

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    if (status === "loading") {
      void initializeAuth().finally(() => setIsReady(true));
    } else {
      setIsReady(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Also become ready if status changes externally (e.g. network recovery)
  useEffect(() => {
    if (status !== "loading") setIsReady(true);
  }, [status]);

  return { isReady };
}

// ─── useGuestGuard ────────────────────────────────────────────────────────────

/**
 * For auth pages: /sign-in, /sign-up, /forgot-password
 *
 * - loading         → render nothing (isReady = false)
 * - unauthenticated → render the page (guest, no redirect)
 * - offline         → render the page (don't assume unauthenticated)
 * - authenticated   → redirect to dashboard (user is already signed in)
 */
export function useGuestGuard(
  whenAuthenticated = "/dashboard",
): AuthGuardResult {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useCurrentUser();
  const status = useAuthStatus();
  const { isReady } = useSessionInit();

  useEffect(() => {
    if (!isReady) return;
    // Auth pages should stay inaccessible as long as a session is *potentially* valid.
    // The presence cookie is our UX hint for "maybe signed in" (even if backend is down).
    if (status === "authenticated" || hasSessionCookie()) {
      const callbackUrl = searchParams.get("callbackUrl");
      router.replace(callbackUrl ?? whenAuthenticated);
    }
    // Never render guest routes while a session is potentially valid.
  }, [isReady, status, router, searchParams, whenAuthenticated]);

  return {
    isReady,
    user,
    status,
    isAuthenticated: status === "authenticated",
    isOffline: status === "offline",
  };
}

// ─── useProtectedGuard ────────────────────────────────────────────────────────

/**
 * For protected pages: /dashboard, /settings, /workspace…
 *
 * - loading         → render nothing (isReady = false)
 * - authenticated   → render the page
 * - offline         → render the page with offline state (do NOT redirect)
 * - unauthenticated → redirect to /sign-in (confirmed no session)
 */
export function useProtectedGuard(
  whenUnauthenticated = "/sign-in",
): AuthGuardResult {
  const router = useRouter();
  const user = useCurrentUser();
  const status = useAuthStatus();
  const { isReady } = useSessionInit();

  useEffect(() => {
    if (!isReady) return;
    // ONLY redirect when CONFIRMED unauthenticated — never on offline/loading,
    // and never if we still have a session presence cookie (potential session).
    if (status === "unauthenticated" && !hasSessionCookie()) {
      router.replace(whenUnauthenticated);
    }
  }, [isReady, status, router, whenUnauthenticated]);

  return {
    isReady,
    user,
    status,
    isAuthenticated: status === "authenticated",
    isOffline: status === "offline",
  };
}
