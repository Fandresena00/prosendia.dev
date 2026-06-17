/**
 * @file features/settings/types/settings.types.ts
 */

export type AvatarSource = "LOCAL" | "GOOGLE";

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ResendVerificationPayload {
  email: string;
}

export interface ApiMessageResponse {
  message: string;
}
