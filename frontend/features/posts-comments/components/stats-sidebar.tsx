"use client";
/**
 * @file features/posts-comments/components/stats-sidebar.tsx
 *
 * Useful stats for managed posts: reply breakdown, engagement, DM coverage.
 * Receives pre-aggregated commentStats from the hook so numbers are accurate.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { IconMessage } from "@tabler/icons-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import { BAR_CHART_CONFIG } from "../data/posts-comments.data";
import type { ApiPost } from "../types/posts-comments.types";

export interface CommentStats {
  total:         number;
  repliedByAi:   number;
  repliedByHuman: number;
  unanswered:    number;
  withPrivateDm: number;
}

interface StatsSidebarProps {
  posts:        ApiPost[];
  commentStats: CommentStats;
}

export function StatsSidebar({ posts, commentStats }: StatsSidebarProps) {
  const totalPosts     = posts.length;
  const totalReactions = posts.reduce((s, p) => s + p.reactionsCount, 0);
  const totalShares    = posts.reduce((s, p) => s + p.sharesCount, 0);

  const replyRate = commentStats.total > 0
    ? Math.round(((commentStats.repliedByAi + commentStats.repliedByHuman) / commentStats.total) * 100)
    : 0;

  if (!posts.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-3 py-12">
        <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center">
          <IconMessage className="h-5 w-5 text-muted-foreground/40" />
        </div>
        <p className="text-sm text-muted-foreground">Aucun post géré</p>
        <p className="text-xs text-muted-foreground/60">Ajoutez un post pour voir les statistiques.</p>
      </div>
    );
  }

  // KPIs
  const kpis = [
    {
      label: "Posts gérés",
      value: totalPosts,
      color: "text-foreground",
      bg:    "bg-secondary/40 border-border/40",
    },
    {
      label: "Commentaires",
      value: commentStats.total,
      color: "text-primary",
      bg:    "bg-primary/5 border-primary/15",
    },
    {
      label: "Sans réponse",
      value: commentStats.unanswered,
      color: commentStats.unanswered > 0 ? "text-rose-600" : "text-emerald-600",
      bg:    commentStats.unanswered > 0
        ? "bg-rose-500/5 border-rose-500/15"
        : "bg-emerald-500/5 border-emerald-500/15",
    },
    {
      label: "Taux de réponse",
      value: `${replyRate}%`,
      color: replyRate >= 80 ? "text-emerald-600" : replyRate >= 50 ? "text-amber-600" : "text-rose-600",
      bg:    "bg-secondary/40 border-border/40",
    },
    {
      label: "Répondus par IA",
      value: commentStats.repliedByAi,
      color: "text-violet-600",
      bg:    "bg-violet-500/5 border-violet-500/15",
    },
    {
      label: "Répondus manuellement",
      value: commentStats.repliedByHuman,
      color: "text-emerald-600",
      bg:    "bg-emerald-500/5 border-emerald-500/15",
    },
    {
      label: "DM privés envoyés",
      value: commentStats.withPrivateDm,
      color: "text-[#1877F2]",
      bg:    "bg-[#1877F2]/5 border-[#1877F2]/20",
    },
    {
      label: "Réactions totales",
      value: totalReactions,
      color: "text-amber-600",
      bg:    "bg-amber-500/5 border-amber-500/15",
    },
  ];

  // Pie: reply breakdown
  const pieData = [
    { name: "IA",          value: commentStats.repliedByAi,    color: "oklch(0.55 0.22 290)" },
    { name: "Humain",      value: commentStats.repliedByHuman,  color: "oklch(0.55 0.18 155)" },
    { name: "Sans réponse", value: commentStats.unanswered,     color: "oklch(0.65 0.18 25)" },
  ].filter((d) => d.value > 0);

  // Bar: comments per post (up to 8)
  const barData = posts.slice(0, 8).map((p) => ({
    name:     (p.message ?? "Post").slice(0, 14),
    comments: p._count?.comments ?? p.commentsCount,
  }));

  return (
    <div className="p-5 space-y-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        Statistiques
      </p>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-2">
        {kpis.map((k) => (
          <div key={k.label} className={`rounded-xl border px-3 py-2.5 ${k.bg}`}>
            <p className={`text-xl font-bold tabular-nums ${k.color}`}>{k.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Unanswered alert */}
      {commentStats.unanswered > 0 && (
        <div className="rounded-xl border border-rose-500/25 bg-rose-500/5 px-3.5 py-2.5">
          <p className="text-xs font-semibold text-rose-600">
            {commentStats.unanswered} commentaire{commentStats.unanswered > 1 ? "s" : ""} sans réponse
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Activez l'IA sur les posts concernés pour les traiter automatiquement.
          </p>
        </div>
      )}

      {/* Pie: reply breakdown */}
      {commentStats.total > 0 && pieData.length > 0 && (
        <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Répartition des réponses
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-center justify-center gap-4">
              <div className="relative">
                <ChartContainer config={BAR_CHART_CONFIG} className="h-[100px] w-[100px]">
                  <PieChart>
                    <Pie
                      data={pieData} cx="50%" cy="50%"
                      innerRadius={32} outerRadius={46}
                      dataKey="value" strokeWidth={0}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ChartContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-lg font-bold">{replyRate}%</span>
                  <span className="text-[9px] text-muted-foreground">répondus</span>
                </div>
              </div>
              <div className="space-y-1.5">
                {pieData.map((d) => (
                  <div key={d.name} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="h-2 w-2 rounded-sm shrink-0" style={{ background: d.color }} />
                    <span>{d.name}</span>
                    <span className="ml-auto font-semibold tabular-nums text-foreground">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bar: comments per post */}
      {barData.length > 0 && (
        <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Commentaires par post
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-4">
            <ChartContainer config={BAR_CHART_CONFIG} className="h-[120px] w-full">
              <BarChart data={barData} layout="vertical" margin={{ left: 0, right: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.05} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 8, fill: "currentColor", opacity: 0.4 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 8, fill: "currentColor", opacity: 0.5 }} axisLine={false} tickLine={false} width={52} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="comments" fill="oklch(0.52 0.24 256 / 60%)" radius={[0, 2, 2, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Engagement summary */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-border/40 bg-secondary/30 px-3 py-2.5">
          <p className="text-lg font-bold tabular-nums text-amber-600">{totalReactions}</p>
          <p className="text-[10px] text-muted-foreground">Réactions</p>
        </div>
        <div className="rounded-xl border border-border/40 bg-secondary/30 px-3 py-2.5">
          <p className="text-lg font-bold tabular-nums text-foreground">{totalShares}</p>
          <p className="text-[10px] text-muted-foreground">Partages</p>
        </div>
      </div>
    </div>
  );
}
