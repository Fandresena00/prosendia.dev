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
  MODEL_ID: 'google/gemini-2.0-flash-exp:free',
  MODEL_NAME: 'Gemini 2 Flash Free',
  MAX_TOKENS: 400,
  TEMPERATURE: 0.7,
} as const;
// ─── Data AI ──────────────────────────────────────────────────────────────────

export const DATA_AI_MODEL = {
  MODEL_ID: 'meta-llama/llama-3.3-70b-instruct:free',
  MODEL_NAME: 'Llama 3.3 70B Free',
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
  'google/gemini-2.0-flash-exp:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemma-3-27b-it:free',
] as const;
