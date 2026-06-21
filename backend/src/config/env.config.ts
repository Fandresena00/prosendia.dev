/**
 * @file src/config/env.config.ts
 * CHANGE: Ajout des variables Google OAuth + Resend.
 * Fichier complet — remplace l'ancien env.config.ts.
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

  // ── Auth JWT ───────────────────────────────────────────────────────────
  jwtSecret: process.env.JWT_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  jwtExpiration: process.env.JWT_EXPIRATION ?? '15m',
  jwtRefreshExpiration: process.env.JWT_REFRESH_EXPIRATION ?? '7d',

  // ── AI / OpenRouter ────────────────────────────────────────────────────
  openRouterApiKey: process.env.OPENROUTER_API_KEY,

  // ── Facebook ───────────────────────────────────────────────────────────
  facebookAppId: process.env.FACEBOOK_APP_ID,
  facebookAppSecret: process.env.FACEBOOK_APP_SECRET,
  facebookVerifyToken: process.env.FACEBOOK_VERIFY_TOKEN,
  facebookTokenEncryptionKey: process.env.FACEBOOK_TOKEN_ENCRYPTION_KEY,

  // ── Papi Payment ───────────────────────────────────────────────────────
  papiApiKey: process.env.PAPI_API_KEY,

  // ── Resend (email) ─────────────────────────────────────────────────────
  resendApiKey: process.env.RESEND_API_KEY,
  emailFrom: process.env.EMAIL_FROM ?? 'VendeoAI <noreply@vendeoai.com>',

  // ── Google OAuth ───────────────────────────────────────────────────────
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL,

  // ── Web Push (VAPID) ───────────────────────────────────────────────────
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
  vapidEmail: process.env.VAPID_EMAIL ?? 'mailto:contact@vendeoai.com',

  // env.config.ts — ajouter
  adminJwtSecret: process.env.ADMIN_JWT_SECRET,
  adminJwtRefreshSecret: process.env.ADMIN_JWT_REFRESH_SECRET,
  superAdminEmail: process.env.SUPER_ADMIN_EMAIL,
  superAdminPassword: process.env.SUPER_ADMIN_PASSWORD,
});
