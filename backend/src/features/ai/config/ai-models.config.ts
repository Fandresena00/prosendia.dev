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
  /**
   * OpenRouter model ID.
   * Llama 3.1 8B: fast, multilingual, no thinking-chain leakage, free tier.
   */
  MODEL_ID: 'openrouter/free',

  /** Human-readable name shown in the UI model selector. */
  MODEL_NAME: 'OpenRouter Free Router',

  /** Maximum completion tokens per reply. */
  MAX_TOKENS: 400,

  /** Balanced creativity for natural seller replies. */
  TEMPERATURE: 0.7,
} as const;

// ─── Data AI ──────────────────────────────────────────────────────────────────

export const DATA_AI_MODEL = {
  /**
   * Gemma 2 9B: efficient, factual, good for text summarisation.
   * Free tier available on OpenRouter.
   */
  MODEL_ID: 'openrouter/free',

  MODEL_NAME: 'OpenRouter Free Router',

  /** Summaries must stay concise. */
  MAX_TOKENS: 200,

  /** Low creativity for factual extraction. */
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
  'openrouter/free',
  'meta-llama/llama-3.2-3b-instruct:free',
  'google/gemma-2-9b-it:free',
] as const;
