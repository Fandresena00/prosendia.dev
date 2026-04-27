/**
 * @file features/auth/auth.schema.ts
 * @description Zod schemas for auth form validation. Unchanged from previous version.
 */

import { z } from "zod";

export const LoginSchema = z.object({
  email: z.email({ message: "Invalid email address" }),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const RegisterSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be at most 20 characters"),
  email: z.email({ message: "Invalid email address" }),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
