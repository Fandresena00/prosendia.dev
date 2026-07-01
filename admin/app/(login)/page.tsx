"use client";

// app/page.tsx — Login page, émeraude accent

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
      {/* Emerald glow */}
      <div className="pointer-events-none fixed left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/5 blur-3xl" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_40%,transparent_30%,hsl(var(--background))_100%)]" />

      <div className="relative z-10 w-full max-w-85">
        {/* Logo */}
        <div className="mb-10 flex flex-col items-center">
          <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="oklch(0.70 0.18 162)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className="text-[22px] font-semibold tracking-tight">
            VendeoAI Admin
          </h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground/50">
            Accès réservé aux administrateurs
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm shadow-xl shadow-black/10">
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
                  className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50"
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
                  className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50"
                >
                  Mot de passe
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPwd ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••"
                    className="h-9 bg-background/60 pr-9 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/30 hover:text-muted-foreground transition-colors"
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
                className="h-9 w-full text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white border-0"
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
          <div className="border-t border-border/40 px-5 py-3 text-center">
            <p className="text-[10px] text-muted-foreground/25">
              Session chiffrée · Accès restreint
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-[10px] text-muted-foreground/20">
          VendeoAI © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
