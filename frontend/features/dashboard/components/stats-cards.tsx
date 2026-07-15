/**
 * @file features/dashboard/components/stats-cards.tsx
 *
 * Cartes KPI : Stats IA, Taux de réponse, Activité du jour.
 */
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  IconMessageCircle,
  IconRobot,
  IconUsers,
  IconCheck,
} from "@tabler/icons-react";
import { MessageSquare, Zap, UserCheck, AlertCircle } from "lucide-react";
import type { AiStats, ResponseRate, ActivityToday } from "../types/dashboard.types";

// ─── AI Stats card ────────────────────────────────────────────────────────────

export function AiStatsCard({ data }: { data: AiStats }) {
  const items = [
    {
      label: "Réponses IA aujourd'hui",
      value: data.repliesToday,
      icon:  IconRobot,
      color: "text-primary",
      bg:    "bg-primary/10",
    },
    {
      label: "Réponses ce mois",
      value: data.repliesThisMonth,
      icon:  Zap,
      color: "text-emerald-500",
      bg:    "bg-emerald-500/10",
    },
    {
      label: "Conversations traitées",
      value: data.conversationsHandled,
      icon:  IconMessageCircle,
      color: "text-violet-500",
      bg:    "bg-violet-500/10",
    },
    {
      label: "Commentaires traités",
      value: data.commentsHandled,
      icon:  MessageSquare,
      color: "text-amber-500",
      bg:    "bg-amber-500/10",
    },
  ];

  return (
    <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-[12px] font-semibold flex items-center gap-2">
          <IconRobot className="h-3.5 w-3.5 text-primary" />
          Statistiques IA
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="grid grid-cols-2 gap-3">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="flex items-start gap-2.5">
                <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0", item.bg)}>
                  <Icon className={cn("h-3.5 w-3.5", item.color)} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground leading-tight truncate">
                    {item.label}
                  </p>
                  <p className="text-[18px] font-bold leading-tight tabular-nums">
                    {item.value.toLocaleString("fr-FR")}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Response rate card ───────────────────────────────────────────────────────

export function ResponseRateCard({ data }: { data: ResponseRate }) {
  const bars = [
    { label: "IA",         value: data.aiRate,     color: "bg-primary",    textColor: "text-primary" },
    { label: "Manuel",     value: data.humanRate,  color: "bg-violet-500", textColor: "text-violet-500" },
  ];

  return (
    <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-[12px] font-semibold flex items-center gap-2">
          <IconCheck className="h-3.5 w-3.5 text-primary" />
          Taux de réponse
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-4">
        {/* Global rate — large */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-muted-foreground">Taux global</p>
            <p className="text-3xl font-black tabular-nums leading-none mt-1">
              {data.globalRate}
              <span className="text-lg font-semibold text-muted-foreground">%</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">Sans réponse</p>
            <p className={cn(
              "text-xl font-bold tabular-nums leading-none mt-1",
              data.unansweredCount > 0 ? "text-red-500" : "text-muted-foreground",
            )}>
              {data.unansweredCount}
            </p>
          </div>
        </div>

        {/* Breakdown bars */}
        <div className="space-y-2.5">
          {bars.map((bar) => (
            <div key={bar.label} className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-muted-foreground">{bar.label}</span>
                <span className={cn("text-[11px] font-semibold tabular-nums", bar.textColor)}>
                  {bar.value}%
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-border/40">
                <div
                  className={cn("h-1.5 rounded-full transition-all", bar.color)}
                  style={{ width: `${bar.value}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Activity today card ──────────────────────────────────────────────────────

export function ActivityTodayCard({ data }: { data: ActivityToday }) {
  const items = [
    {
      label: "Messages reçus",
      value: data.messagesReceived,
      icon:  IconMessageCircle,
      color: "text-primary",
    },
    {
      label: "Commentaires reçus",
      value: data.commentsReceived,
      icon:  MessageSquare,
      color: "text-violet-500",
    },
    {
      label: "Réponses IA",
      value: data.aiRepliesSent,
      icon:  IconRobot,
      color: "text-emerald-500",
    },
    {
      label: "Interventions humaines",
      value: data.humanInterventions,
      icon:  UserCheck,
      color: data.humanInterventions > 0 ? "text-amber-500" : "text-muted-foreground",
    },
  ];

  return (
    <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[12px] font-semibold flex items-center gap-2">
            <IconUsers className="h-3.5 w-3.5 text-primary" />
            Activité aujourd&apos;hui
          </CardTitle>
          <span className="text-[10px] text-muted-foreground">
            {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          </span>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="flex items-center gap-2.5">
                <Icon className={cn("h-4 w-4 shrink-0", item.color)} />
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground truncate">{item.label}</p>
                  <p className="text-base font-bold tabular-nums leading-tight">{item.value}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Message prosendia travaille pour toi */}
        {(data.aiRepliesSent > 0 || data.messagesReceived > 0) && (
          <div className="mt-3 pt-3 border-t border-border/30">
            <p className="text-[10px] text-muted-foreground/70 text-center italic">
              {data.aiRepliesSent > 0
                ? `prosendia a géré ${data.aiRepliesSent} message${data.aiRepliesSent > 1 ? "s" : ""} à votre place aujourd'hui`
                : "prosendia surveille vos messages en temps réel"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
