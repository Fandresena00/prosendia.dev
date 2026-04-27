/**
 * @file app/(auth)/sign-in/page.tsx
 */

"use client";

import Loading from "@/app/loading";
import { useGuestGuard } from "@/features/auth/hooks/use-auth-guard";
import SignInPage from "@/features/auth/pages/sign-in-page";

export default function Page() {
  const { isReady } = useGuestGuard();

  if (!isReady) {
    return <Loading />;
  }

  return <SignInPage />;
}
