/**
 * @file features/dashboard/components/weekly-chart.tsx
 *
 * Graphiques hebdomadaires connectés aux données réelles du backend.
 * Même style que le dashboard actuel (shadcn ChartContainer).
 */
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyActivity } from "../types/dashboard.types";

interface WeeklyChartProps {
  data: DailyActivity[];
}

const chartConfig = {
  messages:     { label: "Messages reçus",  color: "var(--color-chart-1)" },
  aiReplies:    { label: "Réponses IA",      color: "var(--color-chart-2)" },
  humanReplies: { label: "Humain",           color: "var(--color-chart-3)" },
  comments:     { label: "Commentaires",     color: "var(--color-chart-4)" },
};

export function WeeklyChart({ data }: WeeklyChartProps) {
  const totalMessages  = data.reduce((s, d) => s + d.messages, 0);
  const totalAi        = data.reduce((s, d) => s + d.aiReplies, 0);
  const totalComments  = data.reduce((s, d) => s + d.comments, 0);
  const aiRate         = totalMessages > 0 ? Math.round((totalAi / totalMessages) * 100) : 0;

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {/* Bar chart — volume de messages */}
      <Card className="lg:col-span-2 border-border/40 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3 pt-4 px-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-[12px] font-semibold">
                Volume de messages — 7 jours
              </CardTitle>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {totalMessages.toLocaleString("fr-FR")} messages ·{" "}
                {totalAi.toLocaleString("fr-FR")} réponses IA ·{" "}
                {totalComments.toLocaleString("fr-FR")} commentaires
              </p>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-chart-1)]" />
                Total
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-chart-2)]" />
                IA
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <ChartContainer config={chartConfig} className="h-48 w-full">
            <BarChart data={data} barGap={4}>
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
                dataKey="aiReplies"
                fill="var(--color-aiReplies)"
                radius={[3, 3, 0, 0]}
                maxBarSize={22}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Area chart — taux IA */}
      <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3 pt-4 px-4">
          <div>
            <CardTitle className="text-[12px] font-semibold">
              Taux IA — tendance
            </CardTitle>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-2xl font-black tabular-nums">{aiRate}</span>
              <span className="text-base font-semibold text-muted-foreground">%</span>
              <span className="text-[10px] text-muted-foreground ml-1">cette semaine</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <ChartContainer config={chartConfig} className="h-48 w-full">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="aiGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--color-chart-1)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0} />
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
                dataKey="aiReplies"
                stroke="var(--color-chart-1)"
                strokeWidth={1.5}
                fill="url(#aiGradient)"
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
