/**
 * @file features/auth/auth.service.ts
 * @description API layer for auth endpoints. No token params — cookies are automatic.
 */

import { User } from "@/features/auth/schemas/user.schema";
import { apiClient } from "@/lib/api-client";
import { LoginInput, RegisterInput } from "../schemas/auth.schema";
import { AuthResponse } from "../types/auth.types";

const BASE = "/auth" as const;

export const authService = {
  /**
   * GET /users/me — requires valid access token cookie.
   * Called by restoreSession() and on-demand for profile refresh.
   */
  getProfile(): Promise<User> {
    return apiClient<User>(`${BASE}/me`);
  },

  login(data: LoginInput): Promise<AuthResponse> {
    return apiClient<AuthResponse>(`${BASE}/login`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  register(data: RegisterInput): Promise<AuthResponse> {
    return apiClient<AuthResponse>(`${BASE}/register`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * skipRefresh: true — prevents the 401 → refresh → retry loop on logout.
   * If the session is already expired when logout is called, we still clear locally.
   */
  logout(): Promise<void> {
    return apiClient<void>(`${BASE}/logout`, {
      method: "POST",
      skipRefresh: true,
    });
  },

  verifyEmail(data: { email: string; code: string }): Promise<AuthResponse> {
    return apiClient<AuthResponse>(`${BASE}/verify-email`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  resendVerification(email: string): Promise<{ message: string }> {
    return apiClient<{ message: string }>(`${BASE}/resend-verification`, {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },
};
