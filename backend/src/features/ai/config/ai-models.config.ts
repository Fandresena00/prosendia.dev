/**
 * @file features/ai/config/ai-models.config.ts
 *
 * NOTE:
 * Free model endpoints on OpenRouter can disappear without notice.
 * Keep defaults on broadly available production models and let each profile
 * override in DB if needed.
 */

// ─── Reply AI ─────────────────────────────────────────────────────────────────

export const REPLY_AI_MODEL = {
  MODEL_ID: 'google/gemma-4-26b-a4b-it:free',
  MODEL_NAME: 'Gemma 4 Free',
  MAX_TOKENS: 400,
  TEMPERATURE: 0.7,
} as const;
// ─── Data AI ──────────────────────────────────────────────────────────────────

export const DATA_AI_MODEL = {
  MODEL_ID: 'mistralai/mistral-small-3.1-24b-instruct:free',
  MODEL_NAME: 'Mistral Small Free',
  MAX_TOKENS: 200,
  TEMPERATURE: 0.2,
} as const;

// ─── Context window defaults ──────────────────────────────────────────────────

export const AI_CONTEXT_CONFIG = {
  /** Number of recent messages included in every ReplyAI context window. */
  MAX_CONTEXT_MESSAGES: 8,

  /** DataAI generates a new summary every N client messages. */
  SUMMARY_EVERY_N_MESSAGES: 10,

  /** Maximum delay in seconds before sending an AI reply. */
  MAX_REPLY_DELAY_SECONDS: 60,
} as const;

// ─── Fallback models (used when DB config is absent) ─────────────────────────

/**
 * Ordered list of free fallback models for reply generation.
 * If the primary model fails or returns empty, the next one is tried.
 * All models here must NOT output thinking chains.
 */
export const REPLY_AI_FALLBACK_MODELS = [
  'google/gemma-4-26b-a4b-it:free',
  'mistralai/mistral-small-3.1-24b-instruct:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'deepseek/deepseek-chat-v3-0324:free',
] as const;
