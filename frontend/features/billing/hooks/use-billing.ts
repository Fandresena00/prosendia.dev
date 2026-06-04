/**
 * @file features/billing/hooks/use-billing.ts
 *
 * Hook principal — toutes les données viennent du backend.
 * Aucune donnée hardcodée ici.
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
  plans: Plan[];
  history: PaymentHistoryItem[];
  ledger: CreditLedgerEntry[];
  creditStatus: CreditStatus | null;
  currentPlan: Plan | null;
  isLoading: boolean;
  error: string | null;
  refetchStatus: () => Promise<void>;
  formatCurrency: (n: number) => string;
}

export function useBilling(): UseBillingReturn {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [history, setHistory] = useState<PaymentHistoryItem[]>([]);
  const [ledger, setLedger] = useState<CreditLedgerEntry[]>([]);
  const [creditStatus, setCreditStatus] = useState<CreditStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatCurrency = useCallback(
    (n: number) => (n === 0 ? "Gratuit" : n.toLocaleString("fr-MG") + " Ar"),
    [],
  );

  const fetchAll = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Tout vient du backend — aucune donnée locale
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

  const refetchStatus = useCallback(async () => {
    try {
      const statusData = await billingService.getCreditStatus();
      setCreditStatus(statusData);
    } catch {
      // silent — ne pas afficher d'erreur sur un refresh silencieux
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // Le plan courant est celui dont l'id correspond au plan de l'utilisateur
  // retourné par /billing/status — pas de matching local
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
    formatCurrency,
  };
}
