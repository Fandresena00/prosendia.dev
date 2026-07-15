"use client";

/**
 * @file src/app/(auth)/reset-password/page.tsx
 * Redesigned: PasswordInput toggle + real-time rules + StrengthBar.
 */

import { ThemeSwitcher } from "@/components/shared/theme-switcher";
import { ProsendiaLogo } from "@/components/shared/prosendia-logo";
import { Button } from "@/components/ui/button";
import { EASE, fadeUp } from "@/lib/motion";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle, Lock } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { StrengthBar } from "../components/reset-password/strength-bar";
import {
  AuthDotGrid,
  AuthRadialGlow,
} from "../components/shared/auth-background";
import { PasswordInput, PasswordRequirements } from "../components/shared/password-field";

const PASSWORD_RULES = [
  { test: (v: string) => v.length >= 8 },
  { test: (v: string) => /[A-Z]/.test(v) },
  { test: (v: string) => /[a-z]/.test(v) },
  { test: (v: string) => /\d/.test(v) },
  { test: (v: string) => /[^A-Za-z0-9]/.test(v) },
];

function isStrongEnough(v: string): boolean {
  return PASSWORD_RULES.every((r) => r.test(v));
}

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const strong = isStrongEnough(password);
  const matches = password === confirmPassword && password.length > 0;
  const canSubmit = strong && matches;

  const handleReset = () => {
    if (!canSubmit) return;
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setSubmitted(true);
    }, 1400);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-6 bg-background">
      <AuthDotGrid />
      <AuthRadialGlow />
      <div className="fixed right-4 top-4 z-50">
        <ThemeSwitcher />
      </div>

      <div className="relative z-10 w-full max-w-[360px]">
        <motion.div {...fadeUp(0)} className="mb-8 flex items-center gap-2">
          <ProsendiaLogo size={7} />
          <span className="text-sm font-bold">prosendia</span>
        </motion.div>

        {!submitted ? (
          <>
            <motion.div {...fadeUp(0.06)} className="mb-7 space-y-2">
              <div
                className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10"
                style={{ boxShadow: "0 0 18px oklch(0.52 0.24 256 / 12%)" }}
              >
                <Lock className="h-5 w-5 text-primary" />
              </div>
              <h1 className="text-[1.55rem] font-bold tracking-tight">
                Nouveau mot de passe
              </h1>
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                Créez un mot de passe sécurisé pour votre compte.
              </p>
            </motion.div>

            <motion.div {...fadeUp(0.12)} className="space-y-4">
              {/* New password */}
              <div className="space-y-1.5">
                <PasswordInput
                  label="Nouveau mot de passe"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
                {password.length > 0 && (
                  <>
                    <StrengthBar password={password} />
                    <PasswordRequirements value={password} className="mt-1" />
                  </>
                )}
              </div>

              {/* Confirm password */}
              <div className="space-y-1.5">
                <PasswordInput
                  label="Confirmer le mot de passe"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
                {confirmPassword.length > 0 && (
                  <div className={`flex items-center gap-1.5 text-[11px] ${matches ? "text-emerald-400" : "text-rose-400"}`}>
                    <span>{matches ? "✓" : "✗"}</span>
                    {matches ? "Les mots de passe correspondent" : "Les mots de passe ne correspondent pas"}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-primary">Conseil :</span>{" "}
                  Utilisez majuscules, minuscules, chiffres et symboles pour un mot de passe solide.
                </p>
              </div>

              <Button
                disabled={!canSubmit || isLoading}
                className="w-full h-9 gap-2 text-[13px] font-semibold disabled:opacity-40"
                style={{ boxShadow: canSubmit ? "0 4px 16px oklch(0.52 0.24 256 / 24%)" : "none" }}
                onClick={handleReset}
              >
                {isLoading ? (
                  <>
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-transparent border-t-current animate-spin" />
                    Réinitialisation…
                  </>
                ) : (
                  <>
                    <Lock className="h-3.5 w-3.5" />
                    Réinitialiser le mot de passe
                  </>
                )}
              </Button>
            </motion.div>

            <motion.div {...fadeUp(0.18)}>
              <Link
                href="/sign-in"
                className="mt-6 flex items-center justify-center gap-2 text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Retour à la connexion
              </Link>
            </motion.div>
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.97, filter: "blur(4px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.5, ease: EASE }}
            className="space-y-7 text-center"
          >
            <div className="space-y-3">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.4, type: "spring", stiffness: 220, delay: 0.1 }}
                className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10"
                style={{ boxShadow: "0 0 20px oklch(0.5 0.15 155 / 15%)" }}
              >
                <CheckCircle className="h-7 w-7 text-emerald-400" />
              </motion.div>
              <div>
                <h2 className="text-[1.4rem] font-bold">Mot de passe mis à jour !</h2>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                  Votre mot de passe a été changé avec succès. Vous pouvez maintenant vous connecter.
                </p>
              </div>
            </div>
            <Link href="/sign-in" className="block">
              <Button
                className="w-full h-9 gap-2 text-[13px] font-semibold"
                style={{ boxShadow: "0 4px 16px oklch(0.52 0.24 256 / 24%)" }}
              >
                Aller à la connexion
                <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
              </Button>
            </Link>
          </motion.div>
        )}
      </div>
    </div>
  );
}
