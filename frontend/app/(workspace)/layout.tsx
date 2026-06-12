/**
 * @file layout.tsx
 * @description Workspace layout — thin orchestrator.
 *
 * Responsibility split:
 *   layout.tsx               → wiring + state (sign-out dialog open/close, logout action)
 *   config/nav.config.ts     → navigation structure (add pages here)
 *   components/sidebar-nav   → renders nav groups from config, handles plan gating
 *   components/sidebar-user-menu → user avatar + dropdown
 *   components/sidebar-plan-card → usage bar + upgrade button
 *   components/floating-sidebar-trigger → re-open button when sidebar is collapsed
 *   components/sign-out-dialog → confirmation modal
 */

"use client";

import { ThemeSwitcher } from "@/components/shared/theme-switcher";
import { VendeoLogo } from "@/components/shared/vendeo-logo";
import {
  Sidebar,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useProtectedGuard } from "@/features/auth/hooks/use-auth-guard";
import { useAuthStore } from "@/features/auth/store/auth.store";
import * as React from "react";
import Loading from "../loading";
import { FloatingSidebarTrigger } from "./_components/floating-sidebar-trigger";
import { MobileSidebarHeader } from "./_components/mobile-sidebar-header";
import { SidebarNav } from "./_components/sidebar-nav";
import { SidebarPlanCard } from "./_components/sidebar-plan-card";
import { SidebarUserMenu } from "./_components/sidebar-user-menu";
import { SignOutDialog } from "./_components/sign-out-dialog";
export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [signOutOpen, setSignOutOpen] = React.useState(false);
  const logout = useAuthStore((s) => s.logout);
  const { isReady } = useProtectedGuard();

  const handleConfirmSignOut = React.useCallback(() => {
    setSignOutOpen(false);
    logout();
  }, [logout]);

  if (!isReady) return <Loading />;

  return (
    <SidebarProvider>
      {/* Mobile header with sidebar trigger — visible on mobile only (< 768px) */}
      <MobileSidebarHeader />

      {/* Desktop floating trigger — visible on desktop only (≥ 768px), always accessible */}
      <FloatingSidebarTrigger />

      <Sidebar variant="inset" className="border-r border-sidebar-border/50">
        {/* ── Header ── */}
        <SidebarHeader className="px-3 py-3 sm:px-4 sm:py-4">
          {/* Ambient glow */}
          <div
            className="pointer-events-none absolute left-0 top-0 w-full h-20"
            style={{
              background:
                "radial-gradient(ellipse at 30% 50%, oklch(0.52 0.24 256 / 0.09) 0%, transparent 70%)",
            }}
          />
          {/* Logo + collapse trigger */}
          <div className="relative flex items-center gap-2 sm:gap-3">
            <VendeoLogo size={12} rounded="rounded-xl" />
            <div className="flex-1 min-w-0">
              <span className="text-[13px] sm:text-sm font-bold tracking-tight">
                VendeoAI
              </span>
              <p className="text-[10px] sm:text-xs text-muted-foreground leading-none mt-0.5">
                Facebook AI Assistant
              </p>
            </div>
            <SidebarTrigger className="h-8 w-8 sm:h-7 sm:w-7 shrink-0 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-accent/60 transition-all hidden md:flex" />
          </div>
        </SidebarHeader>

        {/* ── Nav groups (from config) ── */}
        <SidebarNav />

        {/* ── Footer ── */}
        <SidebarFooter className="p-3 sm:p-4 border-t border-sidebar-border/40 gap-2 sm:gap-3">
          {/* User avatar + dropdown */}
          <SidebarUserMenu onSignOut={() => setSignOutOpen(true)} />

          {/* Theme switcher */}
          <div className="flex items-center justify-between px-1 sm:px-2">
            <span className="text-[10px] sm:text-xs text-muted-foreground/60 uppercase tracking-widest">
              Thème
            </span>
            <ThemeSwitcher />
          </div>

          {/* Plan usage + upgrade */}
          <SidebarPlanCard />
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <SidebarInset className="flex flex-col overflow-hidden">
        {/* Mobile header padding */}
        <div className="h-14 md:h-0" />

        {/* Dot grid background */}
        <div
          className="pointer-events-none fixed inset-0 z-0 md:top-0"
          style={{
            backgroundImage: `radial-gradient(circle, oklch(0.52 0.24 256 / 0.025) 1px, transparent 1px)`,
            backgroundSize: "28px 28px",
          }}
        />
        {/* Page content — full height, no top bar */}
        <main className="relative z-10 flex-1 overflow-auto">{children}</main>
      </SidebarInset>

      <SignOutDialog
        open={signOutOpen}
        onOpenChange={setSignOutOpen}
        onConfirm={handleConfirmSignOut}
      />
    </SidebarProvider>
  );
}
