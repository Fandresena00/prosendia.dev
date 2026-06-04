/**
 * @file app/(workspace)/billing/success/page.tsx
 *
 * Page de retour après paiement Papi réussi.
 * Papi redirige vers : {frontendUrl}/billing/success?ref=VENDEO-XXXXXXXX
 *
 * Cette page :
 *   1. Affiche un message de succès
 *   2. Recharge le statut des crédits
 *   3. Redirige vers /billing après 4 secondes
 */

"use client";

import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { billingService } from "@/features/billing/services/billing.service";

export default function BillingSuccessPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const ref          = searchParams.get("ref");

  const [countdown,    setCountdown]    = useState(4);
  const [planName,     setPlanName]     = useState<string | null>(null);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);

  useEffect(() => {
    // Charger le nouveau statut de crédits
    billingService.getCreditStatus().then((status) => {
      setPlanName(status.planName);
      setCreditBalance(status.creditBalance);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          router.push("/billing");
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-5">
      <div className="max-w-sm w-full space-y-6 text-center">
        {/* Icône succès */}
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle className="h-10 w-10 text-emerald-500" />
          </div>
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h1 className="text-xl font-bold">Paiement confirmé !</h1>
          {planName && (
            <p className="text-sm text-muted-foreground">
              Votre abonnement <strong className="text-foreground">{planName}</strong> est maintenant actif.
            </p>
          )}
          {creditBalance !== null && (
            <p className="text-sm font-medium text-primary">
              {creditBalance.toLocaleString("fr-FR")} crédits IA disponibles
            </p>
          )}
          {ref && (
            <p className="text-xs text-muted-foreground/60 font-mono">
              Réf. {ref}
            </p>
          )}
        </div>

        {/* Countdown */}
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Redirection dans {countdown}s…
        </div>

        {/* CTA */}
        <Button
          className="w-full"
          onClick={() => router.push("/billing")}
        >
          Voir mon abonnement
        </Button>
      </div>
    </div>
  );
}
