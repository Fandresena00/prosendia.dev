/**
 * @file src/features/users/dto/user-response.dto.ts
 * CHANGE: Added emailVerified + emailVerifiedAt.
 */

import type { AuthProvider, Plan } from '../../../generated/prisma/client.js';

export class UserResponseDto {
  id!: string;
  email!: string;
  username!: string;
  avatarUrl!: string | null;
  activePlan!: Plan;
  provider!: AuthProvider;
  onboardingDone!: boolean;
  /** True once the user has confirmed their email address */
  emailVerified!: boolean;
  /** Timestamp of first successful email verification */
  emailVerifiedAt!: Date | null;
  createdAt!: Date;
  updatedAt!: Date;
}
