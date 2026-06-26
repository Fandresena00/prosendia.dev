/**
 * @file features/billing/components/credit-status-banner.tsx
 *
 * FIXES (batch courant)
 * ─────────────────────
 * 1. Wording "offre" au lieu d'"abonnement" dans tous les textes.
 * 2. Affichage du nouveau solde immédiatement après changement d'offre :
 *    le composant reçoit les données fraîches via props (pas de state local).
 *    C'est le hook use-billing.ts qui pilote le refetch via refetchStatus().
 */

"use client";

import { Badge } from "@/components/ui/badge";
import { IconCreditCard } from "@tabler/icons-react";
import { AlertTriangle, XCircle, Zap } from "lucide-react";
import type { CreditStatus } from "../types/billing.types";

interface CreditStatusBannerProps {
  status: CreditStatus;
  formatCurrency: (n: number) => string;
}

export function CreditStatusBanner({ status }: CreditStatusBannerProps) {
  const {
    planName,
    creditBalance,
    creditsGranted,
    remainingPercent,
    isLow,
    isCritical,
    isDepleted,
    daysRemaining,
    periodEnd,
  } = status;

  const barColor = isDepleted
    ? "bg-red-500"
    : isCritical
      ? "bg-orange-500"
      : isLow
        ? "bg-amber-500"
        : "bg-primary";

  const bannerBg = isDepleted
    ? "border-red-500/25 bg-red-500/5"
    : isCritical
      ? "border-orange-500/25 bg-orange-500/5"
      : isLow
        ? "border-amber-500/25 bg-amber-500/5"
        : "border-primary/25 bg-primary/5";

  const formattedPeriodEnd = periodEnd
    ? new Date(periodEnd).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <div className="space-y-3">
      {/* Bannière principale */}
      <div
        className={`flex flex-col sm:flex-row sm:items-center gap-4 rounded-md border ${bannerBg} px-5 py-4`}
      >
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div
            className={`h-10 w-10 rounded-md flex items-center justify-center shrink-0 ${
              isDepleted
                ? "bg-red-500/15"
                : isCritical
                  ? "bg-orange-500/15"
                  : "bg-primary/15"
            }`}
          >
            <IconCreditCard
              className={`h-5 w-5 ${
                isDepleted
                  ? "text-red-500"
                  : isCritical
                    ? "text-orange-500"
                    : "text-primary"
              }`}
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold">Offre {planName}</p>
              {isDepleted ? (
                <Badge className="h-5 text-xs bg-red-500/15 text-red-700 border-red-500/25 hover:bg-red-500/15">
                  Épuisé
                </Badge>
              ) : (
                <Badge className="h-5 text-xs gap-1 bg-emerald-500/15 text-emerald-700 border-emerald-500/25 hover:bg-emerald-500/15">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Actif
                </Badge>
              )}
            </div>

            <p className="text-xs text-muted-foreground mt-0.5">
              {creditsGranted !== null
                ? `${creditBalance.toLocaleString("fr-FR")} / ${creditsGranted.toLocaleString("fr-FR")} crédits restants`
                : `${creditBalance.toLocaleString("fr-FR")} crédits`}
              {formattedPeriodEnd && (
                <span className="ml-2 text-muted-foreground/60">
                  · Expire le {formattedPeriodEnd}
                  {daysRemaining !== null && daysRemaining <= 7 && (
                    <span className="ml-1 text-amber-600 font-medium">
                      ({daysRemaining}j)
                    </span>
                  )}
                </span>
              )}
              {!formattedPeriodEnd && (
                <span className="ml-2 text-muted-foreground/60">
                  · Renouvellement manuel
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Barre de progression */}
        {creditsGranted !== null && (
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-32 h-1.5 rounded-full bg-border/60">
              <div
                className={`h-1.5 rounded-full transition-all ${barColor}`}
                style={{
                  width: `${Math.max(0, Math.min(100, remainingPercent))}%`,
                }}
              />
            </div>
            <span
              className={`text-xs font-medium tabular-nums ${
                isDepleted
                  ? "text-red-600"
                  : isCritical
                    ? "text-orange-600"
                    : isLow
                      ? "text-amber-600"
                      : "text-muted-foreground"
              }`}
            >
              {Math.round(remainingPercent)}%
            </span>
          </div>
        )}
      </div>

      {/* Alertes */}
      {isDepleted && (
        <div className="flex items-start gap-3 rounded-md border border-red-500/25 bg-red-500/5 px-4 py-3">
          <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-700">
              Crédits épuisés — IA désactivée
            </p>
            <p className="text-xs text-red-600/80 mt-0.5">
              Votre compte a été repassé sur l&apos;offre Gratuite. Souscrivez
              à une offre pour réactiver les réponses IA.
            </p>
          </div>
        </div>
      )}

      {!isDepleted && isCritical && (
        <div className="flex items-start gap-3 rounded-md border border-orange-500/25 bg-orange-500/5 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-orange-700">
              Moins de {creditBalance.toLocaleString("fr-FR")} crédits restants
            </p>
            <p className="text-xs text-orange-600/80 mt-0.5">
              L&apos;IA s&apos;arrêtera automatiquement à 0 crédit. Renouvelez
              votre offre pour continuer.
            </p>
          </div>
        </div>
      )}

      {!isDepleted && !isCritical && isLow && (
        <div className="flex items-start gap-3 rounded-md border border-amber-500/25 bg-amber-500/5 px-4 py-3">
          <Zap className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-700">
              Crédits presque épuisés
            </p>
            <p className="text-xs text-amber-600/80 mt-0.5">
              Il vous reste {Math.round(remainingPercent)}% de vos crédits IA.
              Pensez à renouveler votre offre.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
