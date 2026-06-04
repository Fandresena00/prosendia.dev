/**
 * @file features/billing/types/billing.types.ts
 */

export type PlanId = "FREE" | "STARTER" | "PRO" | "CUSTOM";

export type PaymentProvider = "MVOLA" | "ORANGE_MONEY" | "AIRTEL_MONEY";

export type Plan = {
  id:                 PlanId;
  name:               string;
  priceAriary:        number | null;
  durationDays:       number;
  credits:            number | null;
  maxPages:           number | null;
  maxManagedPosts:    number | null;
  maxReferenceImages: number | null;
  popular?:           boolean;
  supportPriority:    boolean;
  advancedStats:      boolean;
  features:           string[];
};

export type CreditStatus = {
  plan:               string;
  planName:           string;
  creditBalance:      number;
  creditsGranted:     number | null;
  usagePercent:       number;
  remainingPercent:   number;
  isExpired:          boolean;
  isLow:              boolean;
  isCritical:         boolean;
  isDepleted:         boolean;
  periodEnd:          string | null;
  daysRemaining:      number | null;
  maxPages:           number | null;
  maxManagedPosts:    number | null;
  maxReferenceImages: number | null;
};

export type PaymentHistoryItem = {
  id:       string;
  date:     string;
  plan:     string;
  amount:   number;
  provider: string;
  status:   "SUCCESS" | "PENDING" | "FAILED" | "REFUNDED";
  papiRef:  string | null;
};

export type InitiatePaymentResponse = {
  paymentId:   string;
  paymentLink: string;
  amount:      number;
  expiresAt:   string;
  plan:        string;
  provider:    string;
};

export type CreditLedgerEntry = {
  id:          string;
  type:        string;
  amount:      number;
  tokensUsed:  number | null;
  modelId:     string | null;
  description: string | null;
  createdAt:   string;
};

export const PROVIDER_META: Record<PaymentProvider, { label: string; prefix: string; operator: string }> = {
  MVOLA:        { label: "MVola",        prefix: "034", operator: "Telma" },
  ORANGE_MONEY: { label: "Orange Money", prefix: "032", operator: "Orange" },
  AIRTEL_MONEY: { label: "Airtel Money", prefix: "033", operator: "Airtel" },
};

export const CREDIT_TYPE_LABELS: Record<string, string> = {
  SUBSCRIPTION_GRANT:  "Attribution abonnement",
  AI_REPLY_CONSUME:    "Réponse IA Messenger",
  COMMENT_AI_CONSUME:  "Réponse IA commentaire",
  ADMIN_ADJUST:        "Ajustement admin",
};
