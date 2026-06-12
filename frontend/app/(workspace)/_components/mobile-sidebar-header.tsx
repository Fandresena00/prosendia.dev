/**
 * @file components/mobile-sidebar-header.tsx
 * @description Mobile header with sidebar trigger.
 * This component is only visible on mobile to provide easy access
 * to the sidebar menu from anywhere on the page.
 */

"use client";

import { VendeoLogo } from "@/components/shared/vendeo-logo";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { IconLayoutSidebarLeftExpand } from "@tabler/icons-react";

export function MobileSidebarHeader() {
  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-40 block md:hidden",
        "h-14 px-3 py-2 border-b border-sidebar-border/50",
        "bg-background/95 backdrop-blur-md",
        "flex items-center justify-between gap-2",
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 min-w-0">
        <VendeoLogo size={10} rounded="rounded-lg" />
        <span className="text-xs font-bold tracking-tight">VendeoAI</span>
      </div>

      {/* Sidebar trigger button */}
      <SidebarTrigger
        className="h-8 w-8 rounded-lg border border-border/60 bg-background/90
          backdrop-blur-sm shadow-sm text-muted-foreground hover:text-foreground
          hover:border-border transition-all hover:shadow-md active:shadow-sm shrink-0"
      >
        <IconLayoutSidebarLeftExpand className="h-4 w-4" />
      </SidebarTrigger>
    </div>
  );
}
