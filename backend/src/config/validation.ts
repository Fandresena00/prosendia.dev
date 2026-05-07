/**
 * @file src/config/validation.ts
 * @description Joi schema that validates all required environment variables
 * at application startup. The app will REFUSE TO START if any required variable is
 * missing, has the wrong type, or fails a constraint.
 *
 * CHANGE: Added optional BACKEND_URL — the public-facing URL of this NestJS server,
 * required when Facebook must download images sent via the Messenger API.
 * Falls back to APP_URL or localhost if not set (dev only).
 */

import Joi from 'joi';

export const ValidationSchema = Joi.object({
  // ── Server ────────────────────────────────────────────────────────────────
  PORT:     Joi.number().integer().min(1).max(65535).default(5000),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  // ── Database ──────────────────────────────────────────────────────────────
  DATABASE_URL: Joi.string().uri().required().messages({
    'string.uri':   'DATABASE_URL must be a valid connection string URI',
    'any.required': 'DATABASE_URL is required',
  }),

  // ── Frontend / Backend URLs ────────────────────────────────────────────────
  FRONTEND_URL: Joi.string().uri().required().messages({
    'string.uri':   'FRONTEND_URL must be a valid URI',
    'any.required': 'FRONTEND_URL is required',
  }),
  APP_URL: Joi.string().uri().default(Joi.ref('FRONTEND_URL')).messages({
    'string.uri': 'APP_URL must be a valid URI',
  }),

  /**
   * Public-facing URL of this NestJS server.
   * Facebook must be able to GET images at URLs built from this base.
   * Example: https://api.vendeoai.com
   * Optional — defaults to APP_URL or http://localhost:{PORT}.
   */
  BACKEND_URL: Joi.string().uri().optional().messages({
    'string.uri': 'BACKEND_URL must be a valid URI (e.g. https://api.vendeoai.com)',
  }),

  APP_TITLE: Joi.string().min(1).default('VendeoAI'),

  // ── JWT ───────────────────────────────────────────────────────────────────
  JWT_SECRET: Joi.string().min(32).required().messages({
    'string.min':   'JWT_SECRET must be at least 32 characters',
    'any.required': 'JWT_SECRET is required',
  }),
  JWT_REFRESH_SECRET: Joi.string().min(32).required().messages({
    'string.min':   'JWT_REFRESH_SECRET must be at least 32 characters',
    'any.required': 'JWT_REFRESH_SECRET is required',
  }),

  // ── JWT TTLs ──────────────────────────────────────────────────────────────
  JWT_EXPIRATION:         Joi.string().default('15m'),
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
  FACEBOOK_OAUTH_REDIRECT_URI: Joi.string().uri().required().messages({
    'any.required': 'FACEBOOK_OAUTH_REDIRECT_URI is required',
    'string.uri':   'FACEBOOK_OAUTH_REDIRECT_URI must be a valid URI',
  }),
  FACEBOOK_TOKEN_ENCRYPTION_KEY: Joi.string()
    .length(64)
    .hex()
    .required()
    .messages({
      'any.required': 'FACEBOOK_TOKEN_ENCRYPTION_KEY is required',
      'string.length': 'FACEBOOK_TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 bytes)',
      'string.hex':    'FACEBOOK_TOKEN_ENCRYPTION_KEY must be a valid hex string',
    }),
});
