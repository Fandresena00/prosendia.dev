"use client";

// app/(login)/page.tsx — Login page, Linear dark style

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminApiError, adminAuthApi } from "@/lib/admin-api";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.SubmitEvent) {
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
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4">
      {/* Grid texture */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      {/* Gradient overlay */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_40%,transparent_30%,hsl(var(--background))_100%)]" />
      {/* Purple glow */}
      <div className="pointer-events-none fixed left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/8 blur-3xl" />

      <div className="relative z-10 w-full max-w-85">
        {/* Logo */}
        <div className="mb-10 flex flex-col items-center">
          <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="hsl(var(--primary))"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className="text-[22px] font-semibold tracking-tight">
            VendeoAI Admin
          </h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            Accès réservé aux administrateurs
          </p>
        </div>

        {/* Form */}
        <div className="rounded-xl border border-border bg-card/80 backdrop-blur-sm">
          <div className="p-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="py-2.5 text-xs">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground"
                >
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@vendeoai.com"
                  className="h-9 bg-background/60 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground"
                >
                  Mot de passe
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPwd ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••"
                    className="h-9 bg-background/60 pr-9 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                  >
                    {showPwd ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="h-9 w-full text-sm font-medium"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Connexion…
                  </>
                ) : (
                  "Se connecter"
                )}
              </Button>
            </form>
          </div>
          <div className="border-t border-border/50 px-5 py-3 text-center">
            <p className="text-[11px] text-muted-foreground/30">
              Session chiffrée · Accès restreint
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground/20">
          VendeoAI © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
