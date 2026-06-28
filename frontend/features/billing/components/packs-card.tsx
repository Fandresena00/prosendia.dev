/**
 * @file features/billing/components/packs-card.tsx
 *
 * CHANGE: La section "Custom" affiche maintenant les templates créés par l'admin
 * si disponibles. "Nous contacter" uniquement si aucun template custom n'existe.
 *
 * Logique :
 *   - Si des customTemplates sont fournis → on affiche chacun comme une carte achetable
 *   - Si customTemplates est vide/null → on affiche l'ancienne carte "Nous contacter"
 *
 * Les templates custom sont achetables via le flux Papi normal (initiatePayment).
 * L'attribution manuelle reste disponible côté admin via /admin/custom-plans.
 */

"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconCheck } from "@tabler/icons-react";
import { ArrowRight, CheckCircle, Crown, Mail, RefreshCw } from "lucide-react";
import type { CreditStatus, Plan } from "../types/billing.types";

export interface CustomPlanTemplate {
  id: string;
  name: string;
  description: string | null;
  priceAriary: number;
  durationDays: number;
  credits: number;
  maxPages: number;
  maxManagedPosts: number;
  maxReferenceImages: number;
}

interface PackCardProps {
  plan: Plan;
  creditStatus: CreditStatus | null;
  onSelect: (plan: Plan) => void;
  formatCurrency: (n: number) => string;
  /** Templates custom créés par l'admin — si fourni et non vide, on les affiche à la place de "Contacter" */
  customTemplates?: CustomPlanTemplate[];
  /** Déclenche l'achat d'un template custom (plan.id = template.id côté backend) */
  onSelectCustomTemplate?: (template: CustomPlanTemplate) => void;
}

export function PackCard({
  plan,
  creditStatus,
  onSelect,
  formatCurrency,
  customTemplates,
  onSelectCustomTemplate,
}: PackCardProps) {
  const isCurrent = creditStatus?.plan === plan.id;

  // Plan CUSTOM avec des templates → affichage spécial
  if (plan.id === "CUSTOM") {
    const hasTemplates = customTemplates && customTemplates.length > 0;

    if (hasTemplates) {
      return (
        <div className="space-y-3">
          {customTemplates!.map((template) => {
            const isCurrentTemplate = creditStatus?.plan === "CUSTOM";
            return (
              <div
                key={template.id}
                className="relative rounded-md border border-yellow-500/20 bg-yellow-500/3 flex flex-col transition-all hover:border-yellow-500/30"
              >
                {/* Badge Crown */}
                <div className="absolute -top-2.5 left-4">
                  <Badge className="text-[10px] px-2 h-5 gap-1 bg-yellow-500/15 text-yellow-600 border-yellow-500/20">
                    <Crown className="h-2.5 w-2.5" />
                    Offre custom
                  </Badge>
                </div>

                <div className="p-5 pt-6 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                    {template.name}
                  </p>
                  {template.description && (
                    <p className="text-xs text-muted-foreground mb-3 leading-snug">
                      {template.description}
                    </p>
                  )}

                  {/* Prix */}
                  <div className="flex items-end gap-1 mb-2">
                    {template.priceAriary === 0 ? (
                      <span className="text-2xl font-extrabold">Gratuit</span>
                    ) : (
                      <>
                        <span className="text-2xl font-extrabold">
                          {formatCurrency(template.priceAriary)}
                        </span>
                        <span className="text-xs text-muted-foreground mb-1">/ {template.durationDays}j</span>
                      </>
                    )}
                  </div>

                  <p className="text-xs text-yellow-600 font-medium mb-3">
                    {template.credits.toLocaleString("fr-FR")} crédits IA
                  </p>

                  {/* Features mini */}
                  <ul className="space-y-1.5 mb-4">
                    {[
                      `${template.maxPages} page${template.maxPages > 1 ? "s" : ""} Facebook`,
                      `${template.maxManagedPosts} posts gérés`,
                      `${template.maxReferenceImages} images de référence`,
                      "Réponses IA Messenger & Commentaires",
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
                  <Button
                    className="w-full h-9 text-sm gap-2"
                    variant="outline"
                    onClick={() => onSelectCustomTemplate?.(template)}
                  >
                    {isCurrentTemplate ? (
                      <><RefreshCw className="h-4 w-4" />Renouveler cette offre</>
                    ) : (
                      <>Choisir cette offre<ArrowRight className="h-4 w-4" /></>
                    )}
                  </Button>
                  {isCurrentTemplate && (
                    <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      Offre actuelle
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    // Aucun template → "Nous contacter"
    return (
      <div className="relative rounded-md border border-border/50 bg-card flex flex-col transition-all">
        <div className="p-5 flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            {plan.name}
          </p>
          <div className="flex items-end gap-1 mb-1">
            <span className="text-xl font-extrabold">Sur devis</span>
          </div>
          <p className="text-xs text-primary font-medium mb-3">
            Offre sur mesure réservée aux entreprises.
          </p>
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
          <Button
            className="w-full h-9 text-sm gap-2"
            variant="outline"
            onClick={() => window.open(
              "mailto:contact@vendeoai.com?subject=Offre%20Custom%20VendeoAI", "_blank"
            )}
          >
            <Mail className="h-4 w-4" />
            Nous contacter
          </Button>
        </div>
      </div>
    );
  }

  // ── Plans standards (FREE, STARTER, PRO) ───────────────────────────────────

  return (
    <div className={`relative rounded-md border flex flex-col transition-all ${
      plan.popular
        ? "border-primary/40 bg-primary/3 shadow-sm"
        : "border-border/50 bg-card hover:border-border/80"
    }`}>
      {plan.popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="text-xs px-3 shadow-sm">Recommandé</Badge>
        </div>
      )}

      <div className="p-5 flex-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
          {plan.name}
        </p>

        <div className="flex items-end gap-1 mb-1">
          {plan.priceAriary === null ? (
            <span className="text-xl font-extrabold">Sur devis</span>
          ) : plan.priceAriary === 0 ? (
            <span className="text-2xl font-extrabold">Gratuit</span>
          ) : (
            <>
              <span className="text-2xl font-extrabold">{formatCurrency(plan.priceAriary)}</span>
              <span className="text-xs text-muted-foreground mb-1">/mois</span>
            </>
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
        <Button
          className="w-full h-9 text-sm gap-2"
          variant={plan.popular ? "default" : "outline"}
          onClick={() => onSelect(plan)}
        >
          {isCurrent ? (
            <><RefreshCw className="h-4 w-4" />Renouveler cette offre</>
          ) : (
            <>Choisir cette offre<ArrowRight className="h-4 w-4" /></>
          )}
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
