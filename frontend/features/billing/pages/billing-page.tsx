/**
 * @file features/billing/billing.page.tsx
 * @description main billing page component, displaying current subscription, available plans, payment methods, and payment history.
 */

"use client";

import { Badge } from "@/components/ui/badge";
import { IconCreditCard } from "@tabler/icons-react";
import { useState } from "react";
import { PackCard } from "../components/packs-card";
import { PaymentHistory } from "../components/payement-history";
import PayementMethod from "../components/payement-method";
import { PaymentDialog } from "../components/payment-dialog";
import { useBilling } from "../hooks/use-billing";
import { Plan } from "../types/billing.types";

export default function BillingPage() {
  const { plans, history, currentPlan, formatCurrency } = useBilling();
  const [payDialog, setPayDialog] = useState<{
    open: boolean;
    plan: Plan | null;
  }>({
    open: false,
    plan: null,
  });

  return (
    <div className="p-5 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Facturation</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Gérez votre abonnement et vos paiements
        </p>
      </div>

      {/* Current plan banner */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-md border border-primary/25 bg-primary/5 px-5 py-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="h-10 w-10 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
            <IconCreditCard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold">Plan {currentPlan?.name}</p>
              <Badge className="h-5 text-xs gap-1 bg-emerald-500/15 text-emerald-700 border-emerald-500/25 hover:bg-emerald-500/15">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Actif
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              127 / 500 messages · Renouvellement manuel
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-32 h-1.5 rounded-full bg-border/60">
            <div
              className="h-1.5 rounded-full bg-primary"
              style={{ width: "25.4%" }}
            />
          </div>
          <span className="text-xs text-muted-foreground font-medium">25%</span>
        </div>
      </div>

      {/* Plans List */}
      <div>
        <h2 className="text-sm font-semibold mb-4">Choisir un plan</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {plans.map((plan) => (
            <PackCard
              key={plan.id}
              plan={plan}
              formatCurrency={formatCurrency}
              onSelect={(p) => setPayDialog({ open: true, plan: p })}
            />
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          ⚠️ Aucune recharge automatique — chaque paiement est valable 1 mois.
        </p>
      </div>

      {/* Payment methods */}
      <PayementMethod />

      {/* History */}
      <div>
        <h2 className="text-sm font-semibold mb-4">Historique des paiements</h2>
        <PaymentHistory history={history} formatCurrency={formatCurrency} />
      </div>

      <PaymentDialog
        open={payDialog.open}
        onClose={() => setPayDialog({ open: false, plan: null })}
        plan={payDialog.plan}
      />
    </div>
  );
}
