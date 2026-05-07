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
// Purpose : Generate customer-facing replies in Facebook Messenger and comments
// Criteria: Good instruction-following, multilingual, tone control
// Trade-off: quality > cost — this output is read by customers

export const REPLY_AI_MODEL = {
  /** OpenRouter model ID */
  MODEL_ID:    'anthropic/claude-3.5-haiku',
  /** Human-readable name shown in the UI model selector */
  MODEL_NAME:  'Claude 3.5 Haiku',
  /** Maximum completion tokens per reply (controls length + cost) */
  MAX_TOKENS:  400,
  /** 0 = fully deterministic, 1 = maximum creativity */
  TEMPERATURE: 0.7,
} as const;

// ─── Data AI ──────────────────────────────────────────────────────────────────
// Purpose : Summarise conversation history and extract structured data
// Criteria: Fast and cheap — its output is only read by ReplyAI, not humans
// Trade-off: speed + free tier preferred

export const DATA_AI_MODEL = {
  MODEL_ID:    'meta-llama/llama-3.1-8b-instruct:free',
  MODEL_NAME:  'Llama 3.1 8B Instruct (free)',
  /** Summaries must stay concise to minimise ReplyAI prompt tokens */
  MAX_TOKENS:  200,
  /** Low temperature — summaries must be factual, not creative */
  TEMPERATURE: 0.3,
} as const;

// ─── Context window defaults ──────────────────────────────────────────────────
// These values are used as fallbacks when the DB row doesn't exist yet.
// The Prisma schema sets the same values as column defaults.

export const AI_CONTEXT_CONFIG = {
  /** Number of recent messages included in every ReplyAI context window */
  MAX_CONTEXT_MESSAGES:     8,
  /** DataAI generates a new summary every N client messages */
  SUMMARY_EVERY_N_MESSAGES: 10,
  /** Maximum delay in seconds before sending an AI reply */
  MAX_REPLY_DELAY_SECONDS:  60,
} as const;
