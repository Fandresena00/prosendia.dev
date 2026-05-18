"use client";
/**
 * @file features/posts-comments/components/stats-sidebar.tsx
 * Stats for managed posts on the active page.
 * Uses ApiPost fields: commentsCount, reactionsCount, sharesCount, postAiConfig.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { IconMessage, IconRobot } from "@tabler/icons-react";
import {
  Bar, BarChart, CartesianGrid,
  Cell, Pie, PieChart, XAxis, YAxis,
} from "recharts";
import { BAR_CHART_CONFIG } from "../data/posts-comments.data";
import type { ApiPost } from "../types/posts-comments.types";

interface StatsSidebarProps {
  posts: ApiPost[];
}

export function StatsSidebar({ posts }: StatsSidebarProps) {
  const totalPosts       = posts.length;
  const totalComments    = posts.reduce((s, p) => s + (p._count?.comments ?? p.commentsCount), 0);
  const totalReactions   = posts.reduce((s, p) => s + p.reactionsCount, 0);
  const totalShares      = posts.reduce((s, p) => s + p.sharesCount, 0);
  const aiEnabledCount   = posts.filter((p) => p.postAiConfig?.autoReply).length;
  const privateDmCount   = posts.filter((p) => p.postAiConfig?.privateReplyEnabled).length;
  const aiRate           = totalPosts > 0 ? Math.round((aiEnabledCount / totalPosts) * 100) : 0;
  const avgComments      = totalPosts > 0 ? Math.round(totalComments / totalPosts) : 0;

  const pieData = [
    { name: "IA activée",    value: aiEnabledCount,           color: "oklch(0.52 0.24 256)" },
    { name: "IA désactivée", value: totalPosts - aiEnabledCount, color: "oklch(0.75 0.03 255 / 25%)" },
  ].filter((d) => d.value > 0);

  // Bar chart: up to 8 posts
  const barData = posts
    .slice(0, 8)
    .map((p) => ({
      name:     (p.message ?? "Post").slice(0, 12),
      comments: p._count?.comments ?? p.commentsCount,
    }));

  if (!posts.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-3 py-12">
        <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center">
          <IconMessage className="h-5 w-5 text-muted-foreground/40" />
        </div>
        <p className="text-sm text-muted-foreground">Aucun post ajouté pour cette page</p>
        <p className="text-xs text-muted-foreground/60">
          Cliquez sur « Ajouter un post » pour commencer.
        </p>
      </div>
    );
  }

  const kpis = [
    {
      label: "Posts gérés",
      value: totalPosts,
      color: "text-foreground",
      bg:    "bg-secondary/40 border-border/40",
    },
    {
      label: "Commentaires",
      value: totalComments,
      color: "text-primary",
      bg:    "bg-primary/5 border-primary/15",
    },
    {
      label: "IA activée",
      value: `${aiEnabledCount}/${totalPosts}`,
      color: "text-emerald-600",
      bg:    "bg-emerald-500/5 border-emerald-500/15",
    },
    {
      label: "Réactions",
      value: totalReactions,
      color: "text-violet-600",
      bg:    "bg-violet-500/5 border-violet-500/15",
    },
    {
      label: "Partages",
      value: totalShares,
      color: "text-amber-600",
      bg:    "bg-amber-500/5 border-amber-500/15",
    },
    {
      label: "Moy. comm.",
      value: avgComments,
      color: "text-foreground",
      bg:    "bg-secondary/40 border-border/40",
    },
  ];

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
            <p className="text-[10px] text-muted-foreground mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Private DM info */}
      {privateDmCount > 0 && (
        <div className="rounded-xl border border-[#1877F2]/20 bg-[#1877F2]/5 px-3.5 py-2.5">
          <p className="text-xs font-semibold text-[#1877F2]">{privateDmCount} post{privateDmCount > 1 ? "s" : ""} avec DM auto</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Envoi de messages privés en réponse aux commentaires
          </p>
        </div>
      )}

      {/* Pie: AI enabled ratio */}
      {totalPosts > 0 && (
        <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <IconRobot className="h-3 w-3" />
              Taux d'activation IA
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-center justify-center gap-4">
              <div className="relative">
                <ChartContainer config={BAR_CHART_CONFIG} className="h-[100px] w-[100px]">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%" cy="50%"
                      innerRadius={32} outerRadius={46}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ChartContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-lg font-bold text-emerald-600">{aiRate}%</span>
                </div>
              </div>
              <div className="space-y-1.5">
                {pieData.map((d) => (
                  <div key={d.name} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="h-2 w-2 rounded-sm shrink-0" style={{ background: d.color }} />
                    {d.name}
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
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="currentColor"
                  strokeOpacity={0.05}
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 8, fill: "currentColor", opacity: 0.4 }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  type="category" dataKey="name"
                  tick={{ fontSize: 8, fill: "currentColor", opacity: 0.5 }}
                  axisLine={false} tickLine={false}
                  width={52}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="comments"
                  fill="oklch(0.52 0.24 256 / 60%)"
                  radius={[0, 2, 2, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
