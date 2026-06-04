/**
 * @file features/billing/services/billing.service.ts
 *
 * Appels API vers le backend billing.
 */

import { apiClient } from "@/lib/api-client";
import type {
  CreditLedgerEntry,
  CreditStatus,
  InitiatePaymentResponse,
  PaymentHistoryItem,
  Plan,
  PaymentProvider,
} from "../types/billing.types";

interface Paginated<T> {
  data:       T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export const billingService = {
  // ─── Plans ────────────────────────────────────────────────────────────────

  getPlans(): Promise<Plan[]> {
    return apiClient<Plan[]>("/billing/plans");
  },

  // ─── Status ───────────────────────────────────────────────────────────────

  getCreditStatus(): Promise<CreditStatus> {
    return apiClient<CreditStatus>("/billing/status");
  },

  // ─── Payment ──────────────────────────────────────────────────────────────

  initiatePayment(
    plan:       string,
    provider:   PaymentProvider,
    payerPhone: string,
    payerName:  string,
  ): Promise<InitiatePaymentResponse> {
    return apiClient<InitiatePaymentResponse>("/billing/payments/initiate", {
      method: "POST",
      body:   JSON.stringify({ plan, provider, payerPhone, payerName }),
    });
  },

  // ─── History ──────────────────────────────────────────────────────────────

  getPaymentHistory(page = 1, pageSize = 20): Promise<Paginated<PaymentHistoryItem>> {
    return apiClient<Paginated<PaymentHistoryItem>>(
      `/billing/payments/history?page=${page}&pageSize=${pageSize}`,
    );
  },

  // ─── Credits ledger ───────────────────────────────────────────────────────

  getCreditHistory(page = 1, pageSize = 20): Promise<Paginated<CreditLedgerEntry>> {
    return apiClient<Paginated<CreditLedgerEntry>>(
      `/billing/credits/history?page=${page}&pageSize=${pageSize}`,
    );
  },
};
