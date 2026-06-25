/**
 * @file features/ai/config/ai-models.config.ts
 *
 * Single source of truth for all OpenRouter model IDs.
 *
 * FIX (June 2026) — all previous free models were unavailable in production:
 *   - google/gemini-2.0-flash-exp:free  → "No endpoints found"
 *   - meta-llama/llama-3.3-70b-instruct:free → "Provider returned error"
 *   - google/gemma-3-27b-it:free        → "unavailable for free, use paid slug"
 *   - mistralai/mistral-7b-instruct:free → "No endpoints found"
 *
 * Updated to currently working free/low-cost models on OpenRouter.
 * Primary: meta-llama/llama-4-scout:free (fast, multilingual, reliable)
 * Fallbacks ordered by reliability, not preference.
 *
 * If ALL models fail again in production, update MODEL_IDs here only.
 */

// ─── Reply AI (Messenger inbox DMs) ────────────────────────────────────────────

export const REPLY_AI_MODEL = {
  MODEL_ID:    'meta-llama/llama-4-scout:free',
  MODEL_NAME:  'Llama 4 Scout (free)',
  MAX_TOKENS:  400,
  TEMPERATURE: 0.5,
} as const;

export const REPLY_AI_FALLBACK_MODELS = [
  'meta-llama/llama-4-scout:free',
  'meta-llama/llama-4-maverick:free',
  'deepseek/deepseek-chat-v3-0324:free',
  'google/gemini-2.5-flash-preview:free',
  'mistralai/mistral-small-3.2-24b-instruct:free',
] as const;

// ─── Comment AI (public/private Facebook post comment replies) ────────────────

export const COMMENT_AI_MODEL = {
  MODEL_ID:    'meta-llama/llama-4-scout:free',
  MODEL_NAME:  'Llama 4 Scout (free)',
  MAX_TOKENS:  150,
  TEMPERATURE: 0.6,
} as const;

export const COMMENT_AI_FALLBACK_MODELS = [
  'meta-llama/llama-4-scout:free',
  'meta-llama/llama-4-maverick:free',
  'deepseek/deepseek-chat-v3-0324:free',
  'google/gemini-2.5-flash-preview:free',
  'mistralai/mistral-small-3.2-24b-instruct:free',
] as const;

// ─── Data AI (summaries) ──────────────────────────────────────────────────────

export const DATA_AI_MODEL = {
  MODEL_ID:    'meta-llama/llama-4-maverick:free',
  MODEL_NAME:  'Llama 4 Maverick (free)',
  MAX_TOKENS:  200,
  TEMPERATURE: 0.2,
} as const;

/**
 * Known-working summary model IDs.
 * Used by AiSummaryWorker to detect stale DB rows (old broken model IDs)
 * and reset them automatically.
 */
export const SUMMARY_AI_FALLBACK_MODELS = [
  'meta-llama/llama-4-maverick:free',
  'meta-llama/llama-4-scout:free',
  'deepseek/deepseek-chat-v3-0324:free',
  'mistralai/mistral-small-3.2-24b-instruct:free',
] as const;

// ─── Context defaults ─────────────────────────────────────────────────────────

export const AI_CONTEXT_CONFIG = {
  MAX_CONTEXT_MESSAGES:    8,
  SUMMARY_EVERY_N_MESSAGES: 10,
  MAX_REPLY_DELAY_SECONDS:  60,
} as const;
