/**
 * @file features/billing/components/packs-card.tsx
 *
 * Affiche un plan tel que retourné par GET /billing/plans.
 * Aucune valeur hardcodée — tout vient des props `plan`.
 */

"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconCheck } from "@tabler/icons-react";
import { ArrowRight, CheckCircle, Mail } from "lucide-react";
import type { CreditStatus, Plan } from "../types/billing.types";

interface PackCardProps {
  plan: Plan;
  creditStatus: CreditStatus | null;
  onSelect: (plan: Plan) => void;
  formatCurrency: (n: number) => string;
}

export function PackCard({
  plan,
  creditStatus,
  onSelect,
  formatCurrency,
}: PackCardProps) {
  const isCurrent = creditStatus?.plan === plan.id;

  return (
    <div
      className={`relative rounded-md border flex flex-col transition-all ${
        plan.popular
          ? "border-primary/40 bg-primary/[0.03] shadow-sm"
          : "border-border/50 bg-card hover:border-border/80"
      }`}
    >
      {plan.popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="text-xs px-3 shadow-sm">Populaire</Badge>
        </div>
      )}

      <div className="p-5 flex-1">
        {/* Nom du plan */}
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
          {plan.name}
        </p>

        {/* Prix */}
        <div className="flex items-end gap-1 mb-1">
          {plan.priceAriary === null ? (
            <span className="text-xl font-extrabold">Sur devis</span>
          ) : plan.priceAriary === 0 ? (
            <span className="text-2xl font-extrabold">Gratuit</span>
          ) : (
            <>
              <span className="text-2xl font-extrabold">
                {formatCurrency(plan.priceAriary)}
              </span>
              <span className="text-xs text-muted-foreground mb-1">/mois</span>
            </>
          )}
        </div>

        {/* Crédits — affichés seulement si le backend les fournit */}
        {plan.credits !== null && (
          <p className="text-xs text-primary font-medium mb-3">
            {plan.credits.toLocaleString("fr-FR")} crédits IA / mois
          </p>
        )}

        {/* Features — telles que retournées par le backend */}
        <ul className="space-y-2 mb-5">
          {plan.features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm">
              <span className="h-4 w-4 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0 mt-0.5">
                <IconCheck className="h-2.5 w-2.5 text-emerald-600" />
              </span>
              {f}
            </li>
          ))}
        </ul>
      </div>

      {/* CTA */}
      <div className="p-5 pt-0">
        {isCurrent ? (
          <div className="flex items-center justify-center gap-2 rounded-md border border-border/50 bg-muted/40 py-2 text-sm text-muted-foreground">
            <CheckCircle className="h-4 w-4 text-emerald-500" />
            Plan actuel
          </div>
        ) : plan.id === "CUSTOM" ? (
          <Button
            className="w-full h-9 text-sm gap-2"
            variant="outline"
            onClick={() =>
              window.open(
                "mailto:contact@vendeoai.com?subject=Plan%20Custom%20VendeoAI",
                "_blank",
              )
            }
          >
            <Mail className="h-4 w-4" />
            Nous contacter
          </Button>
        ) : (
          <Button
            className="w-full h-9 text-sm gap-2"
            variant={plan.popular ? "default" : "outline"}
            onClick={() => onSelect(plan)}
          >
            Choisir ce plan
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
