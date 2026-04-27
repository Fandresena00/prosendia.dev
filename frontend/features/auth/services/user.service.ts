/**
 * @file src/features/users/user.service.ts
 * @description API layer for user endpoints.
 * Token injection is handled by the browser (HttpOnly cookies).
 * No Authorization header, no token params.
 */

import { apiClient } from "@/lib/api-client";
import { UpdateUserInput, User, UserSchema } from "../schemas/user.schema";

const BASE = "/users" as const;

export const userService = {
  async updateUser(userId: string, data: UpdateUserInput) {
    const response = await apiClient(`${BASE}/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });

    // 🔥 validation runtime
    return UserSchema.parse(response);
  },
  async uploadAvatar(userId: string, file: File): Promise<User> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await apiClient<User>(`/users/${userId}/avatar`, {
      method: "POST",
      body: formData,
      // Ne pas mettre Content-Type, fetch le définit automatiquement avec la boundary
    });
    return UserSchema.parse(response);
  },
};
