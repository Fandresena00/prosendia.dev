/**
 * @file features/dashboard/components/weekly-chart.tsx
 *
 * Graphiques hebdomadaires — redesign avec shadcn ChartContainer.
 * Esthétique inspirée Linear/Vercel : axes épurés, gradients subtils,
 * typographie tabulaire.
 */
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyActivity } from "../types/dashboard.types";

// ─── Chart config ─────────────────────────────────────────────────────────────

const chartConfig = {
  messages: { label: "Messages", color: "var(--color-chart-1)" },
  aiReplies: { label: "Réponses IA", color: "var(--color-chart-2)" },
  humanReplies: { label: "Manuel", color: "var(--color-chart-3)" },
  comments: { label: "Commentaires", color: "var(--color-chart-4)" },
} satisfies Record<string, { label: string; color: string }>;

// ─── Stat pill ────────────────────────────────────────────────────────────────

interface StatPillProps {
  label: string;
  value: string | number;
  color: string;
  className?: string;
}

function StatPill({ label, value, color, className }: StatPillProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span
        className="h-2 w-2 rounded-full shrink-0"
        style={{ background: color }}
      />
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="text-[11px] font-bold tabular-nums ml-auto">
        {value}
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface WeeklyChartProps {
  data: DailyActivity[];
}

export function WeeklyChart({ data }: WeeklyChartProps) {
  const totalMessages = data.reduce((s, d) => s + d.messages, 0);
  const totalAi = data.reduce((s, d) => s + d.aiReplies, 0);
  const totalHuman = data.reduce((s, d) => s + d.humanReplies, 0);
  const totalComments = data.reduce((s, d) => s + d.comments, 0);
  const aiRate =
    totalMessages > 0 ? Math.round((totalAi / totalMessages) * 100) : 0;

  // Find peak day for the reference line (safe empty-array guard)
  const peakDay =
    data.length > 0
      ? data.reduce((max, d) => (d.messages > max.messages ? d : max), data[0])
      : null;

  const aiColor =
    aiRate >= 80
      ? "var(--color-chart-2)"
      : aiRate >= 50
        ? "var(--color-chart-1)"
        : "var(--color-chart-3)";

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {/* ── Bar chart — volume ─────────────────────────────────────────────── */}
      <Card className="lg:col-span-2 border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden relative">
        <div
          className="absolute top-0 left-0 right-0 h-px pointer-events-none"
          style={{
            background:
              "linear-gradient(90deg, transparent, var(--color-chart-1), var(--color-chart-2), transparent)",
          }}
        />
        <CardHeader className="pb-2 pt-4 px-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                Volume · 7 jours
              </CardTitle>
              <p className="text-2xl font-black tabular-nums mt-1 tracking-tight">
                {totalMessages.toLocaleString("fr-FR")}
                <span className="text-sm font-medium text-muted-foreground ml-1.5">
                  messages
                </span>
              </p>
            </div>
            <div className="flex flex-col gap-1.5 min-w-[140px]">
              <StatPill
                label="IA"
                value={totalAi.toLocaleString("fr-FR")}
                color="var(--color-chart-2)"
              />
              <StatPill
                label="Manuel"
                value={totalHuman.toLocaleString("fr-FR")}
                color="var(--color-chart-3)"
              />
              <StatPill
                label="Commentaires"
                value={totalComments.toLocaleString("fr-FR")}
                color="var(--color-chart-4)"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-2 pb-4 pt-1">
          <ChartContainer config={chartConfig} className="h-52 w-full">
            <BarChart data={data} barGap={2} barCategoryGap="28%">
              <defs>
                <linearGradient id="gradMessages" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--color-chart-1)"
                    stopOpacity={0.95}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--color-chart-1)"
                    stopOpacity={0.55}
                  />
                </linearGradient>
                <linearGradient id="gradAi" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--color-chart-2)"
                    stopOpacity={0.9}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--color-chart-2)"
                    stopOpacity={0.5}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="2 4"
                stroke="currentColor"
                strokeOpacity={0.04}
                vertical={false}
              />
              {peakDay && (
                <ReferenceLine
                  x={peakDay.day}
                  stroke="var(--color-chart-1)"
                  strokeOpacity={0.15}
                  strokeDasharray="3 3"
                />
              )}
              <XAxis
                dataKey="day"
                tick={{
                  fontSize: 10,
                  fill: "currentColor",
                  opacity: 0.4,
                  fontWeight: 500,
                }}
                axisLine={false}
                tickLine={false}
                dy={6}
              />
              <YAxis
                tick={{ fontSize: 9, fill: "currentColor", opacity: 0.35 }}
                axisLine={false}
                tickLine={false}
                width={28}
                tickFormatter={(v: number) =>
                  v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
                }
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    className="text-[11px]"
                    indicator="dot"
                  />
                }
                cursor={{ fill: "currentColor", fillOpacity: 0.03 }}
              />
              <Bar
                dataKey="messages"
                fill="url(#gradMessages)"
                radius={[3, 3, 0, 0]}
                maxBarSize={20}
              />
              <Bar
                dataKey="aiReplies"
                fill="url(#gradAi)"
                radius={[3, 3, 0, 0]}
                maxBarSize={20}
              />
              <ChartLegend
                content={<ChartLegendContent className="text-[10px] pt-2" />}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* ── Area chart — taux IA ───────────────────────────────────────────── */}
      <Card className="border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden relative">
        <div
          className="absolute top-0 left-0 right-0 h-px pointer-events-none"
          style={{
            background:
              "linear-gradient(90deg, transparent, var(--color-chart-2), transparent)",
          }}
        />
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Taux IA · tendance
          </CardTitle>
          <div className="mt-2">
            <div className="flex items-end gap-1 leading-none">
              <span
                className="text-4xl font-black tabular-nums tracking-tight"
                style={{ color: aiColor }}
              >
                {aiRate}
              </span>
              <span className="text-lg font-semibold text-muted-foreground mb-0.5">
                %
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {totalAi.toLocaleString("fr-FR")} réponses IA cette semaine
            </p>
          </div>
          <div className="mt-3 h-1 w-full rounded-full bg-border/30">
            <div
              className="h-1 rounded-full transition-all duration-700"
              style={{
                width: `${aiRate}%`,
                background: aiColor,
                boxShadow: `0 0 6px ${aiColor}`,
              }}
            />
          </div>
        </CardHeader>

        <CardContent className="px-2 pb-4 pt-1">
          <ChartContainer config={chartConfig} className="h-32 w-full">
            <AreaChart
              data={data}
              margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="aiAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--color-chart-2)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="60%"
                    stopColor="var(--color-chart-2)"
                    stopOpacity={0.08}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--color-chart-2)"
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient id="humanAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--color-chart-3)"
                    stopOpacity={0.2}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--color-chart-3)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="2 4"
                stroke="currentColor"
                strokeOpacity={0.04}
                vertical={false}
              />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 9, fill: "currentColor", opacity: 0.35 }}
                axisLine={false}
                tickLine={false}
                dy={4}
              />
              <YAxis hide />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    className="text-[11px]"
                    indicator="line"
                  />
                }
                cursor={{
                  stroke: "var(--color-chart-2)",
                  strokeOpacity: 0.2,
                  strokeWidth: 1,
                }}
              />
              <Area
                type="monotone"
                dataKey="aiReplies"
                stroke="var(--color-chart-2)"
                strokeWidth={2}
                fill="url(#aiAreaGrad)"
                dot={false}
                activeDot={{
                  r: 3,
                  fill: "var(--color-chart-2)",
                  strokeWidth: 0,
                }}
              />
              <Area
                type="monotone"
                dataKey="humanReplies"
                stroke="var(--color-chart-3)"
                strokeWidth={1.5}
                fill="url(#humanAreaGrad)"
                dot={false}
                activeDot={{
                  r: 2.5,
                  fill: "var(--color-chart-3)",
                  strokeWidth: 0,
                }}
                strokeDasharray="4 2"
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
