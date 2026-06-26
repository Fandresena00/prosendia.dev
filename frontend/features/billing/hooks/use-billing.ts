/**
 * @file features/billing/hooks/use-billing.ts
 *
 * FIXES (batch courant)
 * ─────────────────────
 * 1. refetchStatus() est maintenant exporté et appelable depuis la page
 *    /billing/success pour afficher le nouveau solde immédiatement après
 *    retour de Papi (avant même le prochain polling).
 *
 * 2. Ajout de refetchAll() pour forcer un rechargement complet (plans + status
 *    + history + ledger) utile sur la page success après confirmation du paiement.
 *
 * 3. Aucun polling actif dans ce hook — le refetch est déclenché explicitement
 *    par la page parent (billing-page ou billing-success-page) pour éviter
 *    les appels inutiles.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { billingService } from "../services/billing.service";
import type {
  CreditLedgerEntry,
  CreditStatus,
  PaymentHistoryItem,
  Plan,
} from "../types/billing.types";

interface UseBillingReturn {
  plans:         Plan[];
  history:       PaymentHistoryItem[];
  ledger:        CreditLedgerEntry[];
  creditStatus:  CreditStatus | null;
  currentPlan:   Plan | null;
  isLoading:     boolean;
  error:         string | null;
  refetchStatus: () => Promise<void>;
  refetchAll:    () => Promise<void>;
  formatCurrency: (n: number) => string;
}

export function useBilling(): UseBillingReturn {
  const [plans,        setPlans]        = useState<Plan[]>([]);
  const [history,      setHistory]      = useState<PaymentHistoryItem[]>([]);
  const [ledger,       setLedger]       = useState<CreditLedgerEntry[]>([]);
  const [creditStatus, setCreditStatus] = useState<CreditStatus | null>(null);
  const [isLoading,    setIsLoading]    = useState(true);
  const [error,        setError]        = useState<string | null>(null);

  const formatCurrency = useCallback(
    (n: number) => (n === 0 ? "Gratuit" : n.toLocaleString("fr-MG") + " Ar"),
    [],
  );

  const fetchAll = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [plansData, statusData, historyData, ledgerData] =
        await Promise.all([
          billingService.getPlans(),
          billingService.getCreditStatus(),
          billingService.getPaymentHistory(1, 20),
          billingService.getCreditHistory(1, 20),
        ]);

      setPlans(plansData);
      setCreditStatus(statusData);
      setHistory(historyData.data);
      setLedger(ledgerData.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Rafraîchit uniquement le statut des crédits (solde, plan, pourcentage).
   * Appelé :
   *   - Juste avant la redirection Papi (via onBeforeRedirect dans PaymentDialog)
   *   - Sur la page /billing/success au retour de Papi
   *   - Après tout événement qui modifie le solde
   *
   * Ne touche pas plans/history/ledger pour rester léger.
   */
  const refetchStatus = useCallback(async () => {
    try {
      const statusData = await billingService.getCreditStatus();
      setCreditStatus(statusData);
    } catch {
      // silent — ne pas afficher d'erreur sur un refresh silencieux
    }
  }, []);

  /**
   * Rechargement complet — plans + status + history + ledger.
   * Appelé depuis la page /billing/success après confirmation du webhook Papi.
   */
  const refetchAll = useCallback(async () => {
    try {
      const [plansData, statusData, historyData, ledgerData] =
        await Promise.all([
          billingService.getPlans(),
          billingService.getCreditStatus(),
          billingService.getPaymentHistory(1, 20),
          billingService.getCreditHistory(1, 20),
        ]);

      setPlans(plansData);
      setCreditStatus(statusData);
      setHistory(historyData.data);
      setLedger(ledgerData.data);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const currentPlan = plans.find((p) => p.id === creditStatus?.plan) ?? null;

  return {
    plans,
    history,
    ledger,
    creditStatus,
    currentPlan,
    isLoading,
    error,
    refetchStatus,
    refetchAll,
    formatCurrency,
  };
}
