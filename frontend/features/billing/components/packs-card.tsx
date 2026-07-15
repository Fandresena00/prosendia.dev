/**
 * @file features/billing/components/packs-card.tsx
 *
 * CHANGE: customPlan est maintenant singulier (1 config par user).
 * - Si customPlan existe et isPurchasable → carte achetable
 * - Si customPlan existe et !isPurchasable → carte "Attribution en cours" (non achetable)
 * - Si customPlan est null → "Nous contacter"
 */

"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconCheck } from "@tabler/icons-react";
import { ArrowRight, CheckCircle, Crown, Lock, Mail, RefreshCw } from "lucide-react";
import type { CreditStatus, Plan } from "../types/billing.types";

export interface CustomPlanTemplate {
  id: string;
  userId?: string;
  name: string;
  description: string | null;
  priceAriary: number;
  durationDays: number;
  credits: number;
  maxPages: number;
  maxManagedPosts: number;
  maxReferenceImages: number;
  isActive?: boolean;
  isPurchasable?: boolean;
}

interface PackCardProps {
  plan: Plan;
  creditStatus: CreditStatus | null;
  onSelect: (plan: Plan) => void;
  formatCurrency: (n: number) => string;
  /** Config custom propre à CET user (null = affiche "Contacter") */
  customPlan?: CustomPlanTemplate | null;
  onSelectCustomPlan?: (plan: CustomPlanTemplate) => void;
}

export function PackCard({
  plan, creditStatus, onSelect, formatCurrency, customPlan, onSelectCustomPlan,
}: PackCardProps) {
  const isCurrent = creditStatus?.plan === plan.id;

  // ── Plan CUSTOM ───────────────────────────────────────────────────────────

  if (plan.id === "CUSTOM") {
    // Cas 1 : config custom existe et est achetable
    if (customPlan && customPlan.isPurchasable !== false) {
      const isCurrentCustom = creditStatus?.plan === "CUSTOM";
      return (
        <div className="relative rounded-md border border-yellow-500/20 bg-yellow-500/3 flex flex-col transition-all hover:border-yellow-500/30">
          <div className="absolute -top-2.5 left-4">
            <Badge className="text-[10px] px-2 h-5 gap-1 bg-yellow-500/15 text-yellow-600 border-yellow-500/20">
              <Crown className="h-2.5 w-2.5" />
              Offre personnalisée
            </Badge>
          </div>

          <div className="p-5 pt-6 flex-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
              {customPlan.name}
            </p>
            {customPlan.description && (
              <p className="text-xs text-muted-foreground mb-3 leading-snug">{customPlan.description}</p>
            )}
            <div className="flex items-end gap-1 mb-2">
              {customPlan.priceAriary === 0 ? (
                <span className="text-2xl font-extrabold">Gratuit</span>
              ) : (
                <>
                  <span className="text-2xl font-extrabold">{formatCurrency(customPlan.priceAriary)}</span>
                  <span className="text-xs text-muted-foreground mb-1">/ {customPlan.durationDays}j</span>
                </>
              )}
            </div>
            <p className="text-xs text-yellow-600 font-medium mb-3">
              {customPlan.credits.toLocaleString("fr-FR")} crédits IA
            </p>
            <ul className="space-y-1.5 mb-4">
              {[
                `${customPlan.maxPages} page${customPlan.maxPages > 1 ? "s" : ""} Facebook`,
                `${customPlan.maxManagedPosts} posts gérés simultanément`,
                `${customPlan.maxReferenceImages} images de référence`,
                "Réponses IA Messenger & Commentaires",
                "Personnalisation IA avancée",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <span className="h-4 w-4 rounded-full bg-yellow-500/15 flex items-center justify-center shrink-0 mt-0.5">
                    <IconCheck className="h-2.5 w-2.5 text-yellow-600" />
                  </span>
                  {f}
                </li>
              ))}
            </ul>
          </div>

          <div className="p-5 pt-0 space-y-2">
            <Button className="w-full h-9 text-sm gap-2" variant="outline"
              onClick={() => onSelectCustomPlan?.(customPlan)}>
              {isCurrentCustom
                ? <><RefreshCw className="h-4 w-4" />Renouveler cette offre</>
                : <>Choisir cette offre<ArrowRight className="h-4 w-4" /></>
              }
            </Button>
            {isCurrentCustom && (
              <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                Offre actuelle
              </div>
            )}
          </div>
        </div>
      );
    }

    // Cas 2 : config custom existe mais non achetable (attribution manuelle uniquement)
    if (customPlan && customPlan.isPurchasable === false) {
      return (
        <div className="relative rounded-md border border-yellow-500/15 bg-yellow-500/3 flex flex-col opacity-80">
          <div className="absolute -top-2.5 left-4">
            <Badge className="text-[10px] px-2 h-5 gap-1 bg-yellow-500/15 text-yellow-600 border-yellow-500/20">
              <Crown className="h-2.5 w-2.5" />
              Offre réservée
            </Badge>
          </div>
          <div className="p-5 pt-6 flex-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
              {customPlan.name}
            </p>
            {customPlan.description && (
              <p className="text-xs text-muted-foreground mb-3">{customPlan.description}</p>
            )}
            <p className="text-xs text-yellow-600 font-medium mb-2">
              {customPlan.credits.toLocaleString("fr-FR")} crédits IA · {customPlan.durationDays}j
            </p>
            <p className="text-xs text-muted-foreground/60 leading-snug">
              Cette offre vous a été réservée. Contactez-nous pour l'activer.
            </p>
          </div>
          <div className="p-5 pt-0">
            <Button className="w-full h-9 text-sm gap-2" variant="outline" disabled>
              <Lock className="h-4 w-4" />
              Activation sur demande
            </Button>
          </div>
        </div>
      );
    }

    // Cas 3 : aucune config → "Nous contacter"
    return (
      <div className="relative rounded-md border border-border/50 bg-card flex flex-col">
        <div className="p-5 flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">{plan.name}</p>
          <div className="flex items-end gap-1 mb-1">
            <span className="text-xl font-extrabold">Sur devis</span>
          </div>
          <p className="text-xs text-primary font-medium mb-3">Offre sur mesure réservée aux entreprises.</p>
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
        <div className="p-5 pt-0">
          <Button className="w-full h-9 text-sm gap-2" variant="outline"
            onClick={() => window.open("mailto:contact@prosendia.com?subject=Offre%20Custom%20prosendia", "_blank")}>
            <Mail className="h-4 w-4" />
            Nous contacter
          </Button>
        </div>
      </div>
    );
  }

  // ── Plans standards ───────────────────────────────────────────────────────

  return (
    <div className={`relative rounded-md border flex flex-col transition-all ${
      plan.popular ? "border-primary/40 bg-primary/3 shadow-sm" : "border-border/50 bg-card hover:border-border/80"
    }`}>
      {plan.popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="text-xs px-3 shadow-sm">Recommandé</Badge>
        </div>
      )}
      <div className="p-5 flex-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">{plan.name}</p>
        <div className="flex items-end gap-1 mb-1">
          {plan.priceAriary === null ? (
            <span className="text-xl font-extrabold">Sur devis</span>
          ) : plan.priceAriary === 0 ? (
            <span className="text-2xl font-extrabold">Gratuit</span>
          ) : (
            <><span className="text-2xl font-extrabold">{formatCurrency(plan.priceAriary)}</span>
            <span className="text-xs text-muted-foreground mb-1">/mois</span></>
          )}
        </div>
        {plan.credits !== null && (
          <p className="text-xs text-primary font-medium mb-3">
            {plan.credits.toLocaleString("fr-FR")} crédits IA / mois
          </p>
        )}
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
      <div className="p-5 pt-0 space-y-2">
        <Button className="w-full h-9 text-sm gap-2"
          variant={plan.popular ? "default" : "outline"}
          onClick={() => onSelect(plan)}>
          {isCurrent
            ? <><RefreshCw className="h-4 w-4" />Renouveler cette offre</>
            : <>Choisir cette offre<ArrowRight className="h-4 w-4" /></>
          }
        </Button>
        {isCurrent && (
          <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            Offre actuelle
          </div>
        )}
      </div>
    </div>
  );
}
