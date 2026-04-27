/**
 * @file app/(auth)/sign-up/page.tsx
 */

"use client";

import Loading from "@/app/loading";
import { useGuestGuard } from "@/features/auth/hooks/use-auth-guard";
import SignUpPage from "@/features/auth/pages/sign-up-page";

export default function Page() {
  const { isReady } = useGuestGuard();

  if (!isReady) {
    return <Loading />;
  }

  return <SignUpPage />;
}
