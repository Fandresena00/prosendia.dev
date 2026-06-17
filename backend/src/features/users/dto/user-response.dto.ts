/**
 * @file src/features/users/dto/user-response.dto.ts
 * CHANGE: Added avatarSource (LOCAL | GOOGLE) so the frontend can show
 * whether the current photo is synced from Google or manually uploaded.
 */

import type {
  AuthProvider,
  AvatarSource,
  Plan,
} from '../../../generated/prisma/client.js';

export class UserResponseDto {
  id!: string;
  email!: string;
  username!: string;
  avatarUrl!: string | null;
  /** LOCAL = uploadée manuellement, GOOGLE = synchronisée depuis le profil Google */
  avatarSource!: AvatarSource;
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
