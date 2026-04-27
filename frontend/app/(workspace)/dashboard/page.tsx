"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  IconActivity,
  IconArrowUpRight,
  IconMessageCircle,
  IconRobot,
  IconTrendingUp,
  IconUsers,
} from "@tabler/icons-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

const weeklyData = [
  { day: "Lun", messages: 45, ai: 38, human: 7 },
  { day: "Mar", messages: 72, ai: 63, human: 9 },
  { day: "Mer", messages: 58, ai: 50, human: 8 },
  { day: "Jeu", messages: 89, ai: 78, human: 11 },
  { day: "Ven", messages: 103, ai: 91, human: 12 },
  { day: "Sam", messages: 67, ai: 58, human: 9 },
  { day: "Dim", messages: 127, ai: 111, human: 16 },
];

const recentActivity = [
  {
    name: "Marie Dupont",
    msg: "Est-ce que le produit est disponible ?",
    time: "2 min",
    type: "ai",
  },
  {
    name: "Jean Martin",
    msg: "Quel est le prix de livraison ?",
    time: "5 min",
    type: "human",
  },
  {
    name: "Sophie Leroy",
    msg: "Je voudrais commander 2 unités",
    time: "12 min",
    type: "ai",
  },
  {
    name: "Pierre Durand",
    msg: "Avez-vous des réductions ?",
    time: "1h",
    type: "human",
  },
  {
    name: "Camille Bernard",
    msg: "Délai de livraison pour Paris ?",
    time: "2h",
    type: "ai",
  },
];

const chartConfig = {
  messages: { label: "Total", color: "var(--color-chart-1)" },
  ai: { label: "Réponses IA", color: "var(--color-chart-2)" },
  human: { label: "Humain", color: "var(--color-chart-3)" },
};

export default function DashboardPage() {
  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[1.4rem] font-bold tracking-tight">Dashboard</h1>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Bienvenue, Jean · Activité de votre assistant aujourd&apos;hui
          </p>
        </div>
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

      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Messages reçus",
            value: "127",
            sub: "+12% vs hier",
            icon: IconMessageCircle,
            trend: "+12%",
            color: "text-primary",
            bg: "bg-primary/10",
          },
          {
            label: "Réponses IA",
            value: "87%",
            sub: "111 messages automatisés",
            icon: IconRobot,
            trend: "111 msgs",
            color: "text-emerald-400",
            bg: "bg-emerald-500/10",
          },
          {
            label: "En attente",
            value: "3",
            sub: "Intervention humaine",
            icon: IconUsers,
            trend: "urgent",
            color: "text-amber-400",
            bg: "bg-amber-500/10",
          },
          {
            label: "Conversations actives",
            value: "24",
            sub: "En cours de traitement",
            icon: IconTrendingUp,
            trend: "+5 depuis hier",
            color: "text-violet-400",
            bg: "bg-violet-500/10",
          },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.label}
              className="border-border/40 bg-card/60 backdrop-blur-sm"
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
                      {stat.label}
                    </p>
                    <p className="text-2xl font-bold mt-2 tracking-tight">
                      {stat.value}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {stat.sub}
                    </p>
                  </div>
                  <div className={`${stat.bg} p-2 rounded-xl`}>
                    <Icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1 text-[11px]">
                  <IconArrowUpRight className="h-3 w-3 text-emerald-400" />
                  <span className="text-emerald-400 font-medium">
                    {stat.trend}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid gap-3 lg:grid-cols-3">
        {/* Bar Chart */}
        <Card className="lg:col-span-2 border-border/40 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[12px] font-semibold">
                Volume de messages — 7 jours
              </CardTitle>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-(--color-chart-1)" />
                  Total
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-(--color-chart-2)" />
                  IA
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-48 w-full">
              <BarChart data={weeklyData} barGap={4}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="currentColor"
                  strokeOpacity={0.05}
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fill: "currentColor", opacity: 0.45 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "currentColor", opacity: 0.45 }}
                  axisLine={false}
                  tickLine={false}
                  width={24}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="messages"
                  fill="var(--color-messages)"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={22}
                />
                <Bar
                  dataKey="ai"
                  fill="var(--color-ai)"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={22}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Area Chart */}
        <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-[12px] font-semibold">
              Taux IA — tendance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-48 w-full">
              <AreaChart data={weeklyData}>
                <defs>
                  <linearGradient id="aiGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--color-chart-1)"
                      stopOpacity={0.25}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-chart-1)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="currentColor"
                  strokeOpacity={0.05}
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fill: "currentColor", opacity: 0.45 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "currentColor", opacity: 0.45 }}
                  axisLine={false}
                  tickLine={false}
                  width={24}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="ai"
                  stroke="var(--color-chart-1)"
                  strokeWidth={1.5}
                  fill="url(#aiGradient)"
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[12px] font-semibold">
              Activité récente
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="text-[11px] text-muted-foreground h-6 px-2"
            >
              Voir tout →
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/30">
            {recentActivity.map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-4 px-5 py-3 hover:bg-primary/3 transition-colors"
              >
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-semibold shrink-0">
                  {item.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-medium truncate">
                    {item.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {item.msg}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                      item.type === "ai"
                        ? "bg-primary/10 text-primary border-primary/20"
                        : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                    }`}
                  >
                    {item.type === "ai" ? "IA" : "Humain"}
                  </span>
                  <span className="text-[10px] text-muted-foreground w-8 text-right">
                    {item.time}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
