"use client";
/**
 * @file features/posts-comments/components/page-switcher.tsx
 *
 * next/image usage:
 *   - Trigger avatar  → `width={20} height={20}`
 *   - Dropdown avatar → `width={28} height={28}`
 *   Both use `unoptimized` to avoid requiring graph.facebook.com in remotePatterns.
 *   Error state managed via useState in PageAvatarImg sub-component.
 *
 * FIX (key warning): explicit `key` on DropdownMenuLabel and DropdownMenuSeparator.
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
import Image from "next/image";
import { useState } from "react";
import type { FacebookPage } from "../types/posts-comments.types";

// ─── Sub-component ────────────────────────────────────────────────────────────

/**
 * Page avatar image with initials fallback.
 * Local `error` state avoids DOM manipulation (which is fragile with next/image).
 */
function PageAvatarImg({
  page,
  size,
}: {
  page: FacebookPage;
  size: number;
}) {
  const [error, setError] = useState(false);

  if (!page.avatarUrl || error) {
    return (
      <div
        className={`rounded-full flex items-center justify-center font-bold shrink-0 ${page.color}`}
        style={{ width: size, height: size, fontSize: Math.max(8, size * 0.32) }}
      >
        {page.avatar}
      </div>
    );
  }

  return (
    <Image
      src={page.avatarUrl}
      alt={page.name}
      width={size}
      height={size}
      className="rounded-full object-cover shrink-0 border border-border/30"
      unoptimized
      onError={() => setError(true)}
    />
  );
}

// ─── PageSwitcher ─────────────────────────────────────────────────────────────

interface PageSwitcherProps {
  pages:     FacebookPage[];
  activeKey: string;
  onSwitch:  (key: string) => void;
}

export function PageSwitcher({ pages, activeKey, onSwitch }: PageSwitcherProps) {
  const active = pages.find((p) => p.key === activeKey) ?? pages[0];
  if (!active) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2.5 h-9 px-3 rounded-xl border border-border/50 bg-secondary/30 hover:bg-accent/60 transition-colors text-sm font-medium">
          <PageAvatarImg page={active} size={20} />
          <span className="max-w-[140px] truncate">{active.name}</span>
          <IconChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64">
        {/* FIX: explicit keys prevent React list-key warning */}
        <DropdownMenuLabel key="pages-label" className="text-xs text-muted-foreground">
          Pages connectées
        </DropdownMenuLabel>
        <DropdownMenuSeparator key="pages-sep" />

        {pages.map((page) => (
          <DropdownMenuItem
            key={page.key}
            onClick={() => onSwitch(page.key)}
            className="gap-3 cursor-pointer py-2.5"
          >
            <PageAvatarImg page={page} size={28} />

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
