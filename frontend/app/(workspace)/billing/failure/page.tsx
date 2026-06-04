/**
 * @file app/(workspace)/billing/failure/page.tsx
 *
 * Page de retour après échec de paiement Papi.
 * Papi redirige vers : {frontendUrl}/billing/failure?ref=VENDEO-XXXXXXXX
 */

"use client";

import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

export default function BillingFailurePage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const ref          = searchParams.get("ref");

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-5">
      <div className="max-w-sm w-full space-y-6 text-center">
        {/* Icône échec */}
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-full bg-red-500/10 flex items-center justify-center">
            <XCircle className="h-10 w-10 text-red-500" />
          </div>
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h1 className="text-xl font-bold">Paiement non abouti</h1>
          <p className="text-sm text-muted-foreground">
            Le paiement n'a pas pu être finalisé. Aucun montant n'a été débité.
          </p>
          {ref && (
            <p className="text-xs text-muted-foreground/60 font-mono">
              Réf. {ref}
            </p>
          )}
        </div>

        {/* Causes possibles */}
        <div className="rounded-md border border-border/40 bg-secondary/20 px-4 py-3 text-left space-y-1">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Causes possibles :</p>
          {[
            "Solde insuffisant sur votre compte",
            "Lien de paiement expiré (valable 60 min)",
            "Annulation volontaire du paiement",
            "Problème temporaire avec l'opérateur",
          ].map((cause) => (
            <p key={cause} className="text-xs text-muted-foreground flex items-start gap-1.5">
              <span className="mt-0.5 shrink-0">•</span>
              {cause}
            </p>
          ))}
        </div>

        {/* CTA */}
        <div className="flex flex-col gap-2">
          <Button onClick={() => router.push("/billing")}>
            Réessayer le paiement
          </Button>
          <Button variant="ghost" size="sm" onClick={() => router.push("/inbox")}>
            Retour à l'application
          </Button>
        </div>
      </div>
    </div>
  );
}
