"use client";

/**
 * @file features/inbox/components/InboxInfoPanel.tsx
 * Info icon top-right: on hover/click shows features description and limits.
 */

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { IconInfoCircle } from "@tabler/icons-react";
import { Bot, Clock, Database, MessageSquare, Zap } from "lucide-react";

interface InboxInfoPanelProps {
  sseStatus: "connecting" | "connected" | "error";
}

export function InboxInfoPanel({ sseStatus }: InboxInfoPanelProps) {
  const sseLabel =
    sseStatus === "connected"
      ? "Temps réel connecté"
      : sseStatus === "error"
        ? "Temps réel déconnecté"
        : "Connexion en cours…";

  const sseDot =
    sseStatus === "connected"
      ? "bg-emerald-500"
      : sseStatus === "error"
        ? "bg-destructive"
        : "bg-amber-500 animate-pulse";

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button
          className="flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-border/40 bg-card/60 hover:bg-accent/60 transition-colors text-muted-foreground hover:text-foreground"
          aria-label="Informations sur l'inbox"
        >
          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${sseDot}`} />
          <IconInfoCircle className="h-3.5 w-3.5" />
        </button>
      </HoverCardTrigger>

      <HoverCardContent
        side="bottom"
        align="end"
        className="w-80 p-0 overflow-hidden"
        sideOffset={8}
      >
        {/* Header */}
        <div className="px-4 py-3 bg-primary/5 border-b border-border/40">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold">VendeoAI Inbox</p>
            <div className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${sseDot}`} />
              <span className="text-[10px] text-muted-foreground">{sseLabel}</span>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="px-4 py-3 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Fonctionnalités actives
          </p>

          <div className="space-y-2">
            <InfoRow
              icon={<Zap className="h-3.5 w-3.5 text-primary" />}
              label="Temps réel"
              desc="Messages reçus instantanément via webhook Facebook + SSE"
            />
            <InfoRow
              icon={<Bot className="h-3.5 w-3.5 text-violet-500" />}
              label="IA auto-réponse"
              desc="Répond automatiquement aux clients en mode IA (toutes les 5 min de filet de sécurité)"
            />
            <InfoRow
              icon={<Clock className="h-3.5 w-3.5 text-amber-500" />}
              label="Alerte 24h"
              desc="L'IA détecte et re-tente de répondre aux messages sans réponse depuis 24h"
            />
            <InfoRow
              icon={<MessageSquare className="h-3.5 w-3.5 text-emerald-500" />}
              label="Sync à l'ouverture"
              desc="Chaque conversation est synchronisée depuis Facebook à chaque ouverture"
            />
            <InfoRow
              icon={<Database className="h-3.5 w-3.5 text-rose-500" />}
              label="Cache intelligent"
              desc="Les messages sont aussi récupérés via polling toutes les 8s pour la fiabilité"
            />
          </div>
        </div>

        {/* Limits */}
        <div className="px-4 py-3 border-t border-border/40 bg-secondary/20">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Limites du cache DB
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            <LimitChip label="Conversations" value="40 par page" />
            <LimitChip label="Messages" value="50 par conv." />
            <LimitChip label="Reset DB" value="Chaque dimanche" />
            <LimitChip label="Sync auto" value="Toutes les 5 min" />
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
            Les données supprimées du cache restent accessibles depuis Facebook.
            Elles sont rechargées automatiquement lors du scroll vers le haut.
          </p>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function InfoRow({
  icon,
  label,
  desc,
}: {
  icon:  React.ReactNode;
  label: string;
  desc:  string;
}) {
  return (
    <div className="flex gap-2.5">
      <div className="shrink-0 mt-0.5">{icon}</div>
      <div>
        <p className="text-xs font-medium leading-none mb-0.5">{label}</p>
        <p className="text-[11px] text-muted-foreground leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function LimitChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background border border-border/40 px-2.5 py-1.5">
      <p className="text-[9px] text-muted-foreground uppercase tracking-wide leading-none mb-0.5">
        {label}
      </p>
      <p className="text-[11px] font-semibold leading-none">{value}</p>
    </div>
  );
}
