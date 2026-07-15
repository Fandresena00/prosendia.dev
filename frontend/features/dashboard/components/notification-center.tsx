/**
 * @file features/dashboard/components/notification-center.tsx
 *
 * Centre de notifications avec :
 *   - Filtres (sévérité, type, non lu)
 *   - Recherche full-text
 *   - Actions rapides (ouvrir conversation, post)
 *   - Marquer tout comme lu
 *   - Suppression individuelle
 *
 * NOTE sur les liens Facebook :
 *   facebookProfileUrl contient des URLs de profils privés qui ne sont pas
 *   accessibles publiquement. On utilise conversationUrl (inbox interne) ou
 *   postUrl à la place. Le lien "Voir conversation" ouvre l'inbox prosendia.
 */
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  ExternalLink,
  Info,
  MessageSquare,
  Search,
  Trash2,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { Notification, NotificationSeverity } from "../types/dashboard.types";

// ─── URL helpers ─────────────────────────────────────────────────────────────

/**
 * Normalise une URL de conversation vers le format search-param.
 * Le backend peut renvoyer "/inbox/conversations/<id>" ou déjà "/inbox?conv=<id>".
 * On normalise tout en "/inbox?conv=<id>" pour être cohérent avec le routage.
 */
function normalizeConversationUrl(url: string | null): string | null {
  if (!url) return null;
  // Already in search-param format
  if (url.includes("?conv=")) return url;
  // Pattern: /inbox/conversations/<uuid>
  const match = url.match(/\/conversations\/([a-f0-9-]{36})/i);
  if (match?.[1]) return `/inbox?conv=${match[1]}`;
  // Pattern: ends with a UUID (fallback)
  const uuidMatch = url.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i);
  if (uuidMatch?.[1]) return `/inbox?conv=${uuidMatch[1]}`;
  return url;
}

// ─── Severity config ─────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<NotificationSeverity, {
  icon:      React.ElementType;
  dot:       string;
  bg:        string;
  border:    string;
  iconColor: string;
  label:     string;
}> = {
  CRITICAL: {
    icon:      XCircle,
    dot:       "bg-red-500",
    bg:        "bg-red-500/5",
    border:    "border-red-500/20",
    iconColor: "text-red-500",
    label:     "Critique",
  },
  WARNING: {
    icon:      AlertTriangle,
    dot:       "bg-amber-500",
    bg:        "bg-amber-500/5",
    border:    "border-amber-500/20",
    iconColor: "text-amber-500",
    label:     "Avertissement",
  },
  INFO: {
    icon:      Info,
    dot:       "bg-blue-500",
    bg:        "bg-blue-500/5",
    border:    "border-blue-500/20",
    iconColor: "text-blue-500",
    label:     "Info",
  },
  SUCCESS: {
    icon:      Zap,
    dot:       "bg-emerald-500",
    bg:        "bg-emerald-500/5",
    border:    "border-emerald-500/20",
    iconColor: "text-emerald-500",
    label:     "Succès",
  },
};

type SeverityFilter = NotificationSeverity | "ALL";

// ─── Notification item ───────────────────────────────────────────────────────

function NotificationItem({
  notif,
  onMarkRead,
  onDelete,
}: {
  notif:       Notification;
  onMarkRead:  (id: string) => void;
  onDelete:    (id: string) => void;
}) {
  const cfg  = SEVERITY_CONFIG[notif.severity] ?? SEVERITY_CONFIG.INFO;
  const Icon = cfg.icon;

  const timeAgo = (() => {
    const diff = Date.now() - new Date(notif.createdAt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return "à l'instant";
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h`;
    return `${Math.floor(hrs / 24)}j`;
  })();

  // Determine the best action URL:
  // 1. conversationUrl (normalized to /inbox?conv=<id>) for messenger notifications
  // 2. postUrl for post/comment notifications
  // 3. actionUrl as fallback
  // NOTE: facebookProfileUrl links to private profiles and is NOT shown
  // as a direct link — Facebook private profiles are inaccessible to
  // external viewers. We show the client name as plain text instead.
  const normalizedConvUrl = normalizeConversationUrl(notif.conversationUrl ?? notif.actionUrl ?? null);
  const primaryUrl   = normalizedConvUrl ?? notif.postUrl;
  const primaryLabel = notif.actionLabel ?? (notif.conversationId ? "Voir la conversation" : notif.postId ? "Voir le post" : "Voir");

  const secondaryUrl   = notif.postUrl && notif.actionUrl !== notif.postUrl ? notif.postUrl : null;

  return (
    <div className={cn(
      "group flex items-start gap-3 px-4 py-3 transition-colors border-b border-border/20 last:border-0",
      !notif.isRead && `${cfg.bg}`,
      "hover:bg-accent/30",
    )}>
      {/* Icon */}
      <div className={cn(
        "mt-0.5 h-7 w-7 rounded-full flex items-center justify-center shrink-0",
        cfg.bg, `border ${cfg.border}`,
      )}>
        <Icon className={cn("h-3.5 w-3.5", cfg.iconColor)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={cn(
              "text-[12px] font-semibold leading-tight truncate",
              !notif.isRead && "text-foreground",
            )}>
              {notif.title}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
              {notif.message}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!notif.isRead && <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", cfg.dot)} />}
            <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap">{timeAgo}</span>
          </div>
        </div>

        {/* Client name (plain — profile URL is private, not linkable) */}
        {notif.clientName && (
          <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
            <MessageSquare className="h-2.5 w-2.5 opacity-50" />
            {notif.clientName}
          </p>
        )}

        {/* Action links */}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {primaryUrl && (
            <Link
              href={primaryUrl}
              onClick={() => !notif.isRead && onMarkRead(notif.id)}
              className="text-[10px] font-medium text-primary hover:underline flex items-center gap-0.5"
            >
              {primaryLabel}
              <ExternalLink className="h-2.5 w-2.5" />
            </Link>
          )}
          {secondaryUrl && (
            <Link
              href={secondaryUrl}
              className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5"
            >
              Voir post
              <ExternalLink className="h-2.5 w-2.5" />
            </Link>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {!notif.isRead && (
          <button
            onClick={() => onMarkRead(notif.id)}
            className="h-6 w-6 rounded flex items-center justify-center hover:bg-accent text-muted-foreground"
            title="Marquer comme lu"
          >
            <CheckCheck className="h-3 w-3" />
          </button>
        )}
        <button
          onClick={() => onDelete(notif.id)}
          className="h-6 w-6 rounded flex items-center justify-center hover:bg-accent text-muted-foreground"
          title="Supprimer"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Notification center ─────────────────────────────────────────────────────

interface NotificationCenterProps {
  notifications: Notification[];
  unreadCount:   number;
  criticalCount: number;
  onMarkRead:    (ids?: string[], all?: boolean) => void;
  onDelete:      (id: string) => void;
}

export function NotificationCenter({
  notifications,
  unreadCount,
  criticalCount,
  onMarkRead,
  onDelete,
}: NotificationCenterProps) {
  const [filter,     setFilter]     = useState<SeverityFilter>("ALL");
  const [search,     setSearch]     = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);

  const filtered = notifications.filter((n) => {
    if (filter !== "ALL" && n.severity !== filter) return false;
    if (unreadOnly && n.isRead) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        n.title.toLowerCase().includes(q) ||
        n.message.toLowerCase().includes(q) ||
        (n.clientName?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  return (
    <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
      <CardHeader className="pb-0 pt-4 px-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-[12px] font-semibold flex items-center gap-2">
            <Bell className="h-3.5 w-3.5 text-primary" />
            Centre de notifications
            {unreadCount > 0 && (
              <Badge className="h-4 min-w-4 px-1 text-[10px] rounded-full bg-primary text-primary-foreground">
                {unreadCount}
              </Badge>
            )}
            {criticalCount > 0 && (
              <Badge className="h-4 px-1.5 text-[10px] bg-red-500/15 text-red-700 border-red-500/20">
                {criticalCount} critique{criticalCount > 1 ? "s" : ""}
              </Badge>
            )}
          </CardTitle>

          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] px-2 text-muted-foreground gap-1"
              onClick={() => onMarkRead(undefined, true)}
            >
              <CheckCheck className="h-3 w-3" />
              Tout lire
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 pt-3 pb-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[140px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher…"
              className="h-7 pl-7 pr-2 text-[11px] bg-secondary/40 border-border/30"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Severity pills */}
          <div className="flex items-center gap-1 flex-wrap">
            {(["ALL", "CRITICAL", "WARNING", "INFO", "SUCCESS"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={cn(
                  "h-6 px-2 rounded text-[10px] font-medium transition-colors",
                  filter === s
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/50 text-muted-foreground hover:bg-secondary",
                )}
              >
                {s === "ALL" ? "Tous" : SEVERITY_CONFIG[s as NotificationSeverity].label}
              </button>
            ))}
          </div>

          {/* Unread toggle */}
          <button
            onClick={() => setUnreadOnly(!unreadOnly)}
            className={cn(
              "h-6 px-2 rounded text-[10px] font-medium transition-colors",
              unreadOnly
                ? "bg-primary/15 text-primary border border-primary/20"
                : "bg-secondary/50 text-muted-foreground hover:bg-secondary",
            )}
          >
            Non lus
          </button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <Bell className="h-8 w-8 text-muted-foreground/20" />
            <p className="text-xs text-muted-foreground">
              {search || filter !== "ALL" || unreadOnly
                ? "Aucune notification correspondante"
                : "Aucune notification pour le moment"}
            </p>
          </div>
        ) : (
          <div>
            {filtered.map((n) => (
              <NotificationItem
                key={n.id}
                notif={n}
                onMarkRead={(id) => onMarkRead([id])}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
