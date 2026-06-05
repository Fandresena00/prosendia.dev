/**
 * @file features/billing/types/billing.types.ts
 *
 * Types TypeScript pour le module Billing.
 * AUCUNE valeur métier ici — tout vient du backend via /billing/plans et /billing/status.
 */

// ─── Plans ────────────────────────────────────────────────────────────────────

export type PlanId = string; // "FREE" | "STARTER" | "PRO" | "CUSTOM" — extensible

export type PaymentProvider = "MVOLA" | "ORANGE_MONEY" | "AIRTEL_MONEY";

/** Forme exacte retournée par GET /billing/plans */
export type Plan = {
  id: PlanId;
  name: string;
  priceAriary: number | null; // null = sur devis (CUSTOM)
  durationDays: number;
  credits: number | null; // null = personnalisé
  maxPages: number | null;
  maxManagedPosts: number | null;
  maxReferenceImages: number | null;
  popular?: boolean;
  supportPriority: boolean;
  advancedStats: boolean;
  features: string[]; // liste de features affichables
};

// ─── Credit status ────────────────────────────────────────────────────────────

/** Forme exacte retournée par GET /billing/status */
export type CreditStatus = {
  plan: string;
  planName: string;
  creditBalance: number;
  creditsGranted: number | null;
  usagePercent: number;
  remainingPercent: number;
  isExpired: boolean;
  isLow: boolean; // < 20 % restants
  isCritical: boolean; // < 100 crédits
  isDepleted: boolean; // 0 crédits
  periodEnd: string | null;
  daysRemaining: number | null;
  maxPages: number | null;
  maxManagedPosts: number | null;
  maxReferenceImages: number | null;
};

// ─── Payment ──────────────────────────────────────────────────────────────────

/** Retourné par POST /billing/payments/initiate */
export type InitiatePaymentResponse = {
  paymentId: string;
  paymentLink: string;
  amount: number;
  expiresAt: string;
  plan: string;
  provider: string;
};

/** Retourné par GET /billing/payments/history */
export type PaymentHistoryItem = {
  id: string;
  date: string;
  plan: string;
  amount: number;
  provider: string;
  status: "SUCCESS" | "PENDING" | "FAILED" | "REFUNDED";
  papiRef: string | null;
};

/** Retourné par GET /billing/credits/history */
export type CreditLedgerEntry = {
  id: string;
  type: string;
  amount: number;
  tokensUsed: number | null;
  modelId: string | null;
  description: string | null;
  createdAt: string;
};

// ─── UI constants (présentation uniquement, pas de valeurs métier) ────────────

/** Labels et métadonnées d'affichage des providers de paiement. */
export const PROVIDER_META: Record<
  PaymentProvider,
  {
    label: string;
    prefixes: string[];
    operator: string;
  }
> = {
  MVOLA: { label: "MVola", prefixes: ["034", "038"], operator: "Telma" },
  ORANGE_MONEY: {
    label: "Orange Money",
    prefixes: ["032", "037"],
    operator: "Orange",
  },
  AIRTEL_MONEY: {
    label: "Airtel Money",
    prefixes: ["033"],
    operator: "Airtel",
  },
};

/** Labels lisibles pour chaque type d'entrée du ledger de crédits. */
export const CREDIT_TYPE_LABELS: Record<string, string> = {
  SUBSCRIPTION_GRANT: "Attribution abonnement",
  AI_REPLY_CONSUME: "Réponse IA Messenger",
  COMMENT_AI_CONSUME: "Réponse IA commentaire",
  ADMIN_ADJUST: "Ajustement admin",
};

/** Badges de statut pour l'historique des paiements. */
export const PAYMENT_STATUS_DISPLAY: Record<
  string,
  {
    label: string;
    className: string;
  }
> = {
  SUCCESS: {
    label: "Payé",
    className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  },
  PENDING: {
    label: "En attente",
    className: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  },
  FAILED: {
    label: "Échoué",
    className: "bg-red-500/10 text-red-700 border-red-500/20",
  },
  REFUNDED: {
    label: "Remboursé",
    className: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  },
};

/** Labels lisibles pour les providers (affichage dans les tableaux). */
export const PROVIDER_DISPLAY_LABELS: Record<string, string> = {
  MVOLA: "MVola",
  ORANGE_MONEY: "Orange Money",
  AIRTEL_MONEY: "Airtel Money",
  MANUAL: "Manuel",
};
