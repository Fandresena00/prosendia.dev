"use client";

import { handleOAuthCallback } from "@/features/facebook-page/services/facebook.service";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function FacebookCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state"); // businessProfileId

    if (!code) {
      router.push("/facebook-page");
      return;
    }

    // 1. Exchange the code via authenticated POST
    handleOAuthCallback(code, state || "default-profile-id")
      .then((data) => {
        // 2. Store pages for the AddPageDialog
        sessionStorage.setItem("fb_oauth_pages", JSON.stringify(data.pages));
        // 3. Redirect to main page with success flag
        router.push("/facebook-page?oauth=ok");
      })
      .catch((err) => {
        console.error("OAuth callback failed", err);
        setError(
          err instanceof Error ? err.message : "Une erreur est survenue",
        );
        // Optionally redirect with error after a short delay
        setTimeout(() => router.push("/facebook-page?oauth=error"), 3000);
      });
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      {error ? (
        <>
          <p className="text-red-500 font-semibold">Erreur de connexion</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <p className="text-xs text-muted-foreground">Redirection en cours…</p>
        </>
      ) : (
        <>
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Connexion Facebook en cours…</p>
        </>
      )}
    </div>
  );
}
