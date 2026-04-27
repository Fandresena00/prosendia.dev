"use client";

import { ThemeSwitcher } from "@/components/shared/theme-switcher";
import { VendeoLogo } from "@/components/shared/vendeo-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EASE, fadeUp } from "@/lib/motion";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle, Mail } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  AuthDotGrid,
  AuthRadialGlow,
} from "../components/shared/auth-background";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="relative min-h-screen flex items-center justify-center p-6 bg-background">
      <AuthDotGrid />
      <AuthRadialGlow />
      <div className="fixed right-4 top-4 z-50">
        <ThemeSwitcher />
      </div>

      <div className="relative z-10 w-full max-w-90">
        <motion.div {...fadeUp(0)} className="mb-8 flex items-center gap-2">
          <VendeoLogo size={7} />
          <span className="text-sm font-bold">VendeoAI</span>
        </motion.div>

        {!submitted ? (
          <>
            <motion.div {...fadeUp(0.06)} className="mb-7 space-y-2">
              <div
                className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10"
                style={{ boxShadow: "0 0 18px oklch(0.52 0.24 256 / 14%)" }}
              >
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <h1 className="text-[1.55rem] font-bold tracking-tight">
                Mot de passe oublié ?
              </h1>
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                Entrez votre email et nous vous enverrons un lien pour
                réinitialiser votre mot de passe.
              </p>
            </motion.div>

            <motion.div {...fadeUp(0.12)} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[12px] font-medium">Adresse email</Label>
                <Input
                  type="email"
                  placeholder="vous@exemple.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-9 text-[13px]"
                  onKeyDown={(e) => e.key === "Enter" && setSubmitted(true)}
                />
              </div>
              <Button
                className="w-full h-9 gap-2 text-[13px] font-semibold"
                style={{ boxShadow: "0 4px 16px oklch(0.52 0.24 256 / 24%)" }}
                onClick={() => setSubmitted(true)}
              >
                <Mail className="h-3.5 w-3.5" />
                Envoyer le lien
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </motion.div>

            <motion.div {...fadeUp(0.16)}>
              <Link
                href="/sign-in"
                className="mt-6 flex items-center justify-center gap-2 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
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
            className="space-y-7"
          >
            <div className="space-y-3 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  duration: 0.4,
                  type: "spring",
                  stiffness: 220,
                  delay: 0.1,
                }}
                className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10"
                style={{ boxShadow: "0 0 20px oklch(0.5 0.15 155 / 15%)" }}
              >
                <CheckCircle className="h-7 w-7 text-emerald-400" />
              </motion.div>
              <div>
                <h2 className="text-[1.4rem] font-bold">Email envoyé !</h2>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                  Si un compte existe pour{" "}
                  <span className="font-semibold text-foreground">
                    {email || "cet email"}
                  </span>
                  , vous recevrez un lien dans quelques minutes.
                </p>
                <p className="mt-2 text-[11px] text-muted-foreground/60">
                  Vérifiez aussi votre dossier spam.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full h-9 text-[13px] font-medium border-border/60"
                onClick={() => {
                  setSubmitted(false);
                  setEmail("");
                }}
              >
                Renvoyer l&apos;email
              </Button>
              <Link href="/sign-in">
                <Button
                  variant="ghost"
                  className="w-full h-9 text-[13px] font-medium text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-3.5 w-3.5 mr-2" />
                  Retour à la connexion
                </Button>
              </Link>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
