/**
 * @file features/billing/pages/billing-page.tsx
 *
 * Page Facturation — toutes les données viennent du backend via useBilling().
 * Le frontend n'a aucune connaissance des valeurs de crédits, prix ou limites.
 */

"use client";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, RefreshCw, Zap } from "lucide-react";
import { useState } from "react";
import { CreditHistory } from "../components/credit-history";
import { CreditStatusBanner } from "../components/credit-status-banner";
import { PackCard } from "../components/packs-card";
import { PaymentDialog } from "../components/payment-dialog";
import { PaymentHistory } from "../components/payment-history";
import PaymentMethod from "../components/payment-method";
import { useBilling } from "../hooks/use-billing";
import type { Plan } from "../types/billing.types";

export default function BillingPage() {
  const {
    plans,
    history,
    ledger,
    creditStatus,
    isLoading,
    error,
    refetchStatus,
    formatCurrency,
  } = useBilling();

  const [payDialog, setPayDialog] = useState<{
    open: boolean;
    plan: Plan | null;
  }>({
    open: false,
    plan: null,
  });

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ─── Error ────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="p-5 flex flex-col items-center gap-4 h-64 justify-center">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Réessayer
        </Button>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-8">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Facturation</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gérez votre abonnement et votre consommation IA
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground gap-1.5 shrink-0"
          onClick={refetchStatus}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Actualiser
        </Button>
      </div>

      {/* ── Statut crédits — données du backend uniquement ─────────────────── */}
      {creditStatus && (
        <CreditStatusBanner
          status={creditStatus}
          formatCurrency={formatCurrency}
        />
      )}

      {/* ── Explication des crédits IA ──────────────────────────────────────── */}
      <div className="rounded-md border border-border/40 bg-secondary/20 px-5 py-4 space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">
            Comment fonctionnent les crédits IA ?
          </h2>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Les crédits représentent votre utilisation de l&apos;intelligence
          artificielle VendeoAI. Chaque réponse IA (Messenger ou commentaire)
          consomme des crédits proportionnellement aux tokens utilisés.{" "}
          <strong className="text-foreground">1 crédit = 100 tokens IA.</strong>
        </p>
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { label: "Réponse Messenger", value: "~2–8 crédits" },
            { label: "Réponse commentaire", value: "~1–3 crédits" },
            { label: "Résumé conversation", value: "~1–5 crédits" },
          ].map((item) => (
            <div
              key={item.label}
              className="flex justify-between items-center rounded border border-border/30 px-3 py-2"
            >
              <span className="text-xs text-muted-foreground">
                {item.label}
              </span>
              <span className="text-xs font-semibold text-primary">
                {item.value}
              </span>
            </div>
          ))}
        </div>

        {/* Solde actuel en tokens — calculé depuis la balance retournée par le backend */}
        {creditStatus && (
          <p className="text-xs text-muted-foreground">
            Solde actuel :{" "}
            <strong className="text-foreground">
              {creditStatus.creditBalance.toLocaleString("fr-FR")} crédits
            </strong>{" "}
            ≈{" "}
            <strong className="text-foreground">
              {(creditStatus.creditBalance * 100).toLocaleString("fr-FR")}{" "}
              tokens IA
            </strong>
          </p>
        )}
      </div>

      {/* ── Plans — rendus depuis les données du backend ────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold mb-4">Choisir un plan</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <PackCard
              key={plan.id}
              plan={plan}
              creditStatus={creditStatus}
              formatCurrency={formatCurrency}
              onSelect={(p) => setPayDialog({ open: true, plan: p })}
            />
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          ⚠️ Aucune recharge automatique — chaque abonnement est valable 30
          jours et se renouvelle manuellement.
        </p>
      </div>

      {/* ── Modes de paiement ──────────────────────────────────────────────── */}
      <PaymentMethod />

      {/* ── Historiques ────────────────────────────────────────────────────── */}
      <div>
        <Tabs defaultValue="payments">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Historique</h2>
            <TabsList className="h-8">
              <TabsTrigger value="payments" className="text-xs h-7 px-3">
                Paiements
              </TabsTrigger>
              <TabsTrigger value="credits" className="text-xs h-7 px-3">
                Crédits IA
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="payments" className="mt-0">
            <PaymentHistory history={history} formatCurrency={formatCurrency} />
          </TabsContent>

          <TabsContent value="credits" className="mt-0">
            <CreditHistory ledger={ledger} />
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Dialog paiement ────────────────────────────────────────────────── */}
      <PaymentDialog
        open={payDialog.open}
        onClose={() => {
          setPayDialog({ open: false, plan: null });
          // Recharger le statut après fermeture (le paiement peut avoir été initié)
          void refetchStatus();
        }}
        plan={payDialog.plan}
      />
    </div>
  );
}
