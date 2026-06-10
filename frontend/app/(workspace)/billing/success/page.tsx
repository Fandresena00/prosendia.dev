/**
 * @file app/(workspace)/billing/success/page.tsx
 *
 * FIX — Cannot update a component (Router) while rendering BillingSuccessPage
 * ────────────────────────────────────────────────────────────────────────────
 * Problème : router.push() était appelé DANS le callback setCountdown(),
 * ce qui constituait un setState (setCountdown) imbriqué dans un autre setState
 * (Router). React interdit cela.
 *
 * Fix : séparer le countdown et la navigation en deux useEffect distincts.
 *   - useEffect 1 : gère le countdown (setInterval)
 *   - useEffect 2 : surveille countdown === 0 et appelle router.push()
 *
 * Cette approche est idiomatique React et ne provoque pas d'erreur de rendu.
 */

"use client";

import { Button } from "@/components/ui/button";
import { billingService } from "@/features/billing/services/billing.service";
import { CheckCircle, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function BillingSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ref = searchParams.get("ref");

  const [countdown, setCountdown] = useState(5);
  const [planName, setPlanName] = useState<string | null>(null);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Charger le statut mis à jour après paiement
  useEffect(() => {
    let attempts = 0;
    const MAX_ATTEMPTS = 6;

    const poll = async () => {
      attempts++;
      try {
        const status = await billingService.getCreditStatus();
        // Vérifier que le plan a bien changé (pas encore FREE)
        if (status.plan !== "FREE" || attempts >= MAX_ATTEMPTS) {
          setPlanName(status.planName);
          setCreditBalance(status.creditBalance);
          setIsLoading(false);
          return;
        }
        // Si encore FREE, repolling car webhook peut prendre quelques secondes
        if (attempts < MAX_ATTEMPTS) {
          setTimeout(poll, 2000);
        } else {
          setPlanName(status.planName);
          setCreditBalance(status.creditBalance);
          setIsLoading(false);
        }
      } catch {
        setIsLoading(false);
      }
    };

    void poll();
  }, []);

  // FIX — Countdown séparé sans navigation dedans
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // FIX — Navigation dans son propre useEffect, déclenché quand countdown atteint 0
  useEffect(() => {
    if (countdown === 0) {
      router.push("/billing");
    }
  }, [countdown, router]);

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

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Activation de votre abonnement…
            </div>
          ) : (
            <>
              {planName && (
                <p className="text-sm text-muted-foreground">
                  Votre abonnement{" "}
                  <strong className="text-foreground">{planName}</strong> est
                  maintenant actif.
                </p>
              )}
              {creditBalance !== null && creditBalance > 0 && (
                <p className="text-sm font-medium text-primary">
                  {creditBalance.toLocaleString("fr-FR")} crédits IA disponibles
                </p>
              )}
            </>
          )}

          {ref && (
            <p className="text-xs text-muted-foreground/60 font-mono">
              Réf. {ref}
            </p>
          )}
        </div>

        {/* Countdown */}
        {countdown > 0 && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Redirection dans {countdown}s…
          </div>
        )}

        {/* CTA */}
        <Button className="w-full" onClick={() => router.push("/billing")}>
          Voir mon abonnement
        </Button>
      </div>
    </div>
  );
}
