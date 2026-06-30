"use client";

// app/(workspace)/dashboard/page.tsx — émeraude + auto-refresh 30s

import { useCallback, useEffect, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import {
  adminDashboardApi,
  type AdminDashboardStats,
  type AdminDashboardCharts,
  type ChartPeriod,
} from "@/lib/admin-api";
import { Users, TrendingUp, CreditCard, ShieldAlert, UserPlus } from "lucide-react";

function PeriodBtn({ value, active, onClick }: { value: ChartPeriod; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`rounded px-2.5 py-1 text-[11px] font-medium transition-all ${
        active ? "bg-emerald-500/10 text-emerald-500" : "text-muted-foreground/50 hover:text-foreground"
      }`}>
      {value === "7d" ? "7 jours" : value === "30d" ? "30 jours" : "90 jours"}
    </button>
  );
}

function KpiCard({ label, value, icon: Icon, accent = false, sub }: {
  label: string; value: React.ReactNode; icon: React.ElementType; accent?: boolean; sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-border/80">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/40">{label}</span>
        <div className={`flex h-6 w-6 items-center justify-center rounded-md ${
          accent ? "bg-emerald-500/10 text-emerald-500" : "bg-white/5 text-muted-foreground/30"
        }`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <p className="font-mono text-[22px] font-semibold tracking-tight">{value}</p>
      {sub && <p className="mt-1 text-[11px] text-muted-foreground/40">{sub}</p>}
    </div>
  );
}

function ChartCard({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-4">
        <p className="text-[12px] font-semibold">{title}</p>
        {sub && <p className="mt-0.5 text-[10px] text-muted-foreground/40">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

function ChartTip({ active, payload, label, fmt }: {
  active?: boolean; payload?: { value: number }[]; label?: string; fmt?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border/50 bg-popover px-2.5 py-2 shadow-xl text-xs">
      <p className="mb-1 text-muted-foreground/60">{label}</p>
      <p className="font-mono font-semibold">{fmt ? fmt(payload[0].value) : payload[0].value}</p>
    </div>
  );
}

const PLAN_COLORS: Record<string, string> = {
  FREE: "oklch(0.52 0.015 265)", STARTER: "oklch(0.65 0.18 200)",
  PRO: "oklch(0.62 0.22 280)", CUSTOM: "oklch(0.75 0.16 55)",
};
const PLAN_LABELS: Record<string, string> = { FREE: "Gratuit", STARTER: "Starter", PRO: "Pro", CUSTOM: "Custom" };

export default function DashboardPage() {
  const [stats,   setStats]   = useState<AdminDashboardStats | null>(null);
  const [charts,  setCharts]  = useState<AdminDashboardCharts | null>(null);
  const [period,  setPeriod]  = useState<ChartPeriod>("30d");
  const [loadS,   setLoadS]   = useState(true);
  const [loadC,   setLoadC]   = useState(true);

  const loadStats  = useCallback(() => {
    let c = false;
    adminDashboardApi.getStats().then((d) => { if (!c) { setStats(d); setLoadS(false); } });
    return () => { c = true; };
  }, []);

  const loadCharts = useCallback(() => {
    let c = false;
    setLoadC(true);
    adminDashboardApi.getCharts(period).then((d) => { if (!c) { setCharts(d); setLoadC(false); } });
    return () => { c = true; };
  }, [period]);

  useEffect(() => loadStats(),  [loadStats]);
  useEffect(() => loadCharts(), [loadCharts]);

  useEffect(() => {
    const id = setInterval(() => { loadStats(); loadCharts(); }, 30_000);
    return () => clearInterval(id);
  }, [loadStats, loadCharts]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-0.5 text-[12px] text-muted-foreground/40">Vue globale · Actualisation 30s</p>
        </div>
        <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card/50 p-1">
          {(["7d", "30d", "90d"] as ChartPeriod[]).map((p) => (
            <PeriodBtn key={p} value={p} active={period === p} onClick={() => setPeriod(p)} />
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {loadS ? Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <Skeleton className="mb-3 h-3 w-20 bg-white/5" />
            <Skeleton className="h-7 w-16 bg-white/5" />
          </div>
        )) : stats ? (
          <>
            <KpiCard label="Utilisateurs"       value={stats.totalUsers.toLocaleString("fr-FR")}          icon={Users}      accent />
            <KpiCard label="Abonnements actifs" value={stats.activeSubscriptions.toLocaleString("fr-FR")} icon={CreditCard} />
            <KpiCard label="Nouveaux auj."      value={stats.newUsersToday}                               icon={UserPlus}   accent={stats.newUsersToday > 0} />
            <KpiCard label="Suspendus"          value={stats.suspendedUsers}                              icon={ShieldAlert} />
            <KpiCard label="Revenus totaux"     value={stats.totalRevenue.toLocaleString("fr-FR")}        icon={TrendingUp}  sub="Ariary" />
          </>
        ) : null}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Nouveaux utilisateurs" sub="Inscriptions par jour">
          {loadC ? <Skeleton className="h-44 w-full rounded bg-white/5" /> : (
            <ResponsiveContainer width="100%" height={176}>
              <AreaChart data={charts?.newUsers ?? []}>
                <defs>
                  <linearGradient id="geu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="oklch(0.70 0.18 162)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="oklch(0.70 0.18 162)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))", opacity: 0.4 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))", opacity: 0.4 }} axisLine={false} tickLine={false} width={24} />
                <RechartsTooltip content={<ChartTip />} cursor={{ stroke: "hsl(var(--border))" }} />
                <Area type="monotone" dataKey="value" stroke="oklch(0.70 0.18 162)" strokeWidth={1.5} fill="url(#geu)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Revenus" sub="Paiements réussis (Ar)">
          {loadC ? <Skeleton className="h-44 w-full rounded bg-white/5" /> : (
            <ResponsiveContainer width="100%" height={176}>
              <AreaChart data={charts?.revenue ?? []}>
                <defs>
                  <linearGradient id="ger" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))", opacity: 0.4 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))", opacity: 0.4 }} axisLine={false} tickLine={false} width={38} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                <RechartsTooltip content={<ChartTip fmt={(v) => `${v.toLocaleString("fr-FR")} Ar`} />} cursor={{ stroke: "hsl(var(--border))" }} />
                <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={1.5} fill="url(#ger)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard title="Consommation crédits" sub="Débits IA agrégés">
            {loadC ? <Skeleton className="h-44 w-full rounded bg-white/5" /> : (
              <ResponsiveContainer width="100%" height={176}>
                <BarChart data={charts?.creditConsumption ?? []} barSize={period === "90d" ? 3 : 7}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))", opacity: 0.4 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))", opacity: 0.4 }} axisLine={false} tickLine={false} width={32} />
                  <RechartsTooltip content={<ChartTip />} cursor={{ fill: "hsl(var(--border))", opacity: 0.3 }} />
                  <Bar dataKey="value" fill="oklch(0.70 0.18 162)" radius={[2, 2, 0, 0]} fillOpacity={0.7} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        <ChartCard title="Plans" sub="Distribution actuelle">
          {loadC ? <Skeleton className="h-44 w-full rounded bg-white/5" /> : (
            <div className="space-y-3 pt-1">
              {(charts?.planDistribution ?? []).map((item) => (
                <div key={item.plan}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-medium">{PLAN_LABELS[item.plan] ?? item.plan}</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-mono text-[12px] font-semibold">{item.count.toLocaleString("fr-FR")}</span>
                      <span className="font-mono text-[10px] text-muted-foreground/40">{item.pct}%</span>
                    </div>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-white/5">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${item.pct}%`, backgroundColor: PLAN_COLORS[item.plan] ?? "oklch(0.70 0.18 162)" }} />
                  </div>
                </div>
              ))}
              {(charts?.planDistribution ?? []).length === 0 && (
                <p className="py-8 text-center text-xs text-muted-foreground/30">Aucune donnée</p>
              )}
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
