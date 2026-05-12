"use client";
/**
 * @file src/app/app-bootstrap.tsx
 *
 * Client component mounted ONCE at the root.
 * Initialises all global side-effect hooks that must run on every page:
 *
 *   useNetworkRecovery  — keeps auth in sync when the backend goes down/up
 *   useAuthErrorHandler — listens for `auth:expired` events and redirects to /sign-in
 *
 * These hooks are never called in individual pages or feature components.
 * They live here so the coverage is unconditional and there is a single
 * place to audit app-wide auth behaviour.
 *
 * NOTE: This file has no visible output — it renders its children as-is.
 */

import { useAuthErrorHandler } from "@/features/auth/hooks/use-auth-error-handler";
import { useNetworkRecovery } from "@/features/auth/hooks/use-network-recovery";
import type { ReactNode } from "react";

interface AppBootstrapProps {
  children: ReactNode;
}

export function AppBootstrap({ children }: AppBootstrapProps) {
  // Global auth recovery — triggers re-auth when backend becomes reachable
  useNetworkRecovery();

  // Global auth expiry handler — redirects to /sign-in on any 401 refresh failure
  useAuthErrorHandler();

  return <>{children}</>;
}
