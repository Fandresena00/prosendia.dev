/**
 * @file features/billing/components/payment-history.tsx
 * @description payment history table in the billing page.
 */

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { HistoryItem } from "../types/billing.types";
import { MVolaLogo, OrangeMoneyLogo } from "./payements-logos";

export function PaymentHistory({
  history,
  formatCurrency,
}: {
  history: HistoryItem[];
  formatCurrency: (n: number) => string;
}) {
  if (history.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <Clock className="h-10 w-10 text-muted-foreground/25" />
          <div className="text-center">
            <p className="text-sm font-medium">Aucun paiement</p>
          </div>
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
              {["Facture", "Date", "Plan", "Méthode", "Montant", "Statut"].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {history.map((row, i) => (
              <tr
                key={row.id}
                className={`hover:bg-accent/50 transition-colors ${i < history.length - 1 ? "border-b border-border/30" : ""}`}
              >
                <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                  {row.id}
                </td>
                <td className="px-4 py-3 text-sm">{row.date}</td>
                <td className="px-4 py-3 text-sm font-medium">{row.plan}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {row.method.includes("MVola") ? (
                      <MVolaLogo size={16} />
                    ) : (
                      <OrangeMoneyLogo size={16} />
                    )}
                    <span className="text-sm">{row.method}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm font-semibold">
                  {formatCurrency(row.amount)}
                </td>
                <td className="px-4 py-3">
                  <Badge className="text-xs h-5 bg-emerald-500/10 text-emerald-700 border-emerald-500/20">
                    Payé
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
