/**
 * @file app/(workspace)/_components/sidebar-plan-card.tsx
 *
 * Barre de crédits dans la sidebar.
 * Toutes les valeurs viennent de GET /billing/status — rien de hardcodé.
 * Les flags isLow/isCritical/isDepleted sont calculés par le backend.
 */

"use client";

import { Button } from "@/components/ui/button";
import { billingService } from "@/features/billing/services/billing.service";
import type { CreditStatus } from "@/features/billing/types/billing.types";
import { cn } from "@/lib/utils";
import { AlertTriangle, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export function SidebarPlanCard() {
  const [status, setStatus] = useState<CreditStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    billingService
      .getCreditStatus()
      .then((s) => {
        setStatus(s);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  // Skeleton pendant le chargement
  if (isLoading) {
    return (
      <div className="rounded-md border border-border/30 bg-secondary/20 px-2 sm:px-3 py-2 sm:py-2.5 space-y-1.5 sm:space-y-2">
        <div className="h-1.5 sm:h-2 w-16 sm:w-20 rounded bg-border/40 animate-pulse" />
        <div className="h-1 sm:h-1.5 w-full rounded-full bg-border/30 animate-pulse" />
        <div className="h-1.5 sm:h-2 w-20 sm:w-24 rounded bg-border/30 animate-pulse" />
      </div>
    );
  }

  // Rien à afficher si l'API est indisponible
  if (!status) return null;

  const {
    planName,
    creditBalance,
    creditsGranted,
    remainingPercent,
    isLow,
    isCritical,
    isDepleted,
    plan,
  } = status;

  // Afficher le CTA si plan FREE ou crédits faibles (flags venant du backend)
  const showUpgrade = plan === "FREE" || isLow || isCritical || isDepleted;

  const barColor = isDepleted
    ? "bg-red-500"
    : isCritical
      ? "bg-orange-500"
      : isLow
        ? "bg-amber-500"
        : "bg-primary";

  const ctaLabel = isDepleted
    ? "Réactiver l'IA"
    : plan === "FREE"
      ? "Passer au Pro"
      : "Renouveler";

  return (
    <div
      className={cn(
        "rounded-md border px-2 sm:px-3 py-2 sm:py-2.5 space-y-1.5 sm:space-y-2 transition-colors",
        isDepleted
          ? "border-red-500/20 bg-red-500/5"
          : isCritical
            ? "border-orange-500/20 bg-orange-500/5"
            : isLow
              ? "border-amber-500/20 bg-amber-500/5"
              : "border-border/30 bg-secondary/20",
      )}
    >
      {/* Nom du plan + icône alerte */}
      <div className="flex items-center justify-between gap-1.5 sm:gap-2">
        <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
          <Zap
            className={cn(
              "h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0",
              isDepleted
                ? "text-red-500"
                : isCritical
                  ? "text-orange-500"
                  : isLow
                    ? "text-amber-500"
                    : "text-primary",
            )}
          />
          <span className="text-[10px] sm:text-[11px] font-semibold truncate">
            {planName}
          </span>
        </div>
        {(isLow || isCritical || isDepleted) && (
          <AlertTriangle
            className={cn(
              "h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0",
              isDepleted ? "text-red-500" : "text-amber-500",
            )}
          />
        )}
      </div>

      {/* Barre de progression — remainingPercent vient du backend */}
      {creditsGranted !== null && (
        <div className="space-y-0.5 sm:space-y-1">
          <div className="h-1 sm:h-1.5 w-full rounded-full bg-border/40">
            <div
              className={cn(
                "h-1 sm:h-1.5 rounded-full transition-all",
                barColor,
              )}
              style={{
                width: `${Math.max(0, Math.min(100, remainingPercent))}%`,
              }}
            />
          </div>
          <p className="text-[9px] sm:text-[10px] text-muted-foreground tabular-nums">
            {creditBalance.toLocaleString("fr-FR")}
            {" / "}
            {creditsGranted.toLocaleString("fr-FR")} crédits
          </p>
        </div>
      )}

      {/* Bouton upgrade si nécessaire */}
      {showUpgrade && (
        <Button
          asChild
          size="sm"
          variant={isDepleted || isCritical ? "default" : "outline"}
          className="w-full h-6 sm:h-7 text-[10px] sm:text-[11px]"
        >
          <Link href="/billing">{ctaLabel}</Link>
        </Button>
      )}
    </div>
  );
}
