/**
 * @file features/ai/config/ai-models.config.ts
 *
 * CHANGE: REPLY_AI_MODEL changed from Nemotron to Llama 3.1 8B.
 *
 * WHY NEMOTRON WAS REMOVED:
 *   nvidia/nemotron-3-super-120b-a12b:free is a "thinking model" — it outputs
 *   its internal chain-of-thought reasoning BEFORE the actual reply:
 *
 *     "Okay, the user is greeting me with 'Bonjour'. I need to respond in French..."
 *
 *   This reasoning text was being sent verbatim to customers as the message.
 *   Llama 3.1 8B does not output thinking chains.
 *
 * MODEL SELECTION CRITERIA (free tier only for MVP):
 *   REPLY_AI  → conversational, multilingual, no thinking chain, fast
 *   DATA_AI   → factual extraction, low cost, concise output
 *
 * To use paid models later, update MODEL_ID here — no other file changes needed.
 */

// ─── Reply AI ─────────────────────────────────────────────────────────────────

export const REPLY_AI_MODEL = {
  /**
   * OpenRouter model ID.
   * Llama 3.1 8B: fast, multilingual, no thinking-chain leakage, free tier.
   */
  MODEL_ID: 'meta-llama/llama-3.1-8b-instruct:free',

  /** Human-readable name shown in the UI model selector. */
  MODEL_NAME: 'Llama 3.1 8B Instruct (free)',

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
  MODEL_ID: 'google/gemma-2-9b-it:free',

  MODEL_NAME: 'Gemma 2 9B IT (free)',

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
  'meta-llama/llama-3.1-8b-instruct:free',
  'mistralai/mistral-7b-instruct:free',
  'microsoft/phi-3-mini-128k-instruct:free',
] as const;
