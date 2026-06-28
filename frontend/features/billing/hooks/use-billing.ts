/**
 * @file features/billing/hooks/use-billing.ts
 *
 * CHANGE: Ajout de customTemplates dans le state — templates custom publics
 * achetables par l'user. Fetché depuis GET /billing/custom-plans.
 *
 * Si l'endpoint n'existe pas encore (retourne []), la PackCard affiche
 * "Nous contacter" pour le plan CUSTOM.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { billingService } from "../services/billing.service";
import { billingCustomPlansService } from "../services/billing-custom-plans.service";
import type {
  CreditLedgerEntry,
  CreditStatus,
  PaymentHistoryItem,
  Plan,
} from "../types/billing.types";
import type { CustomPlanTemplate } from "../components/packs-card";

interface UseBillingReturn {
  plans:           Plan[];
  history:         PaymentHistoryItem[];
  ledger:          CreditLedgerEntry[];
  creditStatus:    CreditStatus | null;
  currentPlan:     Plan | null;
  customTemplates: CustomPlanTemplate[];
  isLoading:       boolean;
  error:           string | null;
  refetchStatus:   () => Promise<void>;
  refetchAll:      () => Promise<void>;
  formatCurrency:  (n: number) => string;
}

export function useBilling(): UseBillingReturn {
  const [plans,           setPlans]           = useState<Plan[]>([]);
  const [history,         setHistory]         = useState<PaymentHistoryItem[]>([]);
  const [ledger,          setLedger]          = useState<CreditLedgerEntry[]>([]);
  const [creditStatus,    setCreditStatus]    = useState<CreditStatus | null>(null);
  const [customTemplates, setCustomTemplates] = useState<CustomPlanTemplate[]>([]);
  const [isLoading,       setIsLoading]       = useState(true);
  const [error,           setError]           = useState<string | null>(null);

  const formatCurrency = useCallback(
    (n: number) => (n === 0 ? "Gratuit" : n.toLocaleString("fr-MG") + " Ar"),
    [],
  );

  const fetchAll = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [plansData, statusData, historyData, ledgerData, templatesData] =
        await Promise.all([
          billingService.getPlans(),
          billingService.getCreditStatus(),
          billingService.getPaymentHistory(1, 20),
          billingService.getCreditHistory(1, 20),
          billingCustomPlansService.getPublicTemplates(), // ← NOUVEAU, silencieux si 404
        ]);

      setPlans(plansData);
      setCreditStatus(statusData);
      setHistory(historyData.data);
      setLedger(ledgerData.data);
      setCustomTemplates(templatesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Rafraîchit uniquement le statut des crédits (solde, plan, pourcentage).
   */
  const refetchStatus = useCallback(async () => {
    try {
      const statusData = await billingService.getCreditStatus();
      setCreditStatus(statusData);
    } catch {
      // silent
    }
  }, []);

  /**
   * Rechargement complet — plans + status + history + ledger + templates.
   */
  const refetchAll = useCallback(async () => {
    try {
      const [plansData, statusData, historyData, ledgerData, templatesData] =
        await Promise.all([
          billingService.getPlans(),
          billingService.getCreditStatus(),
          billingService.getPaymentHistory(1, 20),
          billingService.getCreditHistory(1, 20),
          billingCustomPlansService.getPublicTemplates(),
        ]);

      setPlans(plansData);
      setCreditStatus(statusData);
      setHistory(historyData.data);
      setLedger(ledgerData.data);
      setCustomTemplates(templatesData);
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
    customTemplates,
    isLoading,
    error,
    refetchStatus,
    refetchAll,
    formatCurrency,
  };
}
