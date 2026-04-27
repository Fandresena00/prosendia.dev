/**
 * @file app/(auth)/forgot-password/page.tsx
 */

"use client";

import Loading from "@/app/loading";
import { useGuestGuard } from "@/features/auth/hooks/use-auth-guard";
import ForgotPasswordPage from "@/features/auth/pages/forgot-password-page";

export default function Page() {
  const { isReady } = useGuestGuard();

  if (!isReady) {
    return <Loading />;
  }

  return <ForgotPasswordPage />;
}
