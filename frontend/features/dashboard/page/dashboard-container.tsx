/**
 * @file features/dashboard/pages/dashboard-page.tsx
 *
 * Dashboard VendeoAI — Vue principale déportée dans le dossier feature.
 */

"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CriticalAlertsBanner,
  WarningAlertsBanner,
} from "@/features/dashboard/components/critical-alerts-banner";
import { NotificationCenter } from "@/features/dashboard/components/notification-center";
import {
  ActivityTodayCard,
  AiStatsCard,
  ResponseRateCard,
} from "@/features/dashboard/components/stats-cards";
import { SubscriptionCard } from "@/features/dashboard/components/subscription-card";
import { WeeklyChart } from "@/features/dashboard/components/weekly-chart";
import { useDashboard } from "@/features/dashboard/hooks/use-dashboard";
import { useWebPush } from "@/features/dashboard/hooks/use-web-push";
import { IconActivity } from "@tabler/icons-react";
import { RefreshCw } from "lucide-react";

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="p-5 space-y-5 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-7 w-24" />
      </div>
      <Skeleton className="h-40 w-full rounded-lg" />
      <div className="grid gap-3 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-36 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <Skeleton className="lg:col-span-2 h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
      <Skeleton className="h-80 w-full rounded-lg" />
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data, isLoading, error, refetch, markRead, deleteNotif } =
    useDashboard();

  // Enregistrer Web Push selon le plan (Starter/Pro uniquement)
  useWebPush(data?.subscription.planId);

  if (isLoading) return <DashboardSkeleton />;

  if (error || !data) {
    return (
      <div className="p-5 flex flex-col items-center gap-4 h-64 justify-center">
        <p className="text-sm text-muted-foreground">
          {error ?? "Erreur de chargement"}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Réessayer
        </Button>
      </div>
    );
  }

  const criticals = data.notifications.filter(
    (n) => n.severity === "CRITICAL" && !n.isRead,
  );
  const warnings = data.notifications.filter(
    (n) => n.severity === "WARNING" && !n.isRead,
  );

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  return (
    <div className="p-5 space-y-5">
      {criticals.length > 0 && (
        <CriticalAlertsBanner
          notifications={criticals}
          onMarkRead={(ids) => markRead(ids)}
        />
      )}

      {warnings.length > 0 && criticals.length === 0 && (
        <WarningAlertsBanner warnings={warnings} />
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[1.4rem] font-bold tracking-tight">Dashboard</h1>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {greeting} · Activité de votre assistant IA
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 text-[11px] text-muted-foreground"
            onClick={() => refetch()}
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-[11px] border-border/50"
          >
            <IconActivity className="h-3 w-3" />
            En direct
            <span
              className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"
              style={{ boxShadow: "0 0 4px #34d399" }}
            />
          </Button>
        </div>
      </div>

      <SubscriptionCard data={data.subscription} />

      <div className="grid gap-3 sm:grid-cols-3">
        <AiStatsCard data={data.aiStats} />
        <ResponseRateCard data={data.responseRate} />
        <ActivityTodayCard data={data.activityToday} />
      </div>

      <WeeklyChart data={data.weeklyChart} />

      <NotificationCenter
        notifications={data.notifications}
        unreadCount={data.unreadCount}
        criticalCount={data.criticalCount}
        onMarkRead={(ids, all) => markRead(ids, all)}
        onDelete={deleteNotif}
      />
    </div>
  );
}
