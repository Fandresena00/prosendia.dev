export const FACEBOOK_API = {
  VERSION: 'v25.0',
  BASE_URL: 'https://graph.facebook.com',
  get GRAPH_URL() {
    return `${this.BASE_URL}/${this.VERSION}`;
  },
  get DIALOG_URL() {
    return `https://www.facebook.com/dialog/oauth`;
  },
} as const;

/**
 * Required scopes for the Facebook integration.
 * - pages_show_list: list all pages the user manages
 * - pages_read_engagement: read reactions, comments, shares
 * - pages_manage_metadata: manage page name, description, etc.
 * - pages_manage_engagement: create/delete posts, comments, send messages
 * - pages_messaging: manage Messenger conversations
 * - business_management: optional, needed for Instagram accounts
 */
export const FACEBOOK_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_metadata',
  'pages_manage_engagement',
  'pages_manage_posts',
  'pages_messaging',
  'business_management',
] as const;

export const FACEBOOK_OPTIONAL_SCOPES = [
  'instagram_basic',
  'instagram_manage_comments',
] as const;

export const FACEBOOK_WEBHOOK_FIELDS = [
  'messages',
  'messaging_postbacks',
  'feed',
  'mention',
] as const;

export const FACEBOOK_ERROR_CODES = {
  TOKEN_EXPIRED: 190,
  INSUFFICIENT_PERMISSION: 200,
  RATE_LIMIT_APP: 4,
  RATE_LIMIT_USER: 17,
  RATE_LIMIT_PAGE: 32,
  TEMPORARY_ERROR: 2,
  UNKNOWN: 1,
} as const;

export const RETRYABLE_HTTP_STATUSES = [429, 500, 502, 503, 504] as const;

export const GRAPH_RETRY = {
  MAX_ATTEMPTS: 3,
  BASE_DELAY_MS: 1_000,
  BACKOFF_FACTOR: 2,
  MAX_DELAY_MS: 10_000,
} as const;
