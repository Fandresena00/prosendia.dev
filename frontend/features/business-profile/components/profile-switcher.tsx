"use client";

/**
 * @file features/business-profile/components/profile-switcher.tsx
 *
 * Dropdown that lets the user switch between business profiles.
 * Each profile corresponds to a connected Facebook page.
 * Shows a Facebook page badge + autoReply status per profile.
 */

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { IconBrandFacebook, IconChevronDown, IconCheck } from "@tabler/icons-react";
import { Bot } from "lucide-react";
import type { BusinessProfileSummaryDto } from "../types/business-profile.types";

interface ProfileSwitcherProps {
  profiles:        BusinessProfileSummaryDto[];
  activeProfileId: string | null;
  loading:         boolean;
  onSwitch:        (profileId: string) => void;
}

export function ProfileSwitcher({
  profiles,
  activeProfileId,
  loading,
  onSwitch,
}: ProfileSwitcherProps) {
  const activeProfile = profiles.find((p) => p.id === activeProfileId);

  if (loading) {
    return <Skeleton className="h-9 w-52 rounded-xl" />;
  }

  if (profiles.length === 0) {
    return (
      <div className="flex items-center gap-2 h-9 px-3 rounded-xl border border-border/50 bg-secondary/30 text-sm text-muted-foreground">
        <IconBrandFacebook className="h-4 w-4" />
        Aucune page connectée
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2.5 h-9 px-3 rounded-xl border border-border/50 bg-secondary/30 hover:bg-accent/60 transition-colors text-sm font-medium">
          {/* Facebook icon + page name */}
          <div className="h-5 w-5 rounded-full bg-[#1877F2]/15 flex items-center justify-center shrink-0">
            <IconBrandFacebook className="h-3 w-3 text-[#1877F2]" />
          </div>
          <span className="max-w-[140px] truncate">
            {activeProfile?.facebookPageName ?? activeProfile?.name ?? "Sélectionner"}
          </span>
          {activeProfile?.autoReply && (
            <span className="flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-1.5 py-0.5">
              <Bot className="h-2.5 w-2.5" />
              IA
            </span>
          )}
          <IconChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Pages Facebook connectées
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {profiles.map((profile) => {
          const isActive = profile.id === activeProfileId;
          return (
            <DropdownMenuItem
              key={profile.id}
              onClick={() => onSwitch(profile.id)}
              className="gap-3 cursor-pointer py-2.5"
            >
              {/* Page avatar */}
              <div className="h-8 w-8 rounded-full bg-[#1877F2]/10 border border-[#1877F2]/20 flex items-center justify-center shrink-0">
                <IconBrandFacebook className="h-4 w-4 text-[#1877F2]" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">
                  {profile.facebookPageName ?? profile.name}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-muted-foreground truncate">
                    {profile.name}
                  </span>
                  {profile.autoReply && (
                    <span className="flex items-center gap-0.5 text-[9px] font-bold text-emerald-600 bg-emerald-500/10 rounded-full px-1 py-0.5">
                      <Bot className="h-2 w-2" />
                      AUTO-REPLY
                    </span>
                  )}
                </div>
              </div>

              {/* Active indicator */}
              {isActive && (
                <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <IconCheck className="h-3 w-3 text-primary" />
                </div>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
