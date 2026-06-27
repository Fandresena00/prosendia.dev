"use client";

// app/(workspace)/dashboard/page.tsx
// Linear dark style — données réelles — auto-refresh 30s

import { Skeleton } from "@/components/ui/skeleton";
import {
  adminDashboardApi,
  type AdminDashboardCharts,
  type AdminDashboardStats,
  type ChartPeriod,
} from "@/lib/admin-api";
import {
  CreditCard,
  ShieldAlert,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

// ─── Period tab ───────────────────────────────────────────────────────────────

function PeriodTab({
  value,
  active,
  onClick,
}: {
  value: ChartPeriod;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded px-2.5 py-1 text-[11px] font-medium transition-all ${
        active
          ? "bg-white/10 text-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {value === "7d" ? "7 jours" : value === "30d" ? "30 jours" : "90 jours"}
    </button>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ElementType;
  accent?: boolean;
  sub?: string;
}) {
  return (
    <div className="group rounded-lg border border-border bg-card p-4 transition-colors hover:border-border/80 hover:bg-card/80">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground/60">
          {label}
        </span>
        <div
          className={`flex h-6 w-6 items-center justify-center rounded-md ${
            accent
              ? "bg-primary/15 text-primary"
              : "bg-white/5 text-muted-foreground/40"
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <p className="font-mono-data text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
      {sub && (
        <p className="mt-1 text-[11px] text-muted-foreground/50">{sub}</p>
      )}
    </div>
  );
}

// ─── Chart wrapper ────────────────────────────────────────────────────────────

function ChartCard({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-4">
        <p className="text-[13px] font-semibold text-foreground">{title}</p>
        {sub && (
          <p className="mt-0.5 text-[11px] text-muted-foreground/50">{sub}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function ChartTip({
  active,
  payload,
  label,
  fmt,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  fmt?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border/50 bg-popover px-2.5 py-2 shadow-xl text-xs">
      <p className="mb-1 text-muted-foreground">{label}</p>
      <p className="font-mono font-semibold text-foreground">
        {fmt ? fmt(payload[0].value) : payload[0].value}
      </p>
    </div>
  );
}

const PLAN_COLORS: Record<string, string> = {
  FREE: "hsl(var(--muted-foreground))",
  STARTER: "hsl(var(--chart-3))",
  PRO: "hsl(var(--primary))",
  CUSTOM: "hsl(var(--chart-4))",
};
const PLAN_LABELS: Record<string, string> = {
  FREE: "Gratuit",
  STARTER: "Starter",
  PRO: "Pro",
  CUSTOM: "Custom",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [charts, setCharts] = useState<AdminDashboardCharts | null>(null);
  const [period, setPeriod] = useState<ChartPeriod>("30d");
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingCharts, setLoadingCharts] = useState(true);

  const loadStats = useCallback(() => {
    let cancelled = false;
    adminDashboardApi.getStats().then((d) => {
      if (!cancelled) {
        setStats(d);
        setLoadingStats(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadCharts = useCallback(() => {
    let cancelled = false;
    setLoadingCharts(true);
    adminDashboardApi.getCharts(period).then((d) => {
      if (!cancelled) {
        setCharts(d);
        setLoadingCharts(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [period]);

  // Initial load
  useEffect(() => loadStats(), [loadStats]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => loadCharts(), [loadCharts]);

  // Auto-refresh toutes les 30s
  useEffect(() => {
    const interval = setInterval(() => {
      loadStats();
      loadCharts();
    }, 30_000);
    return () => clearInterval(interval);
  }, [loadStats, loadCharts]);

  const fmtRevenue = (v: number) => `${v.toLocaleString("fr-FR")} Ar`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight">
            Dashboard
          </h1>
          <p className="mt-0.5 text-[12px] text-muted-foreground/60">
            Vue d&apos;ensemble · Actualisation auto 30s
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-border bg-card p-1">
          {(["7d", "30d", "90d"] as ChartPeriod[]).map((p) => (
            <PeriodTab
              key={p}
              value={p}
              active={period === p}
              onClick={() => setPeriod(p)}
            />
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {loadingStats ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border border-border bg-card p-4"
            >
              <Skeleton className="mb-3 h-3 w-20" />
              <Skeleton className="h-7 w-14" />
            </div>
          ))
        ) : stats ? (
          <>
            <KpiCard
              label="Utilisateurs"
              value={stats.totalUsers.toLocaleString("fr-FR")}
              icon={Users}
              accent
            />
            <KpiCard
              label="Abonnements actifs"
              value={stats.activeSubscriptions.toLocaleString("fr-FR")}
              icon={CreditCard}
            />
            <KpiCard
              label="Nouveaux aujourd'hui"
              value={stats.newUsersToday}
              icon={UserPlus}
              accent={stats.newUsersToday > 0}
            />
            <KpiCard
              label="Suspendus"
              value={stats.suspendedUsers}
              icon={ShieldAlert}
            />
            <KpiCard
              label="Revenus totaux"
              value={stats.totalRevenue.toLocaleString("fr-FR")}
              sub="Ariary"
              icon={TrendingUp}
            />
          </>
        ) : null}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Nouveaux utilisateurs" sub="Inscriptions par jour">
          {loadingCharts ? (
            <Skeleton className="h-44 w-full rounded" />
          ) : (
            <ResponsiveContainer width="100%" height={176}>
              <AreaChart data={charts?.newUsers ?? []}>
                <defs>
                  <linearGradient id="gu" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0.2}
                    />
                    <stop
                      offset="95%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="hsl(var(--border))"
                  strokeDasharray="2 4"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{
                    fontSize: 10,
                    fill: "hsl(var(--muted-foreground))",
                    opacity: 0.5,
                  }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{
                    fontSize: 10,
                    fill: "hsl(var(--muted-foreground))",
                    opacity: 0.5,
                  }}
                  axisLine={false}
                  tickLine={false}
                  width={24}
                />
                <RechartsTooltip
                  content={<ChartTip />}
                  cursor={{ stroke: "hsl(var(--border))" }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  strokeWidth={1.5}
                  fill="url(#gu)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Revenus" sub="Paiements réussis (Ar)">
          {loadingCharts ? (
            <Skeleton className="h-44 w-full rounded" />
          ) : (
            <ResponsiveContainer width="100%" height={176}>
              <AreaChart data={charts?.revenue ?? []}>
                <defs>
                  <linearGradient id="gr" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="hsl(var(--chart-2))"
                      stopOpacity={0.2}
                    />
                    <stop
                      offset="95%"
                      stopColor="hsl(var(--chart-2))"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="hsl(var(--border))"
                  strokeDasharray="2 4"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{
                    fontSize: 10,
                    fill: "hsl(var(--muted-foreground))",
                    opacity: 0.5,
                  }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{
                    fontSize: 10,
                    fill: "hsl(var(--muted-foreground))",
                    opacity: 0.5,
                  }}
                  axisLine={false}
                  tickLine={false}
                  width={38}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <RechartsTooltip
                  content={<ChartTip fmt={fmtRevenue} />}
                  cursor={{ stroke: "hsl(var(--border))" }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={1.5}
                  fill="url(#gr)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard title="Consommation de crédits" sub="Débits IA agrégés">
            {loadingCharts ? (
              <Skeleton className="h-44 w-full rounded" />
            ) : (
              <ResponsiveContainer width="100%" height={176}>
                <BarChart
                  data={charts?.creditConsumption ?? []}
                  barSize={period === "90d" ? 3 : 7}
                >
                  <CartesianGrid
                    stroke="hsl(var(--border))"
                    strokeDasharray="2 4"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{
                      fontSize: 10,
                      fill: "hsl(var(--muted-foreground))",
                      opacity: 0.5,
                    }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{
                      fontSize: 10,
                      fill: "hsl(var(--muted-foreground))",
                      opacity: 0.5,
                    }}
                    axisLine={false}
                    tickLine={false}
                    width={32}
                  />
                  <RechartsTooltip
                    content={<ChartTip />}
                    cursor={{ fill: "hsl(var(--border))", opacity: 0.3 }}
                  />
                  <Bar
                    dataKey="value"
                    fill="hsl(var(--primary))"
                    radius={[2, 2, 0, 0]}
                    fillOpacity={0.8}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        <ChartCard title="Plans" sub="Distribution actuelle">
          {loadingCharts ? (
            <Skeleton className="h-44 w-full rounded" />
          ) : (
            <div className="space-y-3 pt-1">
              {(charts?.planDistribution ?? []).map((item) => (
                <div key={item.plan}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-medium text-foreground">
                      {PLAN_LABELS[item.plan] ?? item.plan}
                    </span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-mono text-[12px] font-semibold text-foreground">
                        {item.count.toLocaleString("fr-FR")}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground/50">
                        {item.pct}%
                      </span>
                    </div>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${item.pct}%`,
                        backgroundColor:
                          PLAN_COLORS[item.plan] ?? "hsl(var(--primary))",
                      }}
                    />
                  </div>
                </div>
              ))}
              {(charts?.planDistribution ?? []).length === 0 && (
                <p className="py-8 text-center text-xs text-muted-foreground/40">
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
