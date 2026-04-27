/**
 * @file src/config/env.config.ts
 * @description Typed configuration factory (Facebook additions shown).
 * Merge these keys into your existing env.config.ts.
 */

export default () => ({
  // ... your existing keys ...
  port: parseInt(process.env.PORT ?? '5000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: process.env.DATABASE_URL,
  frontendUrl: process.env.FRONTEND_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  jwtExpiration: process.env.JWT_EXPIRATION ?? '15m',
  jwtRefreshExpiration: process.env.JWT_REFRESH_EXPIRATION ?? '7d',

  // ── Facebook ──────────────────────────────────────────────────────────────
  facebookAppId: process.env.FACEBOOK_APP_ID,
  facebookAppSecret: process.env.FACEBOOK_APP_SECRET,
  facebookVerifyToken: process.env.FACEBOOK_VERIFY_TOKEN,
  facebookOauthRedirectUri: process.env.FACEBOOK_OAUTH_REDIRECT_URI,

  /**
   * 32-byte hex key for AES-256-GCM token encryption.
   * Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   */
  facebookTokenEncryptionKey: process.env.FACEBOOK_TOKEN_ENCRYPTION_KEY,
});
