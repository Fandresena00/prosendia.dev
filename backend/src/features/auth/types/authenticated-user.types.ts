/**
 * @file src/features/auth/types/authenticated-user.types.ts
 * @description Lightweight authenticated principal carried by access tokens.
 */

export interface AuthenticatedUser {
  sub: string;
  email: string;
  jti: string;
  sessionId: string;
  iat?: number;
  exp?: number;
}
