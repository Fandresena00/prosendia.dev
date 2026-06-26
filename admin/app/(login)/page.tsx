"use client";

// app/login/page.tsx — ou app/page.tsx selon structure
// Design : centré, dot-grid, card épurée, typographie soignée

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminApiError, adminAuthApi } from "@/lib/admin-api";
import { AlertCircle, Eye, EyeOff, Layers, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
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
    <div
      className="relative flex min-h-screen items-center justify-center bg-background px-4"
      style={{
        backgroundImage:
          "radial-gradient(hsl(var(--border)) 1px, transparent 1px)",
        backgroundSize: "28px 28px",
      }}
    >
      {/* Vignette radiale */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_70%_70%_at_50%_50%,transparent_30%,hsl(var(--background))_100%)]" />

      <div className="relative z-10 w-full max-w-90">
        {/* Brand */}
        <div className="mb-10 flex flex-col items-center gap-4 text-center">
          <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/25 shadow-sm">
            <Layers className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              VendeoAI Admin
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              Accès réservé aux administrateurs
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card shadow-xl shadow-black/5 dark:shadow-black/30">
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <Alert variant="destructive" className="py-3">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
                >
                  Adresse email
                </Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@vendeoai.com"
                  className="h-10 bg-background/50"
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="password"
                  className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
                >
                  Mot de passe
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPwd ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••"
                    className="h-10 bg-background/50 pr-10"
                  />
                  <button
                    type="button"
                    aria-label={showPwd ? "Masquer" : "Afficher"}
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 transition-colors hover:text-foreground"
                  >
                    {showPwd ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="h-10 w-full font-medium"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connexion en cours…
                  </>
                ) : (
                  "Se connecter"
                )}
              </Button>
            </form>
          </div>

          {/* Card footer */}
          <div className="border-t border-border px-6 py-3">
            <p className="text-center text-xs text-muted-foreground/50">
              Session sécurisée · Accès limité aux admins
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground/30">
          VendeoAI © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
