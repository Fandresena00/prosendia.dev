/**
 * @file features/billing/hooks/use-billing.ts
 *
 * Hook principal billing — charge les données depuis le backend.
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
  plans:          Plan[];
  history:        PaymentHistoryItem[];
  ledger:         CreditLedgerEntry[];
  creditStatus:   CreditStatus | null;
  currentPlan:    Plan | null;
  isLoading:      boolean;
  error:          string | null;
  refetchStatus:  () => Promise<void>;
  formatCurrency: (n: number) => string;
}

export function useBilling(): UseBillingReturn {
  const [plans,        setPlans]        = useState<Plan[]>([]);
  const [history,      setHistory]      = useState<PaymentHistoryItem[]>([]);
  const [ledger,       setLedger]       = useState<CreditLedgerEntry[]>([]);
  const [creditStatus, setCreditStatus] = useState<CreditStatus | null>(null);
  const [isLoading,    setIsLoading]    = useState(true);
  const [error,        setError]        = useState<string | null>(null);

  const formatCurrency = (n: number) =>
    n === 0 ? "Gratuit" : n.toLocaleString("fr-MG") + " Ar";

  const fetchAll = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [plansData, statusData, historyData, ledgerData] = await Promise.all([
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
    formatCurrency,
  };
}
