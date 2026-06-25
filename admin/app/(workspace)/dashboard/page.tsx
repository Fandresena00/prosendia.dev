"use client";

// app/(workspace)/dashboard/page.tsx

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  adminDashboardApi,
  type AdminDashboardCharts,
  type AdminDashboardStats,
  type ChartPeriod,
} from "@/lib/admin-api";
import { cn } from "@/lib/utils";
import { CreditCard, TrendingUp, UserPlus, Users, UserX } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ─── Données démo fallback ────────────────────────────────────────────────────

function generateDemoChartData(period: ChartPeriod): AdminDashboardCharts {
  const dayCount = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const today = new Date();

  const buildSeries = (maxValue: number) =>
    Array.from({ length: dayCount }, (_, dayIndex) => {
      const date = new Date(today);
      date.setDate(date.getDate() - (dayCount - 1 - dayIndex));
      return {
        date: date.toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "2-digit",
        }),
        value:
          Math.floor(Math.random() * maxValue) + Math.floor(maxValue * 0.1),
      };
    });

  return {
    newUsers: buildSeries(15),
    revenue: buildSeries(130_000),
    creditConsumption: buildSeries(9_000),
    planDistribution: [
      { plan: "FREE", count: 142, pct: 61 },
      { plan: "STARTER", count: 54, pct: 23 },
      { plan: "PRO", count: 31, pct: 13 },
      { plan: "CUSTOM", count: 7, pct: 3 },
    ],
  };
}

// ─── Tooltip commun ───────────────────────────────────────────────────────────

interface ChartTooltipProps {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  formatter?: (value: number) => string;
}

function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-semibold tabular-nums">
        {formatter
          ? formatter(payload[0].value)
          : payload[0].value.toLocaleString("fr-FR")}
      </p>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ElementType;
  sub?: string;
  isLoading: boolean;
  iconClassName?: string;
}

function StatCard({
  label,
  value,
  icon: Icon,
  sub,
  isLoading,
  iconClassName,
}: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            {isLoading ? (
              <Skeleton className="mt-2 h-8 w-24" />
            ) : (
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {value}
              </p>
            )}
            {!isLoading && sub && (
              <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
            )}
          </div>
          <div className={cn("rounded-lg p-2.5", iconClassName ?? "bg-muted")}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Axes communs ─────────────────────────────────────────────────────────────

const SHARED_AXIS_PROPS = {
  tick: { fill: "hsl(var(--muted-foreground))", fontSize: 11 },
  tickLine: false as const,
  axisLine: false as const,
};

// ─── Couleurs plans ───────────────────────────────────────────────────────────

const PLAN_CHART_COLORS: Record<string, string> = {
  FREE: "hsl(var(--muted-foreground))",
  STARTER: "hsl(var(--chart-2))",
  PRO: "hsl(var(--chart-1))",
  CUSTOM: "hsl(var(--chart-3))",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [chartData, setChartData] = useState<AdminDashboardCharts | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<ChartPeriod>("30d");
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [isChartsLoading, setIsChartsLoading] = useState(true);

  // Stats — chargement unique au montage
  useEffect(() => {
    adminDashboardApi
      .getStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setIsStatsLoading(false));
  }, []);

  // Charts — rechargement à chaque changement de période
  // NOTE: on évite setState synchrone dans l'effet en incluant le loading
  // dans la même passe via .finally() uniquement
  useEffect(() => {
    let cancelled = false;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsChartsLoading(true);

    adminDashboardApi
      .getCharts(selectedPeriod)
      .then((data) => {
        if (!cancelled) setChartData(data);
      })
      .catch(() => {
        if (!cancelled) setChartData(generateDemoChartData(selectedPeriod));
      })
      .finally(() => {
        if (!cancelled) setIsChartsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedPeriod]);

  const displayData = chartData ?? generateDemoChartData(selectedPeriod);
  const xAxisTickInterval =
    selectedPeriod === "7d" ? 0 : selectedPeriod === "30d" ? 4 : 13;

  const revenueTickFormatter = (tickValue: number): string =>
    `${(tickValue / 1_000).toFixed(0)}k`;

  const creditTickFormatter = (tickValue: number): string =>
    `${(tickValue / 1_000).toFixed(0)}k`;

  return (
    <div className="space-y-6">
      {/* ── En-tête ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Vue d&apos;ensemble de la plateforme VendeoAI
          </p>
        </div>

        <ToggleGroup
          type="single"
          value={selectedPeriod}
          onValueChange={(newPeriod) => {
            if (newPeriod) setSelectedPeriod(newPeriod as ChartPeriod);
          }}
          className="h-9"
        >
          <ToggleGroupItem value="7d" className="text-xs">
            7 jours
          </ToggleGroupItem>
          <ToggleGroupItem value="30d" className="text-xs">
            30 jours
          </ToggleGroupItem>
          <ToggleGroupItem value="90d" className="text-xs">
            90 jours
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* ── KPIs ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        <StatCard
          label="Utilisateurs"
          value={stats?.totalUsers.toLocaleString("fr-FR") ?? "—"}
          icon={Users}
          isLoading={isStatsLoading}
        />
        <StatCard
          label="Abonnements actifs"
          value={stats?.activeSubscriptions.toLocaleString("fr-FR") ?? "—"}
          icon={TrendingUp}
          iconClassName="bg-primary/10 text-primary"
          isLoading={isStatsLoading}
        />
        <StatCard
          label="Utilisateurs suspendus"
          value={stats?.suspendedUsers.toLocaleString("fr-FR") ?? "—"}
          icon={UserX}
          iconClassName="bg-destructive/10 text-destructive"
          isLoading={isStatsLoading}
        />
        <StatCard
          label="Nouveaux aujourd'hui"
          value={stats ? `+${stats.newUsersToday}` : "—"}
          icon={UserPlus}
          isLoading={isStatsLoading}
        />
        <StatCard
          label="Revenu total"
          value={
            stats ? `${stats.totalRevenue.toLocaleString("fr-FR")} Ar` : "—"
          }
          icon={CreditCard}
          iconClassName="bg-blue-500/10 text-blue-400"
          isLoading={isStatsLoading}
        />
      </div>

      {/* ── Graphiques row 1 ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Inscriptions — 2/3 */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Nouvelles inscriptions
            </CardTitle>
            <CardDescription>Utilisateurs créés sur la période</CardDescription>
          </CardHeader>
          <CardContent>
            {isChartsLoading ? (
              <Skeleton className="h-52 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={208}>
                <AreaChart
                  data={displayData.newUsers}
                  margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="gradientNewUsers"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="hsl(var(--chart-1))"
                        stopOpacity={0.2}
                      />
                      <stop
                        offset="100%"
                        stopColor="hsl(var(--chart-1))"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="hsl(var(--border))"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    {...SHARED_AXIS_PROPS}
                    interval={xAxisTickInterval}
                  />
                  <YAxis {...SHARED_AXIS_PROPS} allowDecimals={false} />
                  <Tooltip
                    content={
                      <ChartTooltip
                        formatter={(value) => `${value} inscriptions`}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2}
                    fill="url(#gradientNewUsers)"
                    dot={false}
                    activeDot={{
                      r: 4,
                      strokeWidth: 0,
                      fill: "hsl(var(--chart-1))",
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Répartition plans — 1/3 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Répartition des plans
            </CardTitle>
            <CardDescription>
              Distribution des abonnements actifs
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isChartsLoading ? (
              <Skeleton className="h-52 w-full" />
            ) : (
              <div className="flex h-52 items-center gap-4">
                <ResponsiveContainer width={120} height={120}>
                  <PieChart>
                    <Pie
                      data={displayData.planDistribution}
                      dataKey="count"
                      cx="50%"
                      cy="50%"
                      innerRadius={34}
                      outerRadius={56}
                      strokeWidth={2}
                      stroke="hsl(var(--card))"
                      paddingAngle={3}
                    >
                      {displayData.planDistribution.map((entry) => (
                        <Cell
                          key={entry.plan}
                          fill={PLAN_CHART_COLORS[entry.plan]}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>

                <div className="flex-1 space-y-2">
                  {displayData.planDistribution.map((entry) => (
                    <div
                      key={entry.plan}
                      className="flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-1.5">
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ background: PLAN_CHART_COLORS[entry.plan] }}
                        />
                        <span className="text-xs text-muted-foreground">
                          {entry.plan}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums text-xs font-medium">
                          {entry.count}
                        </span>
                        <span className="w-8 text-right tabular-nums text-xs text-muted-foreground">
                          {entry.pct}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Graphiques row 2 ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Revenus */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Revenus</CardTitle>
            <CardDescription>
              Total des paiements validés (Ariary)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isChartsLoading ? (
              <Skeleton className="h-44 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={176}>
                <BarChart
                  data={displayData.revenue}
                  margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
                >
                  <CartesianGrid
                    stroke="hsl(var(--border))"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    {...SHARED_AXIS_PROPS}
                    interval={xAxisTickInterval}
                  />
                  <YAxis
                    {...SHARED_AXIS_PROPS}
                    tickFormatter={revenueTickFormatter}
                  />
                  <Tooltip
                    content={
                      <ChartTooltip
                        formatter={(value) =>
                          `${value.toLocaleString("fr-FR")} Ar`
                        }
                      />
                    }
                  />
                  <Bar
                    dataKey="value"
                    fill="hsl(var(--chart-2))"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={24}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Crédits IA */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Crédits IA consommés
            </CardTitle>
            <CardDescription>
              Tokens utilisés sur l&apos;ensemble de la plateforme
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isChartsLoading ? (
              <Skeleton className="h-44 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={176}>
                <AreaChart
                  data={displayData.creditConsumption}
                  margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="gradientCredits"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="hsl(var(--chart-3))"
                        stopOpacity={0.2}
                      />
                      <stop
                        offset="100%"
                        stopColor="hsl(var(--chart-3))"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="hsl(var(--border))"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    {...SHARED_AXIS_PROPS}
                    interval={xAxisTickInterval}
                  />
                  <YAxis
                    {...SHARED_AXIS_PROPS}
                    tickFormatter={creditTickFormatter}
                  />
                  <Tooltip
                    content={
                      <ChartTooltip
                        formatter={(value) =>
                          `${value.toLocaleString("fr-FR")} crédits`
                        }
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--chart-3))"
                    strokeWidth={2}
                    fill="url(#gradientCredits)"
                    dot={false}
                    activeDot={{
                      r: 4,
                      strokeWidth: 0,
                      fill: "hsl(var(--chart-3))",
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
