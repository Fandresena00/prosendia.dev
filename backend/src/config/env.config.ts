/**
 * @file src/config/env.config.ts
 * @description Typed configuration factory.
 *
 * CHANGE: Added `backendUrl` — the public-facing URL of this NestJS server.
 * This is used when generating URLs for temporary file uploads that Facebook
 * must be able to download (images sent via the Graph API require a public HTTPS URL).
 *
 * Priority: BACKEND_URL > APP_URL > FRONTEND_URL > http://localhost:{PORT}
 * In production, set BACKEND_URL explicitly (e.g. https://api.vendeoai.com).
 */

export default () => ({
  port: parseInt(process.env.PORT ?? '5000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: process.env.DATABASE_URL,
  frontendUrl: process.env.FRONTEND_URL,
  appUrl: process.env.APP_URL ?? process.env.FRONTEND_URL,
  appTitle: process.env.APP_TITLE ?? 'VendeoAI',

  /**
   * Public-facing URL of the NestJS backend.
   * Used to build absolute URLs for temporary file uploads sent to Facebook.
   * Must be reachable from the internet in production.
   */
  backendUrl:
    process.env.BACKEND_URL ??
    process.env.APP_URL ??
    `http://localhost:${process.env.PORT ?? '5000'}`,

  // ── Auth ─────────────────────────────────────────────────────────────────
  jwtSecret: process.env.JWT_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  jwtExpiration: process.env.JWT_EXPIRATION ?? '15m',
  jwtRefreshExpiration: process.env.JWT_REFRESH_EXPIRATION ?? '7d',

  // ── AI / OpenRouter ──────────────────────────────────────────────────────
  openRouterApiKey: process.env.OPENROUTER_API_KEY,

  // ── Facebook ──────────────────────────────────────────────────────────────
  facebookAppId: process.env.FACEBOOK_APP_ID,
  facebookAppSecret: process.env.FACEBOOK_APP_SECRET,
  facebookVerifyToken: process.env.FACEBOOK_VERIFY_TOKEN,
  /**
   * 32-byte hex key for AES-256-GCM token encryption.
   * Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   */
  facebookTokenEncryptionKey: process.env.FACEBOOK_TOKEN_ENCRYPTION_KEY,
});
