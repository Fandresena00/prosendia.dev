/**
 * @file src/features/auth/services/auth.service.ts
 *
 * CHANGES:
 *   - register() → renommé initiateRegistration() — appelle POST /auth/register
 *     et retourne { email, message }, PAS de session (pas de cookies encore)
 *   - verifyEmail() — NOUVEAU — appelle POST /auth/verify-email, crée la session
 *   - resendVerification() — NOUVEAU — appelle POST /auth/resend-verification
 */

import { User } from "@/features/auth/schemas/user.schema";
import { apiClient } from "@/lib/api-client";
import type { LoginInput, RegisterInput } from "../schemas/auth.schema";
import type { AuthResponse } from "../types/auth.types";

const BASE = "/auth" as const;

export const authService = {
  getProfile(): Promise<User> {
    return apiClient<User>(`${BASE}/me`);
  },

  login(data: LoginInput): Promise<AuthResponse> {
    return apiClient<AuthResponse>(`${BASE}/login`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Step 1 — envoie le formulaire, déclenche l'envoi du code email.
   * Ne crée PAS le compte. Ne set PAS de cookie.
   * Retourne { email, message }.
   */
  initiateRegistration(
    data: RegisterInput,
  ): Promise<{ email: string; message: string }> {
    return apiClient<{ email: string; message: string }>(`${BASE}/register`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Step 2 — valide le code, crée le compte, set les cookies HttpOnly.
   * Retourne { user } → on peut ouvrir la session.
   */
  verifyEmail(data: {
    email: string;
    code: string;
  }): Promise<AuthResponse> {
    return apiClient<AuthResponse>(`${BASE}/verify-email`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Renvoie un nouveau code de vérification pour l'email donné.
   */
  resendVerification(email: string): Promise<{ message: string }> {
    return apiClient<{ message: string }>(`${BASE}/resend-verification`, {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  logout(): Promise<void> {
    return apiClient<void>(`${BASE}/logout`, {
      method: "POST",
      skipRefresh: true,
    });
  },
};
