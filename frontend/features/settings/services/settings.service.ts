/**
 * @file features/settings/services/settings.service.ts
 *
 * NOTE IMPORTANTE : ce fichier utilise un petit wrapper fetch autonome
 * (credentials: "include" pour envoyer les cookies httpOnly cross-origin
 * vers vendeoia-api.fadevt.org). Si le projet a déjà un client HTTP partagé
 * (ex. une instance axios avec intercepteurs de refresh token, utilisée par
 * le auth.store.ts pour login/register/updateUser), remplace les appels
 * `request(...)` ci-dessous par ce client pour rester cohérent partout.
 * Donne-moi ce fichier si tu veux que je fasse le branchement exact.
 */

import type {
  ApiMessageResponse,
  ChangePasswordPayload,
} from "../types/settings.types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
const HTTP_NO_CONTENT = 204;

interface ApiErrorShape {
  message?: string | string[];
  error?: string;
  statusCode?: number;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (!res.ok) {
    let body: ApiErrorShape = {};
    try {
      body = await res.json();
    } catch {
      // pas de corps JSON dans la réponse d'erreur
    }
    const message = Array.isArray(body.message)
      ? body.message.join(" ")
      : body.message ?? "Une erreur est survenue. Réessayez.";
    throw new Error(message);
  }

  if (res.status === HTTP_NO_CONTENT) return undefined as T;
  return (await res.json()) as T;
}

export const settingsService = {
  /** PATCH /users/:id/change-password */
  changePassword(userId: string, payload: ChangePasswordPayload): Promise<void> {
    return request<void>(`/users/${userId}/change-password`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  /** POST /auth/resend-verification */
  resendVerificationEmail(email: string): Promise<ApiMessageResponse> {
    return request<ApiMessageResponse>(`/auth/resend-verification`, {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  /** POST /auth/logout-all — révoque toutes les sessions, tous appareils */
  logoutAllDevices(): Promise<void> {
    return request<void>(`/auth/logout-all`, { method: "POST" });
  },
};
