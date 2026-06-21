/**
 * @file src/config/validation.ts
 * CHANGE: Ajout des variables Google OAuth + Resend.
 * Fichier complet — remplace l'ancien validation.ts.
 */

import Joi from 'joi';

export const ValidationSchema = Joi.object({
  // ── Server ────────────────────────────────────────────────────────────
  PORT: Joi.number().integer().min(1).max(65535).default(5000),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  // ── Database ──────────────────────────────────────────────────────────
  DATABASE_URL: Joi.string().uri().required().messages({
    'string.uri': 'DATABASE_URL must be a valid connection string URI',
    'any.required': 'DATABASE_URL is required',
  }),

  // ── Frontend / Backend URLs ───────────────────────────────────────────
  FRONTEND_URL: Joi.string().uri().required(),
  APP_URL: Joi.string().uri().default(Joi.ref('FRONTEND_URL')),
  BACKEND_URL: Joi.string().uri().optional(),
  APP_TITLE: Joi.string().min(1).default('VendeoAI'),

  // ── JWT ───────────────────────────────────────────────────────────────
  JWT_SECRET: Joi.string().min(32).required().messages({
    'string.min': 'JWT_SECRET must be at least 32 characters',
    'any.required': 'JWT_SECRET is required',
  }),
  JWT_REFRESH_SECRET: Joi.string().min(32).required().messages({
    'string.min': 'JWT_REFRESH_SECRET must be at least 32 characters',
    'any.required': 'JWT_REFRESH_SECRET is required',
  }),
  JWT_EXPIRATION: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRATION: Joi.string().default('7d'),

  // ── AI / OpenRouter ───────────────────────────────────────────────────
  OPENROUTER_API_KEY: Joi.string().required(),

  // ── Facebook ──────────────────────────────────────────────────────────
  FACEBOOK_APP_ID: Joi.string().required(),
  FACEBOOK_APP_SECRET: Joi.string().required(),
  FACEBOOK_VERIFY_TOKEN: Joi.string().required(),
  FACEBOOK_TOKEN_ENCRYPTION_KEY: Joi.string().length(64).hex().required(),

  // ── Papi Payment ──────────────────────────────────────────────────────
  PAPI_API_KEY: Joi.string().required(),

  // ── Resend (email) ────────────────────────────────────────────────────
  RESEND_API_KEY: Joi.string().required().messages({
    'any.required': 'RESEND_API_KEY is required',
  }),
  EMAIL_FROM: Joi.string().optional(),

  // ── Google OAuth ──────────────────────────────────────────────────────
  GOOGLE_CLIENT_ID: Joi.string().required().messages({
    'any.required': 'GOOGLE_CLIENT_ID is required',
  }),
  GOOGLE_CLIENT_SECRET: Joi.string().required().messages({
    'any.required': 'GOOGLE_CLIENT_SECRET is required',
  }),
  GOOGLE_CALLBACK_URL: Joi.string().uri().required().messages({
    'any.required': 'GOOGLE_CALLBACK_URL is required',
    'string.uri': 'GOOGLE_CALLBACK_URL must be a valid URI',
  }),

  // ── Web Push VAPID ────────────────────────────────────────────────────
  VAPID_PUBLIC_KEY: Joi.string().optional(),
  VAPID_PRIVATE_KEY: Joi.string().optional(),
  VAPID_EMAIL: Joi.string().optional(),

  // validation.ts — ajouter
  ADMIN_JWT_SECRET: Joi.string().min(32).required(),
  ADMIN_JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  SUPER_ADMIN_EMAIL: Joi.string().email().required(),
  SUPER_ADMIN_PASSWORD: Joi.string().min(12).required(),
});
