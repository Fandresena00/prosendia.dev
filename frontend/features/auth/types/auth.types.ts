/**
 * @file features/auth/auth.types.ts
 * Tokens are in HttpOnly cookies — AuthResponse contains only user.
 */

import { User } from "../schemas/user.schema";

export interface AuthResponse {
  user: User;
}
