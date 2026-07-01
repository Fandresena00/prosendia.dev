/**
 * @file features/billing/billing.constants.ts
 *
 * Source unique de vérité pour tous les plans VendeoAI.
 *
 * Crédits IA : 1 crédit = 100 tokens OpenRouter
 *   Free    :    500 crédits →    50 000 tokens
 *   Starter :  8 000 crédits →   800 000 tokens
 *   Pro     : 20 000 crédits → 2 000 000 tokens
 */

export const BILLING_PLANS = {
  FREE: {
    id:           'FREE' as const,
    name:         'Gratuit',
    priceAriary:  0,
    durationDays: 30,
    credits:      500,
    maxPages:     1,
    maxManagedPosts: 1,
    maxReferenceImages: 5,
    supportPriority: false,
    advancedStats:   false,
    features: [
      '1 page Facebook',
      '500 crédits IA par mois',
      '1 post géré simultanément',
      '5 images de référence',
      'Réponses IA Messenger',
      "Réponses IA aux commentaires",
      'Personnalisation IA',
      'Synchronisation automatique',
    ],
  },
  STARTER: {
    id:           'STARTER' as const,
    name:         'Starter',
    priceAriary:  15_000,
    durationDays: 30,
    credits:      8_000,
    maxPages:     2,
    maxManagedPosts: 10,
    maxReferenceImages: 25,
    supportPriority: false,
    advancedStats:   false,
    features: [
      '2 pages Facebook',
      '8 000 crédits IA par mois',
      '10 posts gérés simultanément',
      '25 images de référence',
      'Réponses IA Messenger',
      "Réponses IA aux commentaires",
      'Personnalisation IA',
      'Synchronisation automatique',
    ],
  },
  PRO: {
    id:           'PRO' as const,
    name:         'Pro',
    priceAriary:  27_000,
    durationDays: 30,
    credits:      20_000,
    maxPages:     4,
    maxManagedPosts: 20,
    maxReferenceImages: 100,
    popular:         true,
    supportPriority: true,
    advancedStats:   true,
    features: [
      '4 pages Facebook',
      '20 000 crédits IA par mois',
      '20 posts gérés simultanément',
      '100 images de référence',
      'Réponses IA Messenger',
      "Réponses IA aux commentaires",
      'Personnalisation IA',
      'Synchronisation automatique',
      'Support prioritaire',
      'Statistiques avancées',
    ],
  },
  CUSTOM: {
    id:           'CUSTOM' as const,
    name:         'Custom',
    priceAriary:  null,
    durationDays: 30,
    credits:      null,
    maxPages:     null,
    maxManagedPosts: null,
    maxReferenceImages: null,
    supportPriority: true,
    advancedStats:   true,
    features: [
      'Nombre de pages personnalisé',
      'Crédits IA personnalisés',
      'Nombre de posts personnalisé',
      'Images de référence personnalisées',
      'Support dédié',
      'Fonctionnalités sur mesure',
    ],
  },
} as const;

export type PlanId = keyof typeof BILLING_PLANS;
export type BillingPlanConfig = {
  id: PlanId;
  name: string;
  priceAriary: number | null;
  durationDays: number;
  credits: number | null;
  maxPages: number | null;
  maxManagedPosts: number | null;
  maxReferenceImages: number | null;
  popular?: boolean;
  supportPriority: boolean;
  advancedStats: boolean;
  features: readonly string[];
};

export type CustomBillingPlanInput = {
  id?: string;
  name: string;
  description?: string | null;
  priceAriary: number;
  durationDays: number;
  credits: number;
  maxPages: number;
  maxManagedPosts: number;
  maxReferenceImages: number;
  isPurchasable?: boolean;
};

export type ResolvedBillingPlan = Omit<BillingPlanConfig, 'id'> & {
  id: string;
  sourcePlanId: PlanId;
  customConfigId?: string;
  isPurchasable?: boolean;
};

export function buildPlanFeatures(plan: {
  credits: number | null;
  maxPages: number | null;
  maxManagedPosts: number | null;
  maxReferenceImages: number | null;
  supportPriority: boolean;
  advancedStats: boolean;
}): string[] {
  return [
    plan.maxPages === null
      ? 'Nombre de pages personnalisé'
      : `${plan.maxPages} page${plan.maxPages > 1 ? 's' : ''} Facebook`,
    plan.credits === null
      ? 'Crédits IA personnalisés'
      : `${plan.credits.toLocaleString('fr-FR')} crédits IA par mois`,
    plan.maxManagedPosts === null
      ? 'Nombre de posts personnalisé'
      : `${plan.maxManagedPosts} post${plan.maxManagedPosts > 1 ? 's' : ''} géré${plan.maxManagedPosts > 1 ? 's' : ''} simultanément`,
    plan.maxReferenceImages === null
      ? 'Images de référence personnalisées'
      : `${plan.maxReferenceImages} images de référence`,
    'Réponses IA Messenger',
    "Réponses IA aux commentaires",
    'Personnalisation IA',
    'Synchronisation automatique',
    ...(plan.supportPriority ? ['Support prioritaire'] : []),
    ...(plan.advancedStats ? ['Statistiques avancées'] : []),
  ];
}

export function resolveCustomBillingPlan(
  config: CustomBillingPlanInput,
): ResolvedBillingPlan {
  return {
    ...BILLING_PLANS.CUSTOM,
    id: config.id ?? 'CUSTOM',
    sourcePlanId: 'CUSTOM',
    customConfigId: config.id,
    name: config.name || BILLING_PLANS.CUSTOM.name,
    priceAriary: config.priceAriary,
    durationDays: config.durationDays,
    credits: config.credits,
    maxPages: config.maxPages,
    maxManagedPosts: config.maxManagedPosts,
    maxReferenceImages: config.maxReferenceImages,
    isPurchasable: config.isPurchasable,
    features: buildPlanFeatures({
      credits: config.credits,
      maxPages: config.maxPages,
      maxManagedPosts: config.maxManagedPosts,
      maxReferenceImages: config.maxReferenceImages,
      supportPriority: true,
      advancedStats: true,
    }),
  };
}

/** 1 crédit VendeoAI = TOKENS_PER_CREDIT tokens OpenRouter */
export const TOKENS_PER_CREDIT = 100;

/** Convertit des tokens réels en crédits VendeoAI (arrondi au supérieur). */
export function tokensToCredits(tokens: number): number {
  return Math.ceil(tokens / TOKENS_PER_CREDIT);
}

/** Seuil d'alerte "presque épuisé" en pourcentage du total accordé. */
export const CREDIT_ALERT_THRESHOLD_PCT = 20;

/** Seuil critique absolu (< 100 crédits = ultime avertissement). */
export const CREDIT_CRITICAL_THRESHOLD = 100;

/** Durée de validité d'un lien Papi (minutes). */
export const PAPI_LINK_VALIDITY_MINUTES = 60;

/** Préfixe des références de paiement. */
export const PAPI_REFERENCE_PREFIX = 'VENDEO';

/** Rétention des transactions (ans). */
export const PAYMENT_RETENTION_YEARS = 3;

/** Mapping provider frontend → code Papi (ARTEL_MONEY sans I). */
export const PROVIDER_TO_PAPI: Record<string, string> = {
  MVOLA:        'MVOLA',
  ORANGE_MONEY: 'ORANGE_MONEY',
  AIRTEL_MONEY: 'ARTEL_MONEY',
};

export const PROVIDER_LABELS: Record<string, { label: string; prefix: string; operator: string }> = {
  MVOLA:        { label: 'MVola',        prefix: '034', operator: 'Telma' },
  ORANGE_MONEY: { label: 'Orange Money', prefix: '032', operator: 'Orange' },
  AIRTEL_MONEY: { label: 'Airtel Money', prefix: '033', operator: 'Airtel' },
};
