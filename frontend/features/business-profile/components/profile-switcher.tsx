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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { IconBrandFacebook, IconChevronDown } from "@tabler/icons-react";
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
        <button className="w-full flex items-center gap-2.5 rounded-xl border border-border/50 bg-secondary/30 px-3 py-2 hover:bg-accent/60 transition-colors">
          <PageAvatar
            pageName={activeProfile?.facebookPageName ?? activeProfile?.name ?? "Facebook Page"}
            businessName={activeProfile?.name ?? "BP"}
            avatarUrl={activeProfile?.facebookPageAvatarUrl ?? undefined}
            size="sm"
          />
          <div className="flex-1 text-left min-w-0">
            <p className="text-xs font-semibold truncate">
              {activeProfile?.facebookPageName ?? activeProfile?.name ?? "Sélectionner"}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">
              {activeProfile?.name ?? "Business profile"}
            </p>
          </div>
          {activeProfile?.autoReply && (
            <span className="flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-1.5 py-0.5">
              <Bot className="h-2.5 w-2.5" />
              IA
            </span>
          )}
          <IconChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-[280px]">
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
              className="gap-2.5 cursor-pointer"
            >
              <PageAvatar
                pageName={profile.facebookPageName ?? profile.name}
                businessName={profile.name}
                avatarUrl={profile.facebookPageAvatarUrl ?? undefined}
                size="sm"
              />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">
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
                <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function initialsFromName(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "FB";
}

function PageAvatar({
  pageName,
  businessName,
  avatarUrl,
  size = "sm",
}: {
  pageName: string;
  businessName: string;
  avatarUrl?: string;
  size?: "sm" | "md";
}) {
  const dimension = size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const initials = initialsFromName(pageName || businessName);

  return (
    <Avatar className={`${dimension} shrink-0`}>
      <AvatarImage src={avatarUrl} alt={pageName} />
      <AvatarFallback className="bg-[#1877F2]/12 text-[#1877F2] font-bold">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
