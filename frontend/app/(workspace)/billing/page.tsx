/**
 * @file app/(workspace)/billing/page.tsx
 *
 * Route Next.js vers la page de facturation.
 */

import BillingPage from "@/features/billing/pages/billing-page";

export const metadata = {
  title: "Facturation — VendeoAI",
  description: "Gérez votre abonnement et votre consommation de crédits IA.",
};

export default function Page() {
  return <BillingPage />;
}
