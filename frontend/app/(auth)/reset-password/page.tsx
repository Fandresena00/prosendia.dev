/**
 * @file app/(auth)/reset-password/page.tsx
 */

"use client";

import Loading from "@/app/loading";
import { useGuestGuard } from "@/features/auth/hooks/use-auth-guard";
import ResetPasswordPage from "@/features/auth/pages/reset-password-page";

export default function Page() {
  const { isReady } = useGuestGuard();

  if (!isReady) {
    return <Loading />;
  }

  return <ResetPasswordPage />;
}
