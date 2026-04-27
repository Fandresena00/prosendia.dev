/**
 * @file components/floating-sidebar-trigger.tsx
 * @description A fixed-position button that reopens the sidebar
 * when it is collapsed. Invisible when the sidebar is open.
 */

"use client";

import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { IconLayoutSidebarLeftExpand } from "@tabler/icons-react";

export function FloatingSidebarTrigger() {
  const { state } = useSidebar();

  if (state !== "collapsed") return null;

  return (
    <div className="fixed left-3 top-3 z-50">
      <SidebarTrigger
        className="h-8 w-8 rounded-lg border border-border/60 bg-background/90
          backdrop-blur-sm shadow-sm text-muted-foreground hover:text-foreground
          hover:border-border transition-all hover:shadow-md"
      >
        <IconLayoutSidebarLeftExpand className="h-4 w-4" />
      </SidebarTrigger>
    </div>
  );
}
