/**
 * @file features/users/user.schema.ts
 * @description Zod schemas and inferred types for the User domain.
 * Single source of truth — import User type from here everywhere.
 */

import { z } from "zod";

export const PlanSchema = z.enum(["FREE", "PRO", "ENTERPRISE"]);
export const ProviderSchema = z.enum(["LOCAL", "GOOGLE", "FACEBOOK"]);

export const UserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  username: z.string(),
  avatarUrl: z.url().nullable(), // mieux : string + url
  activePlan: PlanSchema,
  provider: ProviderSchema,
  providerId: z.string().nullable().default(null),
  onboardingDone: z.boolean(),
  createdAt: z.string(), // ← ajoutez les parenthèses
  updatedAt: z.string(),
});
export const UpdateUserSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be at most 30 characters")
    .optional(),
  email: z.email({ message: "Invalid email address" }).optional(),
  avatarUrl: z.url({ message: "Invalid URL" }).nullable().optional(),
  activePlan: PlanSchema.optional(),
  onboardingDone: z.boolean().optional(),
});

export type User = z.infer<typeof UserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type Plan = z.infer<typeof PlanSchema>;
export type AuthProvider = z.infer<typeof ProviderSchema>;
