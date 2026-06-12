/**
 * @file features/dashboard/components/critical-alerts-banner.tsx
 *
 * Bandeau d'alertes critiques avec RadialBarChart shadcn.
 * Layout 2 colonnes : chart de distribution à gauche, liste à droite.
 */
"use client";

import { Card } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { AlertTriangle, ArrowRight, X, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Cell, Pie, PieChart, RadialBar, RadialBarChart } from "recharts";
import type { Notification } from "../types/dashboard.types";

// ─── URL helpers ──────────────────────────────────────────────────────────────

function normalizeConversationUrl(
  url: string | null | undefined,
): string | null {
  if (!url) return null;
  if (url.includes("?conv=")) return url;
  const match = url.match(/\/conversations\/([a-f0-9-]{36})/i);
  if (match?.[1]) return `/inbox?conv=${match[1]}`;
  const uuidMatch = url.match(
    /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i,
  );
  if (uuidMatch?.[1]) return `/inbox?conv=${uuidMatch[1]}`;
  return url;
}

// ─── Type config ──────────────────────────────────────────────────────────────

interface TypeConfig {
  emoji: string;
  label: string;
  color: string;
  chartKey: string;
}

const TYPE_CONFIG: Record<string, TypeConfig> = {
  HUMAN_TAKEOVER_REQUIRED: {
    emoji: "🚨",
    label: "Prise en main",
    color: "#ef4444",
    chartKey: "takeover",
  },
  ANGRY_CLIENT_DETECTED: {
    emoji: "😤",
    label: "Client mécontent",
    color: "#f97316",
    chartKey: "angry",
  },
  AI_STUCK_LOOP: {
    emoji: "🔄",
    label: "Boucle IA",
    color: "#eab308",
    chartKey: "loop",
  },
  HOT_PROSPECT: {
    emoji: "🔥",
    label: "Prospect chaud",
    color: "#ec4899",
    chartKey: "prospect",
  },
  UNANSWERED_HUMAN: {
    emoji: "⏰",
    label: "Sans réponse",
    color: "#ef4444",
    chartKey: "unanswered",
  },
  MESSENGER_WINDOW_EXPIRED: {
    emoji: "🕐",
    label: "Fenêtre expirée",
    color: "#dc2626",
    chartKey: "window",
  },
  CREDITS_DEPLETED: {
    emoji: "❌",
    label: "Crédits épuisés",
    color: "#b91c1c",
    chartKey: "credits",
  },
  CREDITS_CRITICAL: {
    emoji: "⚠️",
    label: "Crédits critiques",
    color: "#f97316",
    chartKey: "crit",
  },
  FACEBOOK_TOKEN_EXPIRED: {
    emoji: "🔌",
    label: "Token expiré",
    color: "#ef4444",
    chartKey: "token",
  },
  SYNC_FAILED: {
    emoji: "⚠️",
    label: "Sync échouée",
    color: "#eab308",
    chartKey: "sync",
  },
  POST_LIMIT_REACHED: {
    emoji: "📌",
    label: "Limite posts",
    color: "#f59e0b",
    chartKey: "posts",
  },
  SUBSCRIPTION_EXPIRING: {
    emoji: "⏰",
    label: "Abonnement",
    color: "#f97316",
    chartKey: "sub",
  },
};

const DEFAULT_CONFIG: TypeConfig = {
  emoji: "🔔",
  label: "Alerte",
  color: "#ef4444",
  chartKey: "other",
};

// ─── Distribution chart ───────────────────────────────────────────────────────

interface ChartEntry {
  name: string;
  value: number;
  color: string;
  emoji: string;
}

function AlertDistributionChart({ criticals }: { criticals: Notification[] }) {
  // Group by type
  const grouped: Record<string, { count: number; cfg: TypeConfig }> = {};
  for (const n of criticals) {
    const cfg = TYPE_CONFIG[n.type] ?? DEFAULT_CONFIG;
    const key = cfg.chartKey;
    if (!grouped[key]) grouped[key] = { count: 0, cfg };
    grouped[key].count++;
  }

  const chartData: ChartEntry[] = Object.values(grouped)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5) // show max 5 slices for readability
    .map(({ count, cfg }) => ({
      name: cfg.label,
      value: count,
      color: cfg.color,
      emoji: cfg.emoji,
    }));

  const chartConfig = Object.fromEntries(
    chartData.map((d) => [d.name, { label: d.name, color: d.color }]),
  );

  const total = criticals.length;

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Donut chart */}
      <div className="relative">
        <ChartContainer config={chartConfig} className="h-[110px] w-[110px]">
          <PieChart>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  className="text-[11px] min-w-[110px]"
                  nameKey="name"
                  hideLabel
                />
              }
            />
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={32}
              outerRadius={50}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {chartData.map((entry, i) => (
                <Cell key={`cell-${i}`} fill={entry.color} fillOpacity={0.9} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>

        {/* Center count */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-black tabular-nums text-red-500 leading-none">
            {total}
          </span>
          <span className="text-[9px] text-muted-foreground leading-none mt-0.5">
            alertes
          </span>
        </div>
      </div>

      {/* Legend dots */}
      <div className="flex flex-col gap-1 w-full px-1">
        {chartData.map((d) => (
          <div key={d.name} className="flex items-center gap-1.5">
            <span
              className="h-1.5 w-1.5 rounded-full shrink-0"
              style={{ background: d.color }}
            />
            <span className="text-[10px] text-muted-foreground truncate flex-1">
              {d.emoji} {d.name}
            </span>
            <span
              className="text-[10px] font-bold tabular-nums"
              style={{ color: d.color }}
            >
              {d.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Single alert row ─────────────────────────────────────────────────────────

interface AlertRowProps {
  notif: Notification;
  onDismiss: (id: string) => void;
}

function AlertRow({ notif: n, onDismiss }: AlertRowProps) {
  const cfg = TYPE_CONFIG[n.type] ?? DEFAULT_CONFIG;
  const actionHref = normalizeConversationUrl(n.actionUrl) ?? n.actionUrl;

  return (
    <div className="group flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-red-500/[0.04] transition-colors">
      {/* Colored dot */}
      <div
        className="h-7 w-7 rounded-lg flex items-center justify-center text-[13px] shrink-0 border"
        style={{
          background: `${cfg.color}18`,
          borderColor: `${cfg.color}30`,
        }}
      >
        {cfg.emoji}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-foreground leading-snug truncate">
          {n.title}
        </p>
        {n.clientName && (
          <p className="text-[10px] text-muted-foreground truncate leading-none mt-0.5">
            {n.clientName}
          </p>
        )}
      </div>

      {/* Action + dismiss */}
      <div className="flex items-center gap-1 shrink-0">
        {actionHref && (
          <Link href={actionHref} onClick={() => onDismiss(n.id)}>
            <button
              className="h-6 px-2 rounded-md text-[10px] font-semibold flex items-center gap-1 transition-colors"
              style={{
                background: `${cfg.color}18`,
                color: cfg.color,
                border: `1px solid ${cfg.color}30`,
              }}
            >
              {n.actionLabel ?? "Voir"}
              <ArrowRight className="h-2.5 w-2.5" />
            </button>
          </Link>
        )}
        <button
          onClick={() => onDismiss(n.id)}
          className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
          aria-label="Ignorer"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Critical alerts banner ───────────────────────────────────────────────────

interface CriticalAlertsBannerProps {
  notifications: Notification[];
  onMarkRead: (ids: string[]) => void;
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
    <Card className="border-red-500/20 bg-red-500/[0.03] backdrop-blur-sm overflow-hidden relative">
      {/* Top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5 pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent, #ef4444, #f97316, transparent)",
        }}
      />

      <div className="p-4">
        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="relative h-6 w-6 shrink-0">
              <div
                className="absolute inset-0 rounded-full bg-red-500/20 animate-ping"
                style={{ animationDuration: "2s" }}
              />
              <div className="relative h-6 w-6 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                <XCircle className="h-3 w-3 text-red-500" />
              </div>
            </div>
            <div>
              <p className="text-[12px] font-bold text-red-600 dark:text-red-400 leading-none">
                {criticals.length} alerte{criticals.length > 1 ? "s" : ""}{" "}
                critique{criticals.length > 1 ? "s" : ""}
              </p>
              <p className="text-[10px] text-muted-foreground leading-none mt-0.5">
                Nécessite{criticals.length > 1 ? "nt" : ""} votre attention
                immédiate
              </p>
            </div>
          </div>

          <button
            onClick={dismissAll}
            className="flex items-center gap-1 h-6 px-2 rounded-lg text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-red-500/10 transition-colors border border-border/40"
          >
            <X className="h-3 w-3" />
            Tout ignorer
          </button>
        </div>

        {/* ── 2-col layout: chart + list ── */}
        <div className="flex gap-4">
          {/* Chart column — hidden if only 1 alert (no point showing a chart) */}
          {criticals.length > 1 && (
            <div className="shrink-0 w-[130px] border-r border-red-500/10 pr-4">
              <AlertDistributionChart criticals={criticals} />
            </div>
          )}

          {/* Alert list */}
          <div
            className={cn(
              "flex-1 flex flex-col gap-0.5 min-w-0",
              criticals.length === 1 && "w-full",
            )}
          >
            {criticals.slice(0, 5).map((n) => (
              <AlertRow key={n.id} notif={n} onDismiss={dismiss} />
            ))}

            {criticals.length > 5 && (
              <div className="flex items-center justify-center gap-1.5 pt-1">
                <span className="h-px flex-1 bg-red-500/10" />
                <p className="text-[10px] text-muted-foreground shrink-0">
                  + {criticals.length - 5} alerte
                  {criticals.length - 5 > 1 ? "s" : ""} supplémentaire
                  {criticals.length - 5 > 1 ? "s" : ""}
                </p>
                <span className="h-px flex-1 bg-red-500/10" />
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Warning banner ───────────────────────────────────────────────────────────

interface WarningAlertsBannerProps {
  warnings: Notification[];
}

export function WarningAlertsBanner({ warnings }: WarningAlertsBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  const unread = warnings.filter((n) => !n.isRead);
  if (unread.length === 0 || dismissed) return null;

  // Build mini bar data from warning types
  const grouped: Record<string, number> = {};
  for (const n of unread) {
    grouped[n.type] = (grouped[n.type] ?? 0) + 1;
  }

  const barData = Object.entries(grouped)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)
    .map(([type, count]) => ({
      name: TYPE_CONFIG[type]?.label ?? "Alerte",
      value: count,
      fill: "#f59e0b",
    }));

  const warningChartConfig = { value: { label: "Alertes", color: "#f59e0b" } };

  return (
    <Card className="border-amber-500/20 bg-amber-500/[0.03] backdrop-blur-sm overflow-hidden relative">
      <div
        className="absolute top-0 left-0 right-0 h-0.5 pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent, #f59e0b, transparent)",
        }}
      />

      <div className="flex items-center gap-4 px-4 py-3">
        {/* Icon */}
        <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 leading-none">
            {unread.length} avertissement{unread.length > 1 ? "s" : ""}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
            {unread[0].message}
          </p>
        </div>

        {/* Mini bar chart — only when multiple warnings */}
        {barData.length > 1 && (
          <div className="shrink-0 hidden sm:block">
            <ChartContainer config={warningChartConfig} className="h-8 w-24">
              <RadialBarChart
                cx="50%"
                cy="100%"
                innerRadius="30%"
                outerRadius="80%"
                startAngle={180}
                endAngle={0}
                data={barData.slice(0, 3)}
                barSize={6}
              >
                <RadialBar dataKey="value" cornerRadius={2}>
                  {barData.slice(0, 3).map((_, i) => (
                    <Cell
                      key={`cell-${i}`}
                      fill="#f59e0b"
                      fillOpacity={1 - i * 0.25}
                    />
                  ))}
                </RadialBar>
              </RadialBarChart>
            </ChartContainer>
          </div>
        )}

        {/* Count badge */}
        {unread.length > 1 && (
          <span className="shrink-0 h-5 min-w-5 px-1.5 rounded-full bg-amber-500/15 border border-amber-500/20 text-[9px] font-bold text-amber-600 dark:text-amber-400 flex items-center justify-center tabular-nums">
            {unread.length}
          </span>
        )}

        <button
          onClick={() => setDismissed(true)}
          className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground hover:bg-amber-500/10 transition-colors shrink-0"
          aria-label="Ignorer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </Card>
  );
}
