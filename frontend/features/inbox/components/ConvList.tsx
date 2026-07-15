"use client";

/**
 * @file features/inbox/components/ConvList.tsx
 * Conversation list panel with account switcher, search, and SSE status.
 */

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { IconChevronDown, IconSearch, IconSettings } from "@tabler/icons-react";
import { Bot } from "lucide-react";
import type { Account, Conv } from "../types/inbox.types";

interface ConvListProps {
  accounts: Account[];
  activeAcc: Account | null;
  onChangeAcc: (acc: Account) => void;
  convs: Conv[];
  loading: boolean;
  selected: Conv | null;
  onSelect: (c: Conv) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  wsStatus: "connecting" | "connected" | "error";
  onOpenSettings: () => void;
  compactMode?: boolean;
  className?: string;
}

export function ConvList({
  accounts,
  activeAcc,
  onChangeAcc,
  convs,
  loading,
  selected,
  onSelect,
  searchQuery,
  onSearchChange,
  wsStatus,
  onOpenSettings,
  compactMode = false,
  className = "",
}: ConvListProps) {
  const wsDotClass =
    wsStatus === "connected"
      ? "bg-emerald-500"
      : wsStatus === "error"
        ? "bg-destructive animate-pulse"
        : "bg-amber-400 animate-pulse";

  return (
    <div
      className={`flex min-w-0 max-w-full flex-col border-r border-border/40 bg-card/20 shrink-0 overflow-hidden ${className}`}
    >
      {/* ── Header ── */}
      <div className="mx-auto w-full max-w-107.5 px-4 pt-4 pb-2.5 shrink-0 border-b border-border/40 space-y-3 sm:max-w-none">
        {/* Title row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold tracking-tight">Messages</h2>
            <span
              className={`h-1.5 w-1.5 rounded-full shrink-0 ${wsDotClass}`}
              title={
                wsStatus === "connected"
                  ? "Temps réel actif"
                  : wsStatus === "error"
                    ? "Temps réel déconnecté"
                    : "Connexion…"
              }
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
            onClick={onOpenSettings}
            title="Paramètres"
          >
            <IconSettings className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Account switcher */}
        {activeAcc && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-2.5 rounded-xl border border-border/50 bg-secondary/30 px-3 py-2 hover:bg-accent/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
                <PageAvatar
                  name={activeAcc.name}
                  initials={activeAcc.initials}
                  avatarUrl={activeAcc.avatarUrl}
                  colorClass={activeAcc.color}
                />
                <div className="flex-1 text-left min-w-0">
                  <p className="text-xs font-semibold truncate">
                    {activeAcc.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {activeAcc.pageType}
                  </p>
                </div>
                {activeAcc.verified && <VerifiedBadge />}
                <IconChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="start" className="w-70">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Pages connectées
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {accounts.map((acc) => (
                <DropdownMenuItem
                  key={acc.id}
                  onClick={() => onChangeAcc(acc)}
                  className="gap-2.5 cursor-pointer"
                >
                  <PageAvatar
                    name={acc.name}
                    initials={acc.initials}
                    avatarUrl={acc.avatarUrl}
                    colorClass={acc.color}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{acc.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {acc.pageType}
                    </p>
                  </div>
                  {activeAcc.id === acc.id && (
                    <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* ── Search ── */}
      <div className="mx-auto w-full max-w-107.5 px-3 py-2 shrink-0 sm:max-w-none">
        <div className="relative">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Rechercher…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-8 text-xs bg-secondary/40 border-0 rounded-full focus-visible:ring-1 focus-visible:ring-primary/50"
          />
        </div>
      </div>

      {/* ── Conversation list ── */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="mx-auto w-full max-w-107.5 px-2 py-1 space-y-0.5 sm:max-w-none">
          {loading ? (
            <ConvListSkeleton compact={compactMode} />
          ) : convs.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-10">
              Aucune conversation trouvée
            </p>
          ) : (
            convs.map((conv) => {
              const isSelected = selected?.id === conv.id;
              return (
                <ConvItem
                  key={conv.id}
                  conv={conv}
                  isSelected={isSelected}
                  compact={compactMode}
                  onClick={() => onSelect(conv)}
                />
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── ConvItem ──────────────────────────────────────────────────────────────────

function ConvItem({
  conv,
  isSelected,
  compact,
  onClick,
}: {
  conv: Conv;
  isSelected: boolean;
  compact: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full min-w-0 overflow-hidden text-left rounded-xl transition-all duration-150 group ${
        compact ? "p-2" : "p-2.5"
      } ${
        isSelected
          ? "bg-primary/8 shadow-[inset_0_0_0_1px_rgba(var(--primary),.12)]"
          : "hover:bg-accent/60"
      }`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {/* Avatar */}
        <div className="relative shrink-0">
          <Avatar className={compact ? "h-9 w-9" : "h-10 w-10"}>
            <AvatarImage src={conv.avatarUrl ?? undefined} alt={conv.client} />
            <AvatarFallback
              className={`text-xs font-bold ${
                isSelected
                  ? "bg-primary/20 text-primary"
                  : "bg-secondary text-foreground"
              }`}
            >
              {conv.initials}
            </AvatarFallback>
          </Avatar>
          {conv.online && (
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-background" />
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex min-w-0 items-baseline justify-between gap-1 mb-0.5">
            <p
              className={`min-w-0 max-w-[min(62vw,250px)] truncate text-xs sm:max-w-52.5 xl:max-w-57.5 ${conv.unread > 0 ? "font-bold" : "font-medium"}`}
            >
              {conv.client}
            </p>
            <span
              className={`text-[10px] shrink-0 tabular-nums ${
                conv.unread > 0
                  ? "text-primary font-semibold"
                  : "text-muted-foreground"
              }`}
            >
              {conv.time}
            </span>
          </div>

          <div className="flex min-w-0 items-center justify-between gap-1">
            <p
              className={`min-w-0 max-w-[min(58vw,230px)] flex-1 truncate whitespace-nowrap text-[11px] sm:max-w-42.5 xl:max-w-47.5 ${
                conv.unread > 0
                  ? "text-foreground font-medium"
                  : "text-muted-foreground"
              }`}
            >
              {conv.lastMessage || (
                <span className="italic opacity-50">Aucun message</span>
              )}
            </p>

            <div className="ml-1 flex shrink-0 items-center gap-1">
              {conv.unread > 0 && (
                <span className="h-4 min-w-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center px-1">
                  {conv.unread > 99 ? "99+" : conv.unread}
                </span>
              )}
              <ModeBadge mode={conv.mode} />
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── ModeBadge ─────────────────────────────────────────────────────────────────

function ModeBadge({ mode }: { mode: "ai" | "human" }) {
  if (mode === "ai") {
    return (
      <Badge
        variant="default"
        className="text-[9px] h-4 px-1 gap-0.5 rounded-full"
      >
        <Bot className="h-2.5 w-2.5" />
        IA
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="text-[9px] h-4 px-1 rounded-full border-emerald-500/30 text-emerald-600 bg-emerald-500/5"
    >
      Humain
    </Badge>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function PageAvatar({
  name,
  initials,
  avatarUrl,
  colorClass,
}: {
  name: string;
  initials: string;
  avatarUrl?: string;
  colorClass: string;
}) {
  return (
    <Avatar className="h-7 w-7 shrink-0">
      <AvatarImage src={avatarUrl} alt={name} />
      <AvatarFallback className={`text-xs font-bold ${colorClass}`}>
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

function VerifiedBadge() {
  return (
    <svg
      className="h-3.5 w-3.5 text-primary shrink-0"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ConvListSkeleton({ compact }: { compact: boolean }) {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className={`flex items-center gap-2.5 ${compact ? "px-2 py-2" : "px-2.5 py-2.5"}`}
        >
          <Skeleton
            className={`rounded-full shrink-0 ${compact ? "h-9 w-9" : "h-10 w-10"}`}
          />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
        </div>
      ))}
    </>
  );
}
