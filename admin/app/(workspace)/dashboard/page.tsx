"use client";

// app/(workspace)/dashboard/page.tsx
// Données réelles — stats + graphiques recharts (newUsers, revenue, credits, plans)

import { useCallback, useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  adminDashboardApi,
  type AdminDashboardStats,
  type AdminDashboardCharts,
  type ChartPeriod,
} from "@/lib/admin-api";
import {
  Users,
  TrendingUp,
  CreditCard,
  ShieldAlert,
  UserPlus,
  Zap,
} from "lucide-react";

// ─── Stat card ───────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  accent = false,
  suffix,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  accent?: boolean;
  suffix?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
            {label}
          </p>
          <p className="text-3xl font-semibold tracking-tight text-foreground">
            {value}
            {suffix && (
              <span className="ml-1 text-lg font-normal text-muted-foreground">
                {suffix}
              </span>
            )}
          </p>
        </div>
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-lg ${
            accent
              ? "bg-primary/10 text-primary"
              : "bg-muted/60 text-muted-foreground"
          }`}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

// ─── Chart card ──────────────────────────────────────────────────────────────

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-5">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {subtitle && (
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}

// ─── Period selector ─────────────────────────────────────────────────────────

function PeriodSelector({
  value,
  onChange,
}: {
  value: ChartPeriod;
  onChange: (p: ChartPeriod) => void;
}) {
  const options: { label: string; value: ChartPeriod }[] = [
    { label: "7j", value: "7d" },
    { label: "30j", value: "30d" },
    { label: "90j", value: "90d" },
  ];

  return (
    <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
            value === opt.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Custom tooltip ──────────────────────────────────────────────────────────

function CustomTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  formatter?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">
        {formatter ? formatter(val) : val}
      </p>
    </div>
  );
}

// ─── Plan distribution mini bar ──────────────────────────────────────────────

const PLAN_COLORS: Record<string, string> = {
  FREE: "hsl(var(--muted-foreground))",
  STARTER: "hsl(var(--chart-2))",
  PRO: "hsl(var(--primary))",
  CUSTOM: "hsl(var(--chart-1))",
};

const PLAN_LABELS: Record<string, string> = {
  FREE: "Gratuit",
  STARTER: "Starter",
  PRO: "Pro",
  CUSTOM: "Custom",
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [charts, setCharts] = useState<AdminDashboardCharts | null>(null);
  const [period, setPeriod] = useState<ChartPeriod>("30d");
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingCharts, setLoadingCharts] = useState(true);

  // Chargement stats globales (une seule fois)
  useEffect(() => {
    let cancelled = false;
    adminDashboardApi.getStats().then((data) => {
      if (!cancelled) {
        setStats(data);
        setLoadingStats(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Chargement charts (rechargé à chaque changement de period)
  useEffect(() => {
    let cancelled = false;
    setLoadingCharts(true);
    adminDashboardApi.getCharts(period).then((data) => {
      if (!cancelled) {
        setCharts(data);
        setLoadingCharts(false);
      }
    });
    return () => { cancelled = true; };
  }, [period]);

  const formatRevenue = (v: number) =>
    `${v.toLocaleString("fr-FR")} Ar`;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Vue d&apos;ensemble de la plateforme en temps réel
          </p>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* ── Stats cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        {loadingStats ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-5">
              <Skeleton className="mb-3 h-3 w-24" />
              <Skeleton className="h-8 w-16" />
            </div>
          ))
        ) : stats ? (
          <>
            <StatCard
              label="Utilisateurs"
              value={stats.totalUsers.toLocaleString("fr-FR")}
              icon={Users}
              accent
            />
            <StatCard
              label="Abonnements actifs"
              value={stats.activeSubscriptions.toLocaleString("fr-FR")}
              icon={CreditCard}
            />
            <StatCard
              label="Nouveaux aujourd'hui"
              value={stats.newUsersToday}
              icon={UserPlus}
              accent={stats.newUsersToday > 0}
            />
            <StatCard
              label="Comptes suspendus"
              value={stats.suspendedUsers}
              icon={ShieldAlert}
            />
            <StatCard
              label="Revenus totaux"
              value={stats.totalRevenue.toLocaleString("fr-FR")}
              suffix="Ar"
              icon={TrendingUp}
            />
          </>
        ) : null}
      </div>

      {/* ── Charts row 1 ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Nouveaux utilisateurs */}
        <ChartCard
          title="Nouveaux utilisateurs"
          subtitle={`Inscriptions par jour — ${period === "7d" ? "7 derniers jours" : period === "30d" ? "30 derniers jours" : "90 derniers jours"}`}
        >
          {loadingCharts ? (
            <Skeleton className="h-48 w-full rounded-lg" />
          ) : (
            <ResponsiveContainer width="100%" height={192}>
              <AreaChart data={charts?.newUsers ?? []}>
                <defs>
                  <linearGradient id="gradUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                />
                <RechartsTooltip
                  content={<CustomTooltip />}
                  cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#gradUsers)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Revenus */}
        <ChartCard
          title="Revenus"
          subtitle="Paiements réussis (Ariary)"
        >
          {loadingCharts ? (
            <Skeleton className="h-48 w-full rounded-lg" />
          ) : (
            <ResponsiveContainer width="100%" height={192}>
              <AreaChart data={charts?.revenue ?? []}>
                <defs>
                  <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <RechartsTooltip
                  content={<CustomTooltip formatter={formatRevenue} />}
                  cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  fill="url(#gradRevenue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ── Charts row 2 ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Consommation crédits */}
        <div className="lg:col-span-2">
          <ChartCard
            title="Consommation de crédits"
            subtitle="Débits IA agrégés par jour"
          >
            {loadingCharts ? (
              <Skeleton className="h-48 w-full rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height={192}>
                <BarChart data={charts?.creditConsumption ?? []} barSize={period === "90d" ? 4 : 8}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                  />
                  <RechartsTooltip
                    content={<CustomTooltip />}
                    cursor={{ fill: "hsl(var(--border))", opacity: 0.4 }}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        {/* Distribution des plans */}
        <ChartCard title="Distribution des plans" subtitle="Répartition actuelle">
          {loadingCharts ? (
            <Skeleton className="h-48 w-full rounded-lg" />
          ) : (
            <div className="space-y-3 pt-1">
              {(charts?.planDistribution ?? []).map((item) => (
                <div key={item.plan} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground">
                      {PLAN_LABELS[item.plan] ?? item.plan}
                    </span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs font-semibold text-foreground tabular-nums">
                        {item.count.toLocaleString("fr-FR")}
                      </span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {item.pct}%
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${item.pct}%`,
                        backgroundColor: PLAN_COLORS[item.plan] ?? "hsl(var(--primary))",
                      }}
                    />
                  </div>
                </div>
              ))}
              {(charts?.planDistribution ?? []).length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Aucune donnée
                </p>
              )}
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
