"use client";

// app/(workspace)/dashboard/page.tsx

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { adminDashboardApi, type AdminDashboardStats } from "@/lib/admin-api";
import { cn } from "@/lib/utils";
import {
  ArrowUpRight,
  CreditCard,
  TrendingUp,
  UserPlus,
  Users,
  UserX,
} from "lucide-react";
import { useEffect, useState } from "react";

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ElementType;
  trend?: string;
  accent?: "emerald" | "amber" | "blue" | "zinc";
}

const ACCENT_CLASSES = {
  emerald: {
    icon: "text-emerald-400 bg-emerald-500/10",
    value: "text-zinc-100",
    trend: "text-emerald-400",
  },
  amber: {
    icon: "text-amber-400 bg-amber-500/10",
    value: "text-zinc-100",
    trend: "text-amber-400",
  },
  blue: {
    icon: "text-blue-400 bg-blue-500/10",
    value: "text-zinc-100",
    trend: "text-blue-400",
  },
  zinc: {
    icon: "text-zinc-400 bg-zinc-800",
    value: "text-zinc-100",
    trend: "text-zinc-400",
  },
};

function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  accent = "zinc",
}: StatCardProps) {
  const classes = ACCENT_CLASSES[accent];
  return (
    <Card className="border-zinc-800 bg-zinc-900/50">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              {label}
            </p>
            <p
              className={cn(
                "mt-2 text-2xl font-semibold tabular-nums",
                classes.value,
              )}
            >
              {value}
            </p>
            {trend && (
              <p
                className={cn(
                  "mt-1 flex items-center gap-1 text-[12px]",
                  classes.trend,
                )}
              >
                <ArrowUpRight className="h-3 w-3" />
                {trend}
              </p>
            )}
          </div>
          <div className={cn("rounded-lg p-2.5", classes.icon)}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatCardSkeleton() {
  return (
    <Card className="border-zinc-800 bg-zinc-900/50">
      <CardContent className="p-5">
        <Skeleton className="mb-2 h-3 w-24 bg-zinc-800" />
        <Skeleton className="h-8 w-20 bg-zinc-800" />
      </CardContent>
    </Card>
  );
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);

  useEffect(() => {
    adminDashboardApi
      .getStats()
      .then(setStats)
      .catch(() => {});
  }, []);

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[18px] font-semibold tracking-tight text-zinc-100">
          Dashboard
        </h1>
        <p className="mt-0.5 text-[13px] text-zinc-500">
          Vue d&apos;ensemble de la plateforme
        </p>
      </div>

      {/* Stats grid */}
      {!stats ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatCard
            label="Utilisateurs"
            value={stats.totalUsers.toLocaleString("fr-FR")}
            icon={Users}
            accent="zinc"
          />
          <StatCard
            label="Abonnements actifs"
            value={stats.activeSubscriptions.toLocaleString("fr-FR")}
            icon={TrendingUp}
            accent="emerald"
          />
          <StatCard
            label="Suspendus"
            value={stats.suspendedUsers.toLocaleString("fr-FR")}
            icon={UserX}
            accent="amber"
          />
          <StatCard
            label="Nouveaux aujourd'hui"
            value={`+${stats.newUsersToday}`}
            icon={UserPlus}
            accent="zinc"
          />
          <StatCard
            label="Revenu total"
            value={`${stats.totalRevenue.toLocaleString("fr-FR")} Ar`}
            icon={CreditCard}
            accent="blue"
          />
        </div>
      )}

      {/* Placeholder for future charts */}
      <div className="mt-8 rounded-xl border border-dashed border-zinc-800 p-12 text-center">
        <p className="text-[13px] text-zinc-600">
          Les graphiques d&apos;évolution seront disponibles prochainement.
        </p>
      </div>
    </div>
  );
}
