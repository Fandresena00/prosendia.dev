/**
 * @file app/providers.tsx
 * @description Root provider component.
 *
 * Handles app-level initialization:
 *   1. initializeAuth()     → restore session from HttpOnly cookies on boot
 *   2. useNetworkRecovery() → auto-restore session when backend comes back
 *
 * Must wrap the entire app in the root layout.tsx.
 *
 * @example
 * // app/layout.tsx
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <Providers>{children}</Providers>
 *       </body>
 *     </html>
 *   );
 * }
 */

"use client";

import { OfflineBanner } from "@/components/shared/offline-banner";
import { useNetworkRecovery } from "@/features/auth/hooks/use-network-recovery";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useEffect, useRef } from "react";
import { AppBootstrap } from "./app-bootstrap";

interface ProvidersProps {
  children: React.ReactNode;
}

function AuthInitializer() {
  const initializeAuth = useAuthStore((s) => s.initializeAuth);
  const hasRun = useRef(false);

  // ── Session restore ─────────────────────────────────────────────────────────
  // Runs once on app boot. Attempts to restore session via cookie refresh.
  // Never logs out on network error.
  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    void initializeAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Network recovery ────────────────────────────────────────────────────────
  // Monitors backend availability and restores session when it comes back.
  useNetworkRecovery();

  return null;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <>
      <AuthInitializer />
      <OfflineBanner />
      <AppBootstrap>{children}</AppBootstrap>
    </>
  );
}
