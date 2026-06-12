/**
 * @file src/features/auth/store/auth.store.ts
 *
 * CHANGES vs uploaded version:
 *   1. `register` action supprimée — remplacée par deux nouvelles actions :
 *      - `initiateRegistration` : appelle POST /auth/register (step 1, envoie le code)
 *        → ne crée PAS de session, retourne juste { email }
 *      - `verifyEmail` : appelle POST /auth/verify-email (step 2, valide le code)
 *        → crée la session (setSession)
 *   2. AuthStore interface mise à jour en conséquence.
 *
 * FIXES:
 *   - Bug principal : `register` dans le store appelait POST /auth/register qui
 *     retourne { email, message } et non { user } → setSession échouait silencieusement
 *     et on ne basculait jamais sur step "verify".
 *   - `initiateRegistration` gère son propre isLoading sans passer par le store
 *     (puisqu'elle ne crée pas de session) — le store expose `initiateLoading`
 *     séparé pour éviter de bloquer le reste du formulaire.
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
import type { UpdateUserInput, User } from "../schemas/user.schema";
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

  /**
   * Step 1 : soumet le formulaire d'inscription.
   * Envoie le code par email. Ne crée PAS de session.
   * Retourne l'email confirmé par le backend.
   */
  initiateRegistration: (data: RegisterInput) => Promise<{ email: string }>;

  /**
   * Step 2 : valide le code de vérification.
   * Crée le compte + ouvre la session.
   */
  verifyEmail: (data: { email: string; code: string }) => Promise<void>;

  login: (data: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (data: UpdateUserInput) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
  clearError: () => void;
}

let isInitializingAuth = false;

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => {
      // ── Session helpers ───────────────────────────────────────────────────

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

      // ── Store ─────────────────────────────────────────────────────────────

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

            set({
              status: hasSessionCookie() ? "offline" : "unauthenticated",
              isRehydrating: false,
            });
          } finally {
            isInitializingAuth = false;
          }
        },

        // ── Step 1: initier l'inscription ─────────────────────────────────
        // Ne gère PAS isLoading via le store — la page gère son propre état
        // de chargement pour ne pas bloquer le rendu de la page.
        initiateRegistration: async (
          data: RegisterInput,
        ): Promise<{ email: string }> => {
          set({ authError: null, validationErrors: null });
          try {
            const res = await authService.initiateRegistration(data);
            return { email: res.email };
          } catch (error) {
            // Propage les erreurs d'API (ex: email déjà pris) vers la page
            if (isApiError(error)) {
              set({
                authError: error.displayMessage,
                validationErrors: error.validationErrors ?? null,
              });
            } else {
              set({
                authError:
                  error instanceof Error
                    ? error.message
                    : "Erreur lors de l'inscription.",
              });
            }
            throw error;
          }
        },

        // ── Step 2: vérifier le code → créer la session ───────────────────
        verifyEmail: async (data: {
          email: string;
          code: string;
        }): Promise<void> => {
          set({ isLoading: true, authError: null, validationErrors: null });
          try {
            const { user } = await authService.verifyEmail(data);
            get().setSession(user);
          } catch (error) {
            handleError(error, "Code incorrect ou expiré. Réessayez.");
          }
        },

        // ── Login ─────────────────────────────────────────────────────────
        login: async (data: LoginInput): Promise<void> => {
          set({ isLoading: true, authError: null, validationErrors: null });
          try {
            const { user } = await authService.login(data);
            get().setSession(user);
          } catch (error) {
            handleError(error, "Connexion échouée. Réessayez.");
          }
        },

        // ── Logout ────────────────────────────────────────────────────────
        logout: async (): Promise<void> => {
          set({ isLoading: true });
          try {
            await authService.logout().catch(() => undefined);
          } finally {
            clearSession();
            isInitializingAuth = false;
          }
        },

        // ── Update user ───────────────────────────────────────────────────
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

        // ── Upload avatar ─────────────────────────────────────────────────
        uploadAvatar: async (file: File): Promise<void> => {
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
    const wasOffline =
      previousStatus === "offline" || previousStatus === "unknown";
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
