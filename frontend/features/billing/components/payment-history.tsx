/**
 * @file features/billing/components/payment-history.tsx
 */

"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Clock } from "lucide-react";
import type { PaymentHistoryItem } from "../types/billing.types";
import { ProviderLogo } from "./payment-logos";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  SUCCESS:  { label: "Payé",      className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
  PENDING:  { label: "En attente", className: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
  FAILED:   { label: "Échoué",    className: "bg-red-500/10 text-red-700 border-red-500/20" },
  REFUNDED: { label: "Remboursé", className: "bg-blue-500/10 text-blue-700 border-blue-500/20" },
};

const PROVIDER_LABELS: Record<string, string> = {
  MVOLA:        "MVola",
  ORANGE_MONEY: "Orange Money",
  AIRTEL_MONEY: "Airtel Money",
  MANUAL:       "Manuel",
};

interface PaymentHistoryProps {
  history:        PaymentHistoryItem[];
  formatCurrency: (n: number) => string;
}

export function PaymentHistory({ history, formatCurrency }: PaymentHistoryProps) {
  if (history.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <Clock className="h-10 w-10 text-muted-foreground/25" />
          <p className="text-sm font-medium text-muted-foreground">Aucun paiement pour l'instant</p>
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
              {["Facture", "Date", "Plan", "Méthode", "Montant", "Statut"].map((h) => (
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
            {history.map((row, i) => {
              const badge = STATUS_BADGE[row.status] ?? STATUS_BADGE.PENDING;
              return (
                <tr
                  key={row.id}
                  className={`hover:bg-accent/50 transition-colors ${
                    i < history.length - 1 ? "border-b border-border/30" : ""
                  }`}
                >
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                    {row.papiRef ?? row.id.slice(0, 8).toUpperCase()}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {new Date(row.date).toLocaleDateString("fr-FR", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">{row.plan}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ProviderLogo provider={row.provider} size={16} />
                      <span className="text-sm">{PROVIDER_LABELS[row.provider] ?? row.provider}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold">
                    {formatCurrency(row.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={`text-xs h-5 ${badge.className}`}>
                      {badge.label}
                    </Badge>
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
