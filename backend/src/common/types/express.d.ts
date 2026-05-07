/**
 * @file src/common/types/express.d.ts
 * @description Augments Express's Request type so `req.user` is typed as
 * the authenticated principal used throughout the codebase.
 * Without this, `req.user` is `any` and TypeScript cannot catch misuse.
 *
 * FIX: Changed import extension from `.ts` to `.js` (required for ESM / Node16 moduleResolution).
 */

import type { JwtRefreshPayload } from '../../features/auth/strategies/jwt-refresh.strategy.js';
import type { AuthenticatedUser } from '../../features/auth/types/authenticated-user.types.js';

declare global {
  namespace Express {
    interface User
      extends Partial<AuthenticatedUser>, Partial<JwtRefreshPayload> {}
  }
}
