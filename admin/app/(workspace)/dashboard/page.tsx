"use client";

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
  Sparkles,
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

// ─── Period switch ────────────────────────────────────────────────────────

function PeriodBtn({
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
      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {value === "7d" ? "7 jours" : value === "30d" ? "30 jours" : "90 jours"}
    </button>
  );
}

// ─── KPI card — glass surface + colored hairline + font-black number ─────

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ElementType;
  color: string;
  sub?: string;
}) {
  return (
    <div className="glass-card group p-4 transition-shadow duration-200 hover:shadow-md sm:p-5">
      <div
        className="card-hairline"
        style={{
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        }}
      />
      <div className="mb-3 flex items-center justify-between">
        <span className="text-label">{label}</span>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ background: `color-mix(in oklch, ${color} 14%, transparent)`, color }}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="tabular text-3xl font-black tracking-tight">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ─── Chart card wrapper — glass surface + hairline ────────────────────────

function ChartCard({
  title,
  sub,
  accent,
  children,
}: {
  title: string;
  sub?: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-card p-4 sm:p-5">
      <div
        className="card-hairline"
        style={{
          background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
        }}
      />
      <div className="mb-4">
        <p className="text-sm font-semibold">{title}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
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
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 text-muted-foreground">{label}</p>
      <p className="tabular font-semibold">
        {fmt ? fmt(payload[0].value) : payload[0].value}
      </p>
    </div>
  );
}

// ─── Semantic plan color map — one source of truth, reused everywhere ────

const PLAN_COLORS: Record<string, string> = {
  FREE: "var(--muted-foreground)",
  STARTER: "var(--primary)",
  PRO: "var(--secondary)",
  CUSTOM: "var(--warning)",
};
const PLAN_LABELS: Record<string, string> = {
  FREE: "Gratuit",
  STARTER: "Starter",
  PRO: "Pro",
  CUSTOM: "Custom",
};

// ─── Skeleton — matches the exact geometry of the loaded layout ──────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="admin-panel p-6 sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-8 w-52" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-9 w-48 rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="glass-card p-4">
            <Skeleton className="mb-3 h-3 w-20" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [charts, setCharts] = useState<AdminDashboardCharts | null>(null);
  const [period, setPeriod] = useState<ChartPeriod>("30d");
  const [loadS, setLoadS] = useState(true);
  const [loadC, setLoadC] = useState(true);

  const loadStats = useCallback(() => {
    let cancelled = false;
    adminDashboardApi.getStats().then((d) => {
      if (!cancelled) {
        setStats(d);
        setLoadS(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadCharts = useCallback(() => {
    let cancelled = false;
    setLoadC(true);
    adminDashboardApi.getCharts(period).then((d) => {
      if (!cancelled) {
        setCharts(d);
        setLoadC(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [period]);

  useEffect(() => loadStats(), [loadStats]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => loadCharts(), [loadCharts]);

  useEffect(() => {
    const id = setInterval(() => {
      loadStats();
      loadCharts();
    }, 30_000);
    return () => clearInterval(id);
  }, [loadStats, loadCharts]);

  if (loadS && !stats) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      <div className="admin-panel overflow-hidden p-6 sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Centre de pilotage
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-[1.7rem]">
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Surveillez l’activité, les revenus et la santé de vos comptes en un instant.
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/50 p-1">
            {(["7d", "30d", "90d"] as ChartPeriod[]).map((p) => (
              <PeriodBtn
                key={p}
                value={p}
                active={period === p}
                onClick={() => setPeriod(p)}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {stats && (
          <>
            <KpiCard
              label="Utilisateurs"
              value={stats.totalUsers.toLocaleString("fr-FR")}
              icon={Users}
              color="var(--primary)"
            />
            <KpiCard
              label="Abonnements actifs"
              value={stats.activeSubscriptions.toLocaleString("fr-FR")}
              icon={CreditCard}
              color="var(--secondary)"
            />
            <KpiCard
              label="Nouveaux auj."
              value={stats.newUsersToday}
              icon={UserPlus}
              color={stats.newUsersToday > 0 ? "var(--secondary)" : "var(--muted-foreground)"}
            />
            <KpiCard
              label="Suspendus"
              value={stats.suspendedUsers}
              icon={ShieldAlert}
              color={stats.suspendedUsers > 0 ? "var(--destructive)" : "var(--muted-foreground)"}
            />
            <KpiCard
              label="Revenus totaux"
              value={stats.totalRevenue.toLocaleString("fr-FR")}
              icon={TrendingUp}
              color="var(--primary)"
              sub="Ariary"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Nouveaux utilisateurs" sub="Inscriptions par jour" accent="var(--secondary)">
          {loadC ? (
            <Skeleton className="h-44 w-full rounded-lg" />
          ) : (
            <ResponsiveContainer width="100%" height={176}>
              <AreaChart data={charts?.newUsers ?? []}>
                <defs>
                  <linearGradient id="geu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--secondary)" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="var(--secondary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="currentColor" strokeOpacity={0.04} strokeDasharray="2 4" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  width={26}
                />
                <RechartsTooltip content={<ChartTip />} cursor={{ stroke: "var(--border)" }} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="var(--secondary)"
                  strokeWidth={2}
                  fill="url(#geu)"
                  activeDot={{ r: 3, fill: "var(--secondary)", strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Revenus" sub="Paiements réussis (Ar)" accent="var(--primary)">
          {loadC ? (
            <Skeleton className="h-44 w-full rounded-lg" />
          ) : (
            <ResponsiveContainer width="100%" height={176}>
              <AreaChart data={charts?.revenue ?? []}>
                <defs>
                  <linearGradient id="ger" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="currentColor" strokeOpacity={0.04} strokeDasharray="2 4" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <RechartsTooltip
                  content={<ChartTip fmt={(v) => `${v.toLocaleString("fr-FR")} Ar`} />}
                  cursor={{ stroke: "var(--border)" }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fill="url(#ger)"
                  activeDot={{ r: 3, fill: "var(--primary)", strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard title="Consommation crédits" sub="Débits IA agrégés" accent="var(--secondary)">
            {loadC ? (
              <Skeleton className="h-44 w-full rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height={176}>
                <BarChart data={charts?.creditConsumption ?? []} barSize={period === "90d" ? 3 : 7}>
                  <defs>
                    <linearGradient id="gCredit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--secondary)" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="var(--secondary)" stopOpacity={0.55} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="currentColor" strokeOpacity={0.04} strokeDasharray="2 4" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    width={32}
                  />
                  <RechartsTooltip
                    content={<ChartTip />}
                    cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                  />
                  <Bar dataKey="value" fill="url(#gCredit)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        <ChartCard title="Plans" sub="Distribution actuelle" accent="var(--warning)">
          {loadC ? (
            <Skeleton className="h-44 w-full rounded-lg" />
          ) : (
            <div className="space-y-3.5 pt-1">
              {(charts?.planDistribution ?? []).map((item) => (
                <div key={item.plan}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {PLAN_LABELS[item.plan] ?? item.plan}
                    </span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="tabular text-sm font-semibold">
                        {item.count.toLocaleString("fr-FR")}
                      </span>
                      <span className="tabular text-xs text-muted-foreground">
                        {item.pct}%
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${item.pct}%`,
                        backgroundColor: PLAN_COLORS[item.plan] ?? "var(--secondary)",
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
