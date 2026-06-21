// src/features/admin/admin.constants.ts

export const ADMIN_ACCESS_TOKEN_COOKIE = 'vendeo_admin_access_token' as const;
export const ADMIN_REFRESH_TOKEN_COOKIE = 'vendeo_admin_refresh_token' as const;

/** 30 minutes — sessions admin plus courtes que les sessions clients */
export const ADMIN_ACCESS_TOKEN_MAX_AGE_MS = 30 * 60 * 1000;

/** 24h — pas besoin de rester connecté 7 jours côté admin */
export const ADMIN_REFRESH_TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000;
