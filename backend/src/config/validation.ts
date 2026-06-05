/**
 * @file src/config/validation.ts
 * @description Joi schema — validates all required environment variables at startup.
 *
 * CHANGE: Added PAPI_API_KEY for Papi payment gateway.
 */

import Joi from 'joi';

export const ValidationSchema = Joi.object({
  // ── Server ────────────────────────────────────────────────────────────────
  PORT: Joi.number().integer().min(1).max(65535).default(5000),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  // ── Database ──────────────────────────────────────────────────────────────
  DATABASE_URL: Joi.string().uri().required().messages({
    'string.uri': 'DATABASE_URL must be a valid connection string URI',
    'any.required': 'DATABASE_URL is required',
  }),

  // ── Frontend / Backend URLs ────────────────────────────────────────────────
  FRONTEND_URL: Joi.string().uri().required().messages({
    'string.uri': 'FRONTEND_URL must be a valid URI',
    'any.required': 'FRONTEND_URL is required',
  }),
  APP_URL: Joi.string().uri().default(Joi.ref('FRONTEND_URL')).messages({
    'string.uri': 'APP_URL must be a valid URI',
  }),
  BACKEND_URL: Joi.string().uri().optional().messages({
    'string.uri':
      'BACKEND_URL must be a valid URI (e.g. https://api.vendeoai.com)',
  }),
  APP_TITLE: Joi.string().min(1).default('VendeoAI'),

  // ── JWT ───────────────────────────────────────────────────────────────────
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

  // ── AI / OpenRouter ───────────────────────────────────────────────────────
  OPENROUTER_API_KEY: Joi.string().required().messages({
    'any.required': 'OPENROUTER_API_KEY is required',
    'string.empty': 'OPENROUTER_API_KEY cannot be empty',
  }),

  // ── Facebook ──────────────────────────────────────────────────────────────
  FACEBOOK_APP_ID: Joi.string().required().messages({
    'any.required': 'FACEBOOK_APP_ID is required',
    'string.empty': 'FACEBOOK_APP_ID cannot be empty',
  }),
  FACEBOOK_APP_SECRET: Joi.string().required().messages({
    'any.required': 'FACEBOOK_APP_SECRET is required',
    'string.empty': 'FACEBOOK_APP_SECRET cannot be empty',
  }),
  FACEBOOK_VERIFY_TOKEN: Joi.string().required().messages({
    'any.required': 'FACEBOOK_VERIFY_TOKEN is required',
    'string.empty': 'FACEBOOK_VERIFY_TOKEN cannot be empty',
  }),
  FACEBOOK_TOKEN_ENCRYPTION_KEY: Joi.string()
    .length(64)
    .hex()
    .required()
    .messages({
      'any.required': 'FACEBOOK_TOKEN_ENCRYPTION_KEY is required',
      'string.length':
        'FACEBOOK_TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 bytes)',
      'string.hex': 'FACEBOOK_TOKEN_ENCRYPTION_KEY must be a valid hex string',
    }),

  // ── Papi Payment Gateway ──────────────────────────────────────────────────
  PAPI_API_KEY: Joi.string().required().messages({
    'any.required': 'PAPI_API_KEY is required for payment processing',
    'string.empty': 'PAPI_API_KEY cannot be empty',
  }),

  // Web Push VAPID keys (optionnels — désactive Web Push si absent)
  VAPID_PUBLIC_KEY: Joi.string().optional(),
  VAPID_PRIVATE_KEY: Joi.string().optional(),
  VAPID_EMAIL: Joi.string().optional(),
});
