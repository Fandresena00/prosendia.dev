"use client";

// app/login/page.tsx
//
// • Utilise les tokens shadcn natifs via globals.css — zéro override inline
// • Layout centré plein écran, dot-grid via before: pseudo

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminApiError, adminAuthApi } from "@/lib/admin-api";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await adminAuthApi.login(email, password);
      router.push("/dashboard");
    } catch (err) {
      setError(
        err instanceof AdminApiError ? err.message : "Erreur de connexion.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    /*
     * bg-background + dot grid décoratif via inline style.
     * On n'override pas les tokens — background est défini dans globals.css.
     */
    <div
      className="relative flex min-h-screen items-center justify-center bg-background px-4"
      style={{
        backgroundImage:
          "radial-gradient(hsl(var(--border)) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }}
    >
      {/* Vignette qui fade les bords du dot grid */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_50%,transparent_40%,hsl(var(--background))_100%)]" />

      <div className="relative z-10 w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="hsl(var(--primary))"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-semibold">VendeoAI Admin</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Accès réservé aux administrateurs
            </p>
          </div>
        </div>

        {/* Form card */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">Adresse email</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@vendeoai.com"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPwd ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  className="pr-10"
                />
                <button
                  type="button"
                  aria-label={showPwd ? "Masquer" : "Afficher"}
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPwd ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? "Connexion…" : "Se connecter"}
            </Button>
          </form>
        </div>

        <p className="mt-5 text-center text-xs text-muted-foreground/40">
          VendeoAI · Panneau d&apos;administration
        </p>
      </div>
    </div>
  );
}
