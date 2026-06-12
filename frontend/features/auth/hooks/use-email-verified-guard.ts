/**
 * @file src/features/auth/hooks/use-email-verified-guard.ts
 *
 * Redirects authenticated-but-unverified users to /verify-email.
 *
 * Usage — add to any protected page that requires a verified email:
 *
 *   const { isReady, isVerified } = useEmailVerifiedGuard();
 *   if (!isReady) return <PageSkeleton />;
 *
 * Or compose with useProtectedGuard:
 *
 *   const { isReady, user } = useProtectedGuard();
 *   useEmailVerifiedGuard({ skip: !isReady });
 */

"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthStatus, useCurrentUser } from "../store/auth.store";

interface Options {
  /** Skip the guard (e.g. while the protected guard is still loading) */
  skip?: boolean;
  /** Where to redirect unverified users. Default: /verify-email */
  redirectTo?: string;
}

interface EmailVerifiedGuardResult {
  isVerified: boolean;
}

export function useEmailVerifiedGuard(
  options: Options = {},
): EmailVerifiedGuardResult {
  const { skip = false, redirectTo = "/verify-email" } = options;
  const router = useRouter();
  const user = useCurrentUser();
  const status = useAuthStatus();

  const isVerified = user?.emailVerified ?? false;

  useEffect(() => {
    if (skip) return;
    if (status !== "authenticated") return;
    if (!isVerified) {
      router.replace(redirectTo);
    }
  }, [skip, status, isVerified, router, redirectTo]);

  return { isVerified };
}
