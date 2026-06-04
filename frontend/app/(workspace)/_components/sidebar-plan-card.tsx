/**
 * @file app/(workspace)/_components/sidebar-plan-card.tsx
 *
 * CHANGE: Connecté au backend — affiche le solde de crédits réel.
 * Remplace l'ancienne version hardcodée.
 *
 * Affiche :
 *   - Plan actif + barre de crédits
 *   - Alerte visuelle si crédits faibles
 *   - Bouton "Mettre à niveau" si FREE ou crédits < 20%
 */

"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertTriangle, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { billingService } from "@/features/billing/services/billing.service";
import type { CreditStatus } from "@/features/billing/types/billing.types";

export function SidebarPlanCard() {
  const [status, setStatus] = useState<CreditStatus | null>(null);

  useEffect(() => {
    billingService
      .getCreditStatus()
      .then(setStatus)
      .catch(() => undefined);
  }, []);

  if (!status) {
    return (
      <div className="rounded-md border border-border/30 bg-secondary/20 px-3 py-2.5">
        <div className="h-2 w-20 rounded bg-border/40 animate-pulse mb-2" />
        <div className="h-1.5 w-full rounded-full bg-border/30 animate-pulse" />
      </div>
    );
  }

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

  const showUpgrade = plan === "FREE" || isLow || isCritical || isDepleted;

  const barColor = isDepleted
    ? "bg-red-500"
    : isCritical
    ? "bg-orange-500"
    : isLow
    ? "bg-amber-500"
    : "bg-primary";

  return (
    <div className={cn(
      "rounded-md border px-3 py-2.5 space-y-2 transition-colors",
      isDepleted
        ? "border-red-500/20 bg-red-500/5"
        : isCritical
        ? "border-orange-500/20 bg-orange-500/5"
        : isLow
        ? "border-amber-500/20 bg-amber-500/5"
        : "border-border/30 bg-secondary/20",
    )}>
      {/* Plan name + alert icon */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Zap className={cn("h-3 w-3 shrink-0", isDepleted ? "text-red-500" : isCritical ? "text-orange-500" : isLow ? "text-amber-500" : "text-primary")} />
          <span className="text-[11px] font-semibold truncate">{planName}</span>
        </div>
        {(isLow || isCritical || isDepleted) && (
          <AlertTriangle className={cn("h-3 w-3 shrink-0", isDepleted ? "text-red-500" : "text-amber-500")} />
        )}
      </div>

      {/* Barre de progression */}
      {creditsGranted && (
        <div className="space-y-1">
          <div className="h-1.5 w-full rounded-full bg-border/40">
            <div
              className={cn("h-1.5 rounded-full transition-all", barColor)}
              style={{ width: `${Math.max(0, Math.min(100, remainingPercent))}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground tabular-nums">
            {creditBalance.toLocaleString("fr-FR")} / {creditsGranted.toLocaleString("fr-FR")} crédits
          </p>
        </div>
      )}

      {/* CTA */}
      {showUpgrade && (
        <Button
          asChild
          size="sm"
          variant={isDepleted || isCritical ? "default" : "outline"}
          className="w-full h-7 text-[11px]"
        >
          <Link href="/billing">
            {isDepleted ? "Réactiver l'IA" : plan === "FREE" ? "Passer au Pro" : "Renouveler"}
          </Link>
        </Button>
      )}
    </div>
  );
}
