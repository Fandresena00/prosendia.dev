/**
 * @file src/features/auth/constants/auth.constants.ts
 * @description Cookie names and TTLs shared across strategies and controller.
 */

export const ACCESS_TOKEN_COOKIE = 'vendeo_access_token' as const;
export const REFRESH_TOKEN_COOKIE = 'vendeo_refresh_token' as const;

/** 15 minutes in milliseconds */
export const ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000;

/** 7 days in milliseconds */
export const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
