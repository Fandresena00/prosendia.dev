"use client";

/**
 * @file src/app/(callback)/google/callback/page.tsx
 *
 * Page de transition affichée pendant que le backend traite le callback Google.
 *
 * Deux cas d'usage :
 *
 * ── CAS 1 (recommandé, simple) ───────────────────────────────────────────────
 * GOOGLE_CALLBACK_URL = https://prosendiaia-api.fadevt.org/auth/google/callback
 * Le backend set les cookies PUIS redirige directement vers /dashboard.
 * → Cette page n'est jamais affichée en succès.
 * → Elle s'affiche uniquement si ?error=google_auth_failed (échec Google).
 *
 * ── CAS 2 (alternatif) ───────────────────────────────────────────────────────
 * Si tu veux que le backend redirige vers cette page frontend :
 * GOOGLE_CALLBACK_URL = https://prosendia-ai.fadevt.org/google-callback
 * → Le backend doit retourner un token temporaire dans l'URL.
 * → Cette page appelle initializeAuth() pour hydrater le store.
 *
 * Pour le CAS 1 (défaut), place cette page à :
 * Et ajoute dans ton middleware/router :
 *   /sign-in?error=google_auth_failed → affiche l'erreur sur la page sign-in
 */

import { ProsendiaLogo } from "@/components/shared/prosendia-logo";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { EASE } from "@/lib/motion";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function GoogleCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { initializeAuth } = useAuthStore();
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const error = searchParams.get("error");

    if (error) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasError(true);
      setTimeout(() => {
        router.replace("/sign-in?error=google_auth_failed");
      }, 1500);
      return;
    }

    // Le backend a set les cookies — on hydrate le store puis on redirige
    initializeAuth()
      .then(() => {
        router.replace("/dashboard");
      })
      .catch(() => {
        setHasError(true);
        setTimeout(() => router.replace("/sign-in"), 1500);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        <ProsendiaLogo size={10} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: EASE }}
        className="flex flex-col items-center gap-3"
      >
        {!hasError ? (
          <>
            <div className="h-6 w-6 rounded-full border-2 border-border border-t-primary animate-spin" />
            <p className="text-[13px] text-muted-foreground">
              Connexion avec Google en cours…
            </p>
          </>
        ) : (
          <>
            <p className="text-[13px] text-destructive font-medium">
              La connexion avec Google a échoué.
            </p>
            <p className="text-[12px] text-muted-foreground">
              Redirection en cours…
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}
