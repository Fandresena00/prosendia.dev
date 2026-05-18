"use client";
/**
 * @file features/posts-comments/components/page-switcher.tsx
 *
 * FIX: Added key props to DropdownMenuLabel and DropdownMenuSeparator to
 * prevent the React "Each child in a list" warning when DropdownMenuContent
 * renders its children as an array.
 */

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconBrandFacebook, IconCheck, IconChevronDown } from "@tabler/icons-react";
import type { FacebookPage } from "../types/posts-comments.types";

interface PageSwitcherProps {
  pages:     FacebookPage[];
  activeKey: string;
  onSwitch:  (key: string) => void;
}

function PageAvatar({
  page,
  size = "sm",
}: {
  page: FacebookPage;
  size?: "sm" | "md";
}) {
  const dim = size === "md" ? "h-7 w-7 text-[10px]" : "h-5 w-5 text-[9px]";

  return page.avatarUrl ? (
    <img
      src={page.avatarUrl}
      alt={page.name}
      className={`${dim} rounded-full object-cover shrink-0 border border-border/30`}
      onError={(e) => {
        // Fallback to initials on image error
        const el = e.currentTarget;
        el.style.display = "none";
        const next = el.nextElementSibling as HTMLElement | null;
        if (next) next.style.display = "flex";
      }}
    />
  ) : null;
}

export function PageSwitcher({ pages, activeKey, onSwitch }: PageSwitcherProps) {
  const active = pages.find((p) => p.key === activeKey) ?? pages[0];
  if (!active) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2.5 h-9 px-3 rounded-xl border border-border/50 bg-secondary/30 hover:bg-accent/60 transition-colors text-sm font-medium">
          {/* Active page avatar */}
          {active.avatarUrl ? (
            <img
              src={active.avatarUrl}
              alt={active.name}
              className="h-5 w-5 rounded-full object-cover shrink-0 border border-border/30"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${active.color}`}>
              {active.avatar}
            </div>
          )}
          <span className="max-w-[140px] truncate">{active.name}</span>
          <IconChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64">
        {/* FIX: explicit keys on static children prevent React list-key warning */}
        <DropdownMenuLabel key="label" className="text-xs text-muted-foreground">
          Pages connectées
        </DropdownMenuLabel>
        <DropdownMenuSeparator key="sep" />

        {pages.map((page) => (
          <DropdownMenuItem
            key={page.key}
            onClick={() => onSwitch(page.key)}
            className="gap-3 cursor-pointer py-2.5"
          >
            {/* Page avatar with initials fallback */}
            <div className="relative shrink-0">
              {page.avatarUrl && (
                <img
                  src={page.avatarUrl}
                  alt={page.name}
                  className="h-7 w-7 rounded-full object-cover border border-border/30"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                    if (fallback) fallback.style.display = "flex";
                  }}
                />
              )}
              <div
                className={`h-7 w-7 rounded-full items-center justify-center text-[10px] font-bold border ${page.color} ${page.avatarUrl ? "hidden" : "flex"}`}
              >
                {page.avatar}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate">{page.name}</p>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                <IconBrandFacebook className="h-2.5 w-2.5 text-[#1877F2]" />
                Page Facebook
              </p>
            </div>

            {page.key === activeKey && (
              <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <IconCheck className="h-3 w-3 text-primary" />
              </div>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
