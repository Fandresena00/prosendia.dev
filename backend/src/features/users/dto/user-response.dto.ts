/**
 * @file src/features/users/dto/user-response.dto.ts
 * @description Shape returned by ALL user-facing endpoints.
 * This DTO is the single source of truth for what a "public user" looks like.
 *
 * Security contract: NEVER include sensitive fields here (password, refresh
 * tokens, providerId). Any field added here is exposed to API consumers.
 */

import type { AuthProvider, Plan } from '../../../generated/prisma/client.js';

export class UserResponseDto {
  id!: string;
  email!: string;
  username!: string;
  /** Null when the user has not uploaded an avatar yet */
  avatarUrl!: string | null;
  activePlan!: Plan;
  provider!: AuthProvider;
  onboardingDone!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
}
