/**
 * @file features/ai/config/ai-models.config.ts
 *
 * Single source of truth for OpenRouter model identifiers and default parameters.
 * To swap a model for a role, change only this file — no other file needs updating.
 *
 * Two AI roles:
 *   REPLY_AI — generates customer-facing Messenger / comment replies
 *   DATA_AI  — summarises conversation history and extracts structured data
 *
 * OpenRouter model IDs follow the format: "<provider>/<model-name>"
 * Browse available models at: https://openrouter.ai/models
 */
// ─── Reply AI ─────────────────────────────────────────────────────────────────
// Purpose : Generate customer-facing replies
// Criteria: Natural tone, multilingual support, low cost
// Trade-off: Free model first for MVP phase

export const REPLY_AI_MODEL = {
  /** OpenRouter model ID */
  MODEL_ID: 'nvidia/nemotron-3-super-120b-a12b:free',

  /** Human-readable name shown in the UI model selector */
  MODEL_NAME: 'Nemotron 3 Super (free)',

  /** Maximum completion tokens per reply */
  MAX_TOKENS: 400,

  /** Balanced creativity for natural seller replies */
  TEMPERATURE: 0.7,
} as const;

// ─── Data AI ──────────────────────────────────────────────────────────────────
// Purpose : Summarise conversation history and extract structured data
// Criteria: Fast and cheap — output only consumed internally
// Trade-off: Maximum cost reduction for MVP

export const DATA_AI_MODEL = {
  MODEL_ID: 'google/gemma-2-9b-it:free',

  MODEL_NAME: 'Gemma 2 9B IT (free)',

  /** Summaries must stay concise */
  MAX_TOKENS: 200,

  /** Low creativity for factual extraction */
  TEMPERATURE: 0.2,
} as const;

// ─── Context window defaults ──────────────────────────────────────────────────
// These values are used as fallbacks when the DB row doesn't exist yet.
// The Prisma schema sets the same values as column defaults.

export const AI_CONTEXT_CONFIG = {
  /** Number of recent messages included in every ReplyAI context window */
  MAX_CONTEXT_MESSAGES: 8,
  /** DataAI generates a new summary every N client messages */
  SUMMARY_EVERY_N_MESSAGES: 10,
  /** Maximum delay in seconds before sending an AI reply */
  MAX_REPLY_DELAY_SECONDS: 60,
} as const;
