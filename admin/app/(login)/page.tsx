"use client";

// app/login/page.tsx

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
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      {/* Background dot grid */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "radial-gradient(circle, #ffffff 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative w-full max-w-90">
        {/* Logo + heading */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="#10b981"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className="text-[15px] font-semibold tracking-tight text-zinc-100">
            VendeoAI Admin
          </h1>
          <p className="mt-1 text-[13px] text-zinc-500">
            Accès réservé aux administrateurs
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert
                variant="destructive"
                className="border-red-900/50 bg-red-950/50 text-red-400 [&>svg]:text-red-400"
              >
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-[13px]">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label
                htmlFor="email"
                className="text-[12px] font-medium text-zinc-400"
              >
                Adresse email
              </Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@vendeoai.com"
                className="h-9 border-zinc-800 bg-zinc-950 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus-visible:border-emerald-500/50 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="password"
                className="text-[12px] font-medium text-zinc-400"
              >
                Mot de passe
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  className="h-9 border-zinc-800 bg-zinc-950 pr-9 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus-visible:border-emerald-500/50 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-1 h-9 w-full bg-emerald-600 text-[13px] font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
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

        <p className="mt-4 text-center text-[11px] text-zinc-700">
          VendeoAI · Panel d&apos;administration
        </p>
      </div>
    </div>
  );
}
