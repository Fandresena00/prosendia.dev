/**
 * @file src/features/users/schemas/user.schema.ts
 * CHANGE: Added emailVerified + emailVerifiedAt fields.
 */

import { z } from "zod";

export const PlanSchema = z.enum(["FREE", "STARTER", "PRO", "CUSTOM"]);
export const ProviderSchema = z.enum(["LOCAL", "GOOGLE", "FACEBOOK"]);

export const UserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  username: z.string(),
  avatarUrl: z.url().nullable(),
  avatarSource: z.enum(["LOCAL", "GOOGLE"]),
  activePlan: PlanSchema,
  provider: ProviderSchema,
  providerId: z.string().nullable().default(null),
  onboardingDone: z.boolean(),
  /** True once the user has confirmed their email address */
  emailVerified: z.boolean(),
  /** ISO string or null */
  emailVerifiedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const UpdateUserSchema = z.object({
  username: z.string().min(3).max(30).optional(),
  email: z.email().optional(),
  avatarUrl: z.url().nullable().optional(),
  activePlan: PlanSchema.optional(),
  onboardingDone: z.boolean().optional(),
});

export type User = z.infer<typeof UserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type Plan = z.infer<typeof PlanSchema>;
export type AuthProvider = z.infer<typeof ProviderSchema>;
