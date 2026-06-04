/**
 * @file features/billing/components/credit-history.tsx
 *
 * Tableau détaillé de la consommation des crédits IA.
 * Montre chaque appel IA avec tokens, modèle et crédits déduits.
 */

"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap } from "lucide-react";
import type { CreditLedgerEntry } from "../types/billing.types";
import { CREDIT_TYPE_LABELS } from "../types/billing.types";

const TYPE_COLORS: Record<string, string> = {
  SUBSCRIPTION_GRANT:  "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  AI_REPLY_CONSUME:    "bg-blue-500/10 text-blue-700 border-blue-500/20",
  COMMENT_AI_CONSUME:  "bg-violet-500/10 text-violet-700 border-violet-500/20",
  ADMIN_ADJUST:        "bg-amber-500/10 text-amber-700 border-amber-500/20",
};

interface CreditHistoryProps {
  ledger: CreditLedgerEntry[];
}

export function CreditHistory({ ledger }: CreditHistoryProps) {
  if (ledger.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <Zap className="h-10 w-10 text-muted-foreground/25" />
          <p className="text-sm font-medium text-muted-foreground">
            Aucune consommation de crédits pour l'instant
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/40">
              {["Date", "Type", "Crédits", "Tokens", "Modèle", "Détail"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ledger.map((entry, i) => {
              const isPositive = entry.amount > 0;
              const label = CREDIT_TYPE_LABELS[entry.type] ?? entry.type;
              const badgeClass = TYPE_COLORS[entry.type] ?? TYPE_COLORS.ADMIN_ADJUST;

              return (
                <tr
                  key={entry.id}
                  className={`hover:bg-accent/50 transition-colors ${
                    i < ledger.length - 1 ? "border-b border-border/30" : ""
                  }`}
                >
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                    {new Date(entry.createdAt).toLocaleDateString("fr-FR", {
                      day: "numeric", month: "short", year: "numeric",
                    })}{" "}
                    <span className="text-xs text-muted-foreground/60">
                      {new Date(entry.createdAt).toLocaleTimeString("fr-FR", {
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={`text-xs h-5 ${badgeClass}`}>{label}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-semibold tabular-nums ${
                      isPositive ? "text-emerald-600" : "text-foreground"
                    }`}>
                      {isPositive ? "+" : ""}{entry.amount.toLocaleString("fr-FR")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground tabular-nums">
                    {entry.tokensUsed != null
                      ? entry.tokensUsed.toLocaleString("fr-FR")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono max-w-[140px] truncate">
                    {entry.modelId
                      ? entry.modelId.split("/").pop()?.replace(/:free$/, "") ?? entry.modelId
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-[180px] truncate">
                    {entry.description ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
