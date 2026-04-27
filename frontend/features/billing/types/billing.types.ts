/**
 * @file features/billing/types/billing.types.ts
 * @description Zod schemas and inferred types for the Billing domain.
 * Single source of truth — import Billing types from here everywhere.
 */

export type Plan = {
  id: string;
  name: string;
  price: number;
  desc: string;
  current: boolean;
  popular?: boolean;
  features: string[];
};

export type HistoryItem = {
  id: string;
  date: string;
  plan: string;
  amount: number;
  method: string;
  status: "paid" | "pending" | "failed";
};

export type PayMethod = "mvola" | "orange";
