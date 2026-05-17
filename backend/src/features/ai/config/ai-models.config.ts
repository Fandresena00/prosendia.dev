/**
 * @file features/ai/config/ai-models.config.ts
 *
 * Single source of truth for all OpenRouter model IDs.
 * Change model IDs here only — no other file needs updating.
 *
 * Free tier models change frequently on OpenRouter.
 * Keep defaults on broadly available models; users can override via DB.
 */

// ─── Reply AI ─────────────────────────────────────────────────────────────────

export const REPLY_AI_MODEL = {
  MODEL_ID:    'google/gemini-2.0-flash-exp:free',
  MODEL_NAME:  'Gemini 2.0 Flash (free)',
  MAX_TOKENS:  400,
  TEMPERATURE: 0.5,
} as const;

export const REPLY_AI_FALLBACK_MODELS = [
  'google/gemini-2.0-flash-exp:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemma-3-27b-it:free',
  'mistralai/mistral-7b-instruct:free',
] as const;

// ─── Data AI (summaries) ──────────────────────────────────────────────────────

export const DATA_AI_MODEL = {
  MODEL_ID:    'meta-llama/llama-3.3-70b-instruct:free',
  MODEL_NAME:  'Llama 3.3 70B (free)',
  MAX_TOKENS:  200,
  TEMPERATURE: 0.2,
} as const;

/**
 * Known-working summary model IDs.
 * Used by AiSummaryWorker to detect stale DB rows (old broken model IDs)
 * and reset them automatically.
 */
export const SUMMARY_AI_FALLBACK_MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemini-2.0-flash-exp:free',
  'google/gemma-3-27b-it:free',
  'meta-llama/llama-3.1-8b-instruct:free',
] as const;

// ─── Context defaults ─────────────────────────────────────────────────────────

export const AI_CONTEXT_CONFIG = {
  MAX_CONTEXT_MESSAGES:    8,
  SUMMARY_EVERY_N_MESSAGES: 10,
  MAX_REPLY_DELAY_SECONDS:  60,
} as const;
