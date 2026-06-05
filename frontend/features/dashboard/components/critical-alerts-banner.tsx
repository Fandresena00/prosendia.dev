/**
 * @file features/dashboard/components/critical-alerts-banner.tsx
 *
 * Bandeau d'alertes critiques affiché en haut du dashboard
 * quand des notifications CRITICAL non lues existent.
 * Chaque alerte a un lien direct vers la conversation / post concerné.
 */
"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertTriangle, ExternalLink, X, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { Notification } from "../types/dashboard.types";

const TYPE_EMOJI: Record<string, string> = {
  HUMAN_TAKEOVER_REQUIRED:  "🚨",
  ANGRY_CLIENT_DETECTED:    "😤",
  AI_STUCK_LOOP:            "🔄",
  HOT_PROSPECT:             "🔥",
  UNANSWERED_HUMAN:         "⏰",
  MESSENGER_WINDOW_EXPIRED: "🕐",
  CREDITS_DEPLETED:         "❌",
  CREDITS_CRITICAL:         "⚠️",
  FACEBOOK_TOKEN_EXPIRED:   "🔌",
  SYNC_FAILED:              "⚠️",
  POST_LIMIT_REACHED:       "📌",
  SUBSCRIPTION_EXPIRING:    "⏰",
};

interface CriticalAlertsBannerProps {
  notifications: Notification[];
  onMarkRead:    (ids: string[]) => void;
}

export function CriticalAlertsBanner({
  notifications,
  onMarkRead,
}: CriticalAlertsBannerProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const criticals = notifications.filter(
    (n) => n.severity === "CRITICAL" && !n.isRead && !dismissed.has(n.id),
  );

  if (criticals.length === 0) return null;

  const dismiss = (id: string) => {
    setDismissed((prev) => new Set([...prev, id]));
    onMarkRead([id]);
  };

  const dismissAll = () => {
    const ids = criticals.map((n) => n.id);
    setDismissed((prev) => new Set([...prev, ...ids]));
    onMarkRead(ids);
  };

  return (
    <div className="rounded-md border border-red-500/25 bg-red-500/5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-red-500/15">
        <div className="flex items-center gap-2">
          <XCircle className="h-4 w-4 text-red-500" />
          <span className="text-[12px] font-semibold text-red-700">
            {criticals.length} alerte{criticals.length > 1 ? "s" : ""} critique{criticals.length > 1 ? "s" : ""} nécessitant votre attention
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[10px] px-2 text-red-600/70 hover:text-red-700 hover:bg-red-500/10"
          onClick={dismissAll}
        >
          Tout ignorer
        </Button>
      </div>

      {/* Alerts list */}
      <div className="divide-y divide-red-500/10">
        {criticals.slice(0, 5).map((n) => {
          const emoji = TYPE_EMOJI[n.type] ?? "🔔";
          return (
            <div
              key={n.id}
              className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-red-500/5 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-sm shrink-0">{emoji}</span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-red-800 truncate">{n.title}</p>
                  {n.clientName && (
                    <p className="text-[10px] text-red-600/70 truncate">{n.clientName}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {n.actionUrl && (
                  <Link href={n.actionUrl} onClick={() => dismiss(n.id)}>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-6 text-[10px] px-2.5 gap-1 bg-red-500/90 hover:bg-red-500"
                    >
                      {n.actionLabel ?? "Voir"}
                      <ExternalLink className="h-2.5 w-2.5" />
                    </Button>
                  </Link>
                )}
                {n.facebookProfileUrl && (
                  <a
                    href={n.facebookProfileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-red-600/60 hover:text-red-700 flex items-center gap-0.5"
                  >
                    FB
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
                <button
                  onClick={() => dismiss(n.id)}
                  className="h-5 w-5 flex items-center justify-center rounded hover:bg-red-500/10 text-red-400 hover:text-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          );
        })}

        {criticals.length > 5 && (
          <div className="px-4 py-2 text-center">
            <p className="text-[10px] text-red-600/60">
              + {criticals.length - 5} autre{criticals.length - 5 > 1 ? "s" : ""} alerte{criticals.length - 5 > 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Warning banner (non-critique) ───────────────────────────────────────────

interface WarningAlertsBannerProps {
  warnings: Notification[];
}

export function WarningAlertsBanner({ warnings }: WarningAlertsBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  const unread = warnings.filter((n) => !n.isRead);
  if (unread.length === 0 || dismissed) return null;

  return (
    <div className="flex items-center gap-3 rounded-md border border-amber-500/25 bg-amber-500/5 px-4 py-3">
      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-amber-700">
          {unread.length} avertissement{unread.length > 1 ? "s" : ""}
        </p>
        <p className="text-[10px] text-amber-600/80 truncate">
          {unread[0].message}
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-amber-500/60 hover:text-amber-700 shrink-0"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
