/**
 * @file src/features/auth/store/auth.store.ts
 *
 * FIX: Added a module-level `isInitializingAuth` lock inside `initializeAuth`.
 * Previously, two concurrent callers (useSessionInit + useNetworkRecovery)
 * could both run `initializeAuth` simultaneously, causing two `GET /auth/me`
 * requests and two state transitions — the double 401 seen in the server logs.
 *
 * The lock is module-level (not Zustand state) so it works across all callers
 * without triggering re-renders.
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  isApiError,
  isAuthenticationError,
  isNetworkError,
} from "@/lib/errors";
import { networkMonitor } from "@/lib/network-monitor";
import {
  clearSessionCookie,
  hasSessionCookie,
  setSessionCookie,
} from "@/lib/session-cookie";
import type { LoginInput, RegisterInput } from "../schemas/auth.schema";
import { UpdateUserInput, User } from "../schemas/user.schema";
import { authService } from "../services/auth.service";
import { userService } from "../services/user.service";

export type AuthStatus =
  | "loading"
  | "authenticated"
  | "unauthenticated"
  | "offline";

export interface AuthStore {
  user: User | null;
  status: AuthStatus;
  isRehydrating: boolean;
  isLoading: boolean;
  authError: string | null;
  validationErrors: string[] | null;

  initializeAuth: () => Promise<void>;
  setSession: (user: User) => void;
  handleAuthError: (error: unknown) => void;
  login: (data: LoginInput) => Promise<void>;
  register: (data: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (data: UpdateUserInput) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
  clearError: () => void;
}

/**
 * Module-level concurrency lock for initializeAuth.
 * Prevents two simultaneous /auth/me calls when useSessionInit and
 * useNetworkRecovery both call initializeAuth at the same time on mount.
 */
let isInitializingAuth = false;

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => {
      const clearSession = (): void => {
        clearSessionCookie();
        set({
          user: null,
          status: "unauthenticated",
          isLoading: false,
          isRehydrating: false,
          authError: null,
          validationErrors: null,
        });
      };

      const handleError = (error: unknown, fallback: string): never => {
        if (isAuthenticationError(error)) {
          clearSession();
          throw error;
        }
        if (isNetworkError(error)) {
          set({ status: "offline", isLoading: false, isRehydrating: false });
          throw error;
        }
        if (isApiError(error)) {
          set({
            authError: error.displayMessage,
            validationErrors: error.validationErrors ?? null,
            isLoading: false,
          });
          throw error;
        }
        set({
          authError: error instanceof Error ? error.message : fallback,
          validationErrors: null,
          isLoading: false,
        });
        throw error;
      };

      return {
        user: null,
        status: "loading",
        isRehydrating: true,
        isLoading: false,
        authError: null,
        validationErrors: null,

        setSession: (user: User): void => {
          setSessionCookie();
          set({
            user,
            status: "authenticated",
            isRehydrating: false,
            isLoading: false,
            authError: null,
            validationErrors: null,
          });
        },

        handleAuthError: (error: unknown): void => {
          if (isAuthenticationError(error)) {
            clearSession();
            return;
          }
          if (isNetworkError(error)) {
            set({ status: "offline" });
            return;
          }
        },

        initializeAuth: async (): Promise<void> => {
          // FIX: Prevent concurrent calls — e.g. useSessionInit + useNetworkRecovery
          // both calling initializeAuth at mount time. Without this lock, we get
          // two simultaneous GET /auth/me requests (the double 401 in server logs).
          if (isInitializingAuth) return;

          const { status } = get();
          if (status === "authenticated") return;

          isInitializingAuth = true;
          set({ status: "loading", isRehydrating: true });

          try {
            const user = await authService.getProfile();
            get().setSession(user);
          } catch (error) {
            const potentialSession = Boolean(get().user) || hasSessionCookie();

            if (
              isNetworkError(error) ||
              (isApiError(error) && error.isServerError)
            ) {
              set({
                status: potentialSession ? "offline" : "unauthenticated",
                isRehydrating: false,
              });
              return;
            }

            if (isAuthenticationError(error)) {
              clearSession();
              return;
            }

            // 401/403: confirmed no session
            set({
              status: hasSessionCookie() ? "offline" : "unauthenticated",
              isRehydrating: false,
            });
          } finally {
            // Always release the lock so future calls (e.g. after logout + login)
            // can run initializeAuth again
            isInitializingAuth = false;
          }
        },

        login: async (data: LoginInput): Promise<void> => {
          set({ isLoading: true, authError: null, validationErrors: null });
          try {
            const { user } = await authService.login(data);
            get().setSession(user);
          } catch (error) {
            handleError(error, "Login failed. Please try again.");
          }
        },

        register: async (data: RegisterInput): Promise<void> => {
          set({ isLoading: true, authError: null, validationErrors: null });
          try {
            const { user } = await authService.register(data);
            get().setSession(user);
          } catch (error) {
            handleError(error, "Registration failed. Please try again.");
          }
        },

        logout: async (): Promise<void> => {
          set({ isLoading: true });
          try {
            await authService.logout().catch(() => undefined);
          } finally {
            clearSession();
            // Reset the lock on logout so the next login can re-initialize
            isInitializingAuth = false;
          }
        },

        updateUser: async (data: UpdateUserInput): Promise<void> => {
          const { user } = get();
          if (!user) throw new Error("No authenticated session.");
          set({ isLoading: true, authError: null, validationErrors: null });
          try {
            const updated = await userService.updateUser(user.id, data);
            set({ user: updated, isLoading: false });
          } catch (error) {
            handleError(error, "Failed to update profile. Please try again.");
          }
        },

        uploadAvatar: async (file: File) => {
          const user = get().user;
          if (!user) throw new Error("No session");
          const updated = await userService.uploadAvatar(user.id, file);
          set({ user: updated });
        },

        clearError: (): void => {
          set({ authError: null, validationErrors: null });
        },
      };
    },
    {
      name: "auth-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ user: state.user }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.status = "loading";
          state.isRehydrating = true;
          state.isLoading = false;
          state.authError = null;
          state.validationErrors = null;
        }
      },
    },
  ),
);

export const useCurrentUser      = () => useAuthStore((s) => s.user);
export const useAuthStatus       = () => useAuthStore((s) => s.status);
export const useIsAuthenticated  = () => useAuthStore((s) => s.status === "authenticated");
export const useIsOffline        = () => useAuthStore((s) => s.status === "offline");
export const useAuthLoading      = () => useAuthStore((s) => s.isLoading);
export const useIsRehydrating    = () => useAuthStore((s) => s.isRehydrating);
export const useAuthError        = () => useAuthStore((s) => s.authError);
export const useValidationErrors = () => useAuthStore((s) => s.validationErrors);

export function subscribeToNetworkRecovery(): () => void {
  let previousStatus = networkMonitor.getStatus();
  return networkMonitor.subscribe((networkStatus) => {
    const wasOffline = previousStatus === "offline" || previousStatus === "unknown";
    const isNowOnline = networkStatus === "online";
    previousStatus = networkStatus;
    if (wasOffline && isNowOnline) {
      const { status, initializeAuth } = useAuthStore.getState();
      if (status === "offline" || status === "loading") {
        void initializeAuth();
      }
    }
    if (networkStatus === "offline") {
      const { status } = useAuthStore.getState();
      if (status === "authenticated") {
        useAuthStore.setState({ status: "offline" });
      }
    }
  });
}
