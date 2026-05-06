/**
 * @file features/queue/queue.constants.ts
 *
 * Central registry of all job names and their typed payloads.
 * Never use raw strings outside this file.
 *
 * pg-boss v10 option corrections applied:
 *   - singletonSeconds → does not exist; use singletonKey only (pg-boss dedupes per key)
 *   - singletonKey must be a plain string (not a function)
 *   - teamConcurrency → removed (use teamSize only in pg-boss v10)
 */

// ─── Job names ────────────────────────────────────────────────────────────────

export const QUEUE_JOBS = {
  AI_REPLY:      'ai.reply',
  AI_SUMMARIZE:  'ai.summarize',
  FACEBOOK_SYNC: 'facebook.sync',
  TOKEN_VALIDATE:'token.validate',
} as const;

export type QueueJobName = (typeof QUEUE_JOBS)[keyof typeof QUEUE_JOBS];

// ─── Payload types ────────────────────────────────────────────────────────────

export interface AiReplyPayload {
  conversationId:    string;
  inboundMessageId:  string;
  businessProfileId: string;
  userId:            string;
  inboundText?:      string;
  inboundCreatedAt?: string;
}

export interface AiSummarizePayload {
  conversationId:    string;
  businessProfileId: string;
}

export interface FacebookSyncPayload {
  businessProfileId: string;
  userId:            string;
  conversationId?:   string;
}

export interface TokenValidatePayload {
  connectionId: string;
  pageId:       string;
}

// ─── Job options ──────────────────────────────────────────────────────────────

/**
 * Shared retry/expire options per job type.
 *
 * singletonKey is computed at call-site (not stored here as a function)
 * because pg-boss requires a plain string — not a function reference.
 */
export const JOB_OPTIONS = {
  AI_REPLY: {
    retryLimit:      3,
    retryDelay:      10,   // seconds before first retry
    retryBackoff:    true, // exponential: 10s, 20s, 40s
    expireInSeconds: 300,  // job expires if not started within 5 minutes
    priority:        1,    // high priority
  },

  AI_SUMMARIZE: {
    retryLimit:      2,
    retryDelay:      30,
    retryBackoff:    true,
    expireInSeconds: 600,
    priority:        0,   // low priority — background
  },

  FACEBOOK_SYNC: {
    retryLimit:      3,
    retryDelay:      30,
    retryBackoff:    true,
    expireInSeconds: 300,
    priority:        1,
  },

  TOKEN_VALIDATE: {
    retryLimit:      2,
    retryDelay:      60,
    retryBackoff:    false,
    expireInSeconds: 120,
    priority:        0,
  },
} as const;

/**
 * Build a singleton key for deduplication.
 * Returns a unique string per job+entity pair.
 * pg-boss will silently drop a new job if an identical singletonKey
 * already exists in PENDING state.
 */
export function buildSingletonKey(jobName: QueueJobName, entityId: string): string {
  return `${jobName}:${entityId}`;
}
