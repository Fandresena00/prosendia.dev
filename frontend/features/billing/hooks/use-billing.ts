/**
 * @file features/billing/hooks/use-billing.ts
 *
 * CHANGE: customPlan (singulier, nullable) remplace customTemplates (tableau).
 * L'user voit au plus 1 plan custom — le sien si l'admin en a créé un.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { billingService } from "../services/billing.service";
import { billingCustomPlansService } from "../services/billing-custom-plans.service";
import type {
  CreditLedgerEntry, CreditStatus, PaymentHistoryItem, Plan,
} from "../types/billing.types";
import type { CustomPlanTemplate } from "../components/packs-card";

interface UseBillingReturn {
  plans:          Plan[];
  history:        PaymentHistoryItem[];
  ledger:         CreditLedgerEntry[];
  creditStatus:   CreditStatus | null;
  currentPlan:    Plan | null;
  /** Config custom de CET user — null si l'admin n'en a pas créé */
  customPlan:     CustomPlanTemplate | null;
  isLoading:      boolean;
  error:          string | null;
  refetchStatus:  () => Promise<void>;
  refetchAll:     () => Promise<void>;
  formatCurrency: (n: number) => string;
}

export function useBilling(): UseBillingReturn {
  const [plans,        setPlans]        = useState<Plan[]>([]);
  const [history,      setHistory]      = useState<PaymentHistoryItem[]>([]);
  const [ledger,       setLedger]       = useState<CreditLedgerEntry[]>([]);
  const [creditStatus, setCreditStatus] = useState<CreditStatus | null>(null);
  const [customPlan,   setCustomPlan]   = useState<CustomPlanTemplate | null>(null);
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
      const [plansData, statusData, historyData, ledgerData, customPlanData] =
        await Promise.all([
          billingService.getPlans(),
          billingService.getCreditStatus(),
          billingService.getPaymentHistory(1, 20),
          billingService.getCreditHistory(1, 20),
          billingCustomPlansService.getMyCustomPlan(), // null si aucune config
        ]);
      setPlans(plansData);
      setCreditStatus(statusData);
      setHistory(historyData.data);
      setLedger(ledgerData.data);
      setCustomPlan(customPlanData);
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
    } catch { /* silent */ }
  }, []);

  const refetchAll = useCallback(async () => {
    try {
      const [plansData, statusData, historyData, ledgerData, customPlanData] =
        await Promise.all([
          billingService.getPlans(),
          billingService.getCreditStatus(),
          billingService.getPaymentHistory(1, 20),
          billingService.getCreditHistory(1, 20),
          billingCustomPlansService.getMyCustomPlan(),
        ]);
      setPlans(plansData);
      setCreditStatus(statusData);
      setHistory(historyData.data);
      setLedger(ledgerData.data);
      setCustomPlan(customPlanData);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const currentPlan = plans.find((p) => p.id === creditStatus?.plan) ?? null;

  return {
    plans, history, ledger, creditStatus, currentPlan,
    customPlan, isLoading, error, refetchStatus, refetchAll, formatCurrency,
  };
}
