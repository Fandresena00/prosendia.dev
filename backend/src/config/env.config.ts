/**
 * @file src/config/env.config.ts
 * CHANGE: Added VAPID keys for Web Push notifications.
 *
 * Generate VAPID keys:
 *   npx web-push generate-vapid-keys
 */

export default () => ({
  port: parseInt(process.env.PORT ?? '5000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: process.env.DATABASE_URL,
  frontendUrl: process.env.FRONTEND_URL,
  appUrl: process.env.APP_URL ?? process.env.FRONTEND_URL,
  appTitle: process.env.APP_TITLE ?? 'VendeoAI',
  backendUrl:
    process.env.BACKEND_URL ??
    process.env.APP_URL ??
    `http://localhost:${process.env.PORT ?? '5000'}`,

  // ── Auth ─────────────────────────────────────────────────────────────────
  jwtSecret: process.env.JWT_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  jwtExpiration: process.env.JWT_EXPIRATION ?? '15m',
  jwtRefreshExpiration: process.env.JWT_REFRESH_EXPIRATION ?? '7d',

  // ── AI / OpenRouter ───────────────────────────────────────────────────────
  openRouterApiKey: process.env.OPENROUTER_API_KEY,

  // ── Facebook ──────────────────────────────────────────────────────────────
  facebookAppId: process.env.FACEBOOK_APP_ID,
  facebookAppSecret: process.env.FACEBOOK_APP_SECRET,
  facebookVerifyToken: process.env.FACEBOOK_VERIFY_TOKEN,
  facebookTokenEncryptionKey: process.env.FACEBOOK_TOKEN_ENCRYPTION_KEY,

  // ── Papi Payment ──────────────────────────────────────────────────────────
  papiApiKey: process.env.PAPI_API_KEY,

  // ── Web Push (VAPID) ─────────────────────────────────────────────────────
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
  vapidEmail: process.env.VAPID_EMAIL ?? 'mailto:contact@vendeoai.com',

  resendApiKey: process.env.RESEND_API_KEY,
  emailFrom: process.env.EMAIL_FROM ?? 'VendeoAI <noreply@vendeoai.com>',
});

// =============================================================================
// VALIDATION ADDITIONS — ajouter dans src/config/validation.ts
// Dans le Joi.object({}) existant:
// =============================================================================
/*
  // Web Push VAPID keys (optionnels — désactive Web Push si absent)
  VAPID_PUBLIC_KEY:  Joi.string().optional(),
  VAPID_PRIVATE_KEY: Joi.string().optional(),
  VAPID_EMAIL:       Joi.string().optional(),
*/

// =============================================================================
// .env ADDITIONS
// =============================================================================
/*
  # Web Push VAPID (générer avec: npx web-push generate-vapid-keys)
  VAPID_PUBLIC_KEY=Bxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  VAPID_PRIVATE_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  VAPID_EMAIL=mailto:contact@vendeoai.com
*/

// =============================================================================
// Package à installer:
//   pnpm add web-push
//   pnpm add -D @types/web-push
// =============================================================================
