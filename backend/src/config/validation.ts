/**
 * @file src/config/validation.ts
 * @description Joi schema that validates all required environment variables
 * at application startup. The app will REFUSE TO START if any variable is
 * missing, has the wrong type, or fails a constraint.
 *
 * Key rules:
 * - JWT_SECRET and JWT_REFRESH_SECRET must be different values (use different
 *   secrets in production — one compromised secret should not break both token types).
 * - PORT was previously named APP_PORT in env.config.ts — now unified to PORT.
 * - JWT_REFRESH_SECRET is required to support the refresh token flow.
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

  // ── Frontend ──────────────────────────────────────────────────────────────
  FRONTEND_URL: Joi.string().uri().required().messages({
    'string.uri': 'FRONTEND_URL must be a valid URI',
    'any.required': 'FRONTEND_URL is required',
  }),

  // ── JWT ───────────────────────────────────────────────────────────────────
  JWT_SECRET: Joi.string().min(32).required().messages({
    'string.min': 'JWT_SECRET must be at least 32 characters',
    'any.required': 'JWT_SECRET is required',
  }),
  JWT_REFRESH_SECRET: Joi.string().min(32).required().messages({
    'string.min': 'JWT_REFRESH_SECRET must be at least 32 characters',
    'any.required': 'JWT_REFRESH_SECRET is required',
  }),

  // ── JWT TTLs ──────────────────────────────────────────────────────────────
  JWT_EXPIRATION: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRATION: Joi.string().default('7d'),

  // ── Facebook ─────────────────────────────────────────

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
    'string.uri': 'FACEBOOK_OAUTH_REDIRECT_URI must be a valid URI',
  }),

  FACEBOOK_TOKEN_ENCRYPTION_KEY: Joi.string()
    .length(64) // 32 bytes hex = 64 chars
    .hex()
    .required()
    .messages({
      'any.required': 'FACEBOOK_TOKEN_ENCRYPTION_KEY is required',
      'string.length':
        'FACEBOOK_TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 bytes)',
      'string.hex': 'FACEBOOK_TOKEN_ENCRYPTION_KEY must be a valid hex string',
    }),
});
