/**
 * @file src/features/auth/dto/auth-response.dto.ts
 * @description Response shape for login, register, and token refresh endpoints.
 * Matches the AuthResponse interface expected by the frontend token manager.
 */

import type { UserResponseDto } from '../../users/dto/user-response.dto.js';

export class AuthResponseDto {
  user!: UserResponseDto;
  /** Short-lived JWT — expires in 15 minutes (configured via JWT_EXPIRATION) */
  accessToken!: string;
  /** Long-lived JWT — expires in 7 days (configured via JWT_REFRESH_EXPIRATION) */
  refreshToken!: string;
}
