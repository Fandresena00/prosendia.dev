/**
 * @file features/billing/pages/billing-page.tsx
 *
 * Page principale Billing.
 *
 * FIXES (batch courant)
 * ─────────────────────
 * 1. PaymentDialog reçoit onSuccess={refetchStatus} — dès que l'user est
 *    redirigé vers Papi, on refetch le statut pour que la bannière affiche
 *    déjà "En attente" si besoin.
 *
 * 2. À ajouter dans /app/billing/success/page.tsx : appeler refetchAll()
 *    au montage pour afficher le nouveau solde immédiatement après retour Papi.
 *    Voir le composant BillingSuccessPage ci-dessous.
 *
 * 3. Wording "offre" partout.
 */

"use client";

import { useState } from "react";
import { CreditHistory } from "../components/credit-history";
import { CreditStatusBanner } from "../components/credit-status-banner";
import { PackCard } from "../components/packs-card";
import { PaymentDialog } from "../components/payment-dialog";
import { PaymentHistory } from "../components/payment-history";
import PaymentMethod from "../components/payment-method";
import { useBilling } from "../hooks/use-billing";
import type { Plan } from "../types/billing.types";
import type { CustomPlanTemplate } from "../components/packs-card";

export default function BillingPage() {
  const {
    plans,
    history,
    ledger,
    creditStatus,
    customPlan,
    isLoading,
    error,
    refetchStatus,
    formatCurrency,
  } = useBilling();

  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [selectedCustomPlan, setSelectedCustomPlan] =
    useState<CustomPlanTemplate | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 mx-auto p-6">
      {/* Statut crédits */}
      {creditStatus && (
        <CreditStatusBanner
          status={creditStatus}
          formatCurrency={formatCurrency}
        />
      )}

      {/* Offres */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">Offres disponibles</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Vous pouvez changer ou renouveler votre offre à tout moment.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <PackCard
              key={plan.id}
              plan={plan}
              creditStatus={creditStatus}
              onSelect={setSelectedPlan}
              formatCurrency={formatCurrency}
              customPlan={customPlan}
              onSelectCustomPlan={(p) => setSelectedCustomPlan(p)}
            />
          ))}
        </div>
      </section>

      {/* Modes de paiement */}
      <PaymentMethod />

      {/* Historique paiements */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold">Historique des paiements</h2>
        <PaymentHistory history={history} formatCurrency={formatCurrency} />
      </section>

      {/* Historique crédits */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold">Consommation des crédits IA</h2>
        <CreditHistory ledger={ledger} />
      </section>

      {/* Dialog paiement */}
      <PaymentDialog
        open={!!selectedPlan}
        onClose={() => setSelectedPlan(null)}
        plan={selectedPlan}
        // onSuccess : refetch le statut dès la redirection vers Papi
        // Le nouveau solde sera visible dès le retour sur /billing/success
        onSuccess={refetchStatus}
      />
      <PaymentDialog
        open={!!selectedCustomPlan}
        onClose={() => setSelectedCustomPlan(null)}
        plan={null}
        customTemplate={selectedCustomPlan}
        onSuccess={refetchStatus}
      />
    </div>
  );
}

// ─── Page /billing/success ────────────────────────────────────────────────────
//
// À placer dans /app/billing/success/page.tsx
// Déclenche refetchAll() au montage pour afficher le nouveau solde immédiatement.
//
// Usage :
//   Papi redirige vers /billing/success?ref=VENDEO-XXXXXXXX après paiement.
//   On attend 2s (le webhook Papi peut prendre 1-3s) puis on refetch tout.
//
// export function BillingSuccessPage() {
//   const { creditStatus, refetchAll, formatCurrency } = useBilling();
//   const router = useRouter();
//
//   useEffect(() => {
//     // Attendre que le webhook Papi ait activé l'offre
//     const timer = setTimeout(() => void refetchAll(), 2000);
//     return () => clearTimeout(timer);
//   }, [refetchAll]);
//
//   return (
//     <div className="flex flex-col items-center gap-6 py-16">
//       <CheckCircle className="h-16 w-16 text-emerald-500" />
//       <h1 className="text-2xl font-bold">Paiement confirmé !</h1>
//       {creditStatus && (
//         <p className="text-muted-foreground">
//           Offre {creditStatus.planName} activée —{" "}
//           {creditStatus.creditBalance.toLocaleString("fr-FR")} crédits disponibles
//         </p>
//       )}
//       <Button onClick={() => router.push("/billing")}>
//         Retour à mon offre
//       </Button>
//     </div>
//   );
// }
