/**
 * @file components/floating-sidebar-trigger.tsx
 * @description Floating trigger on desktop that ensures sidebar is always accessible.
 * Shows at top-left on desktop, hidden on mobile (MobileSidebarHeader handles mobile).
 *
 * Strategy: Always rendered on desktop to avoid hydration issues and gaps.
 * Visual state controlled by opacity/pointer-events based on sidebar state.
 */

"use client";

import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { IconLayoutSidebarLeftExpand } from "@tabler/icons-react";

export function FloatingSidebarTrigger() {
  const { state } = useSidebar();

  // Always rendered on desktop, but control visibility via CSS classes
  // This avoids gaps/dead zones when resizing between states
  const isCollapsed = state === "collapsed";

  return (
    <div
      className={cn(
        "hidden md:fixed md:left-4 md:top-4 md:z-40 md:flex",
        // When sidebar is expanded, make the button invisible but keep it in DOM
        // This ensures the trigger is always available, no gaps
        !isCollapsed && "opacity-0 pointer-events-none",
      )}
    >
      <SidebarTrigger
        className="h-8 w-8 rounded-lg border border-border/60 bg-background/90
          backdrop-blur-sm shadow-sm text-muted-foreground hover:text-foreground
          hover:border-border transition-all hover:shadow-md active:shadow-sm"
        title="Toggle sidebar"
      >
        <IconLayoutSidebarLeftExpand className="h-4 w-4" />
      </SidebarTrigger>
    </div>
  );
}
