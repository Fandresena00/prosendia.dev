"use client";

/**
 * @file src/app/(auth)/sign-up/page.tsx
 * Two-step signup: form → email verification code entry.
 * Real-time password rules + email validation + show/hide toggle.
 */

import { ThemeSwitcher } from "@/components/shared/theme-switcher";
import { VendeoLogo } from "@/components/shared/vendeo-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import {
  RegisterSchema,
  type RegisterInput,
} from "@/features/auth/schemas/auth.schema";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { apiClient } from "@/lib/api-client";
import { EASE, fadeUp } from "@/lib/motion";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconBrandGoogle } from "@tabler/icons-react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, BarChart3, MessageCircleMore, RotateCcw, Users, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { AuthDotGrid } from "../components/shared/auth-background";
import { DashboardDemo } from "../components/signup/dashboard-demo";
import {
  EmailHint,
  PasswordInput,
  PasswordRequirements,
} from "../components/shared/password-field";

const BULLETS = [
  { icon: Zap, text: "Réponses IA en moins de 1 seconde" },
  { icon: BarChart3, text: "Analytics et taux de conversion en temps réel" },
  { icon: MessageCircleMore, text: "Gestion multi-pages Facebook depuis une interface" },
] as const;

// ─── Code input ───────────────────────────────────────────────────────────────

function CodeInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const digits = value.padEnd(6, "").split("").slice(0, 6);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, i: number) => {
    const ch = e.target.value.replace(/\D/g, "").slice(-1);
    const next = digits.map((d, idx) => (idx === i ? ch : d)).join("").replace(/\s/g, "");
    onChange(next);
    if (ch && i < 5) {
      const nextInput = document.getElementById(`code-${i + 1}`);
      (nextInput as HTMLInputElement)?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, i: number) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      const prev = document.getElementById(`code-${i - 1}`);
      (prev as HTMLInputElement)?.focus();
    }
  };

  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length: 6 }, (_, i) => (
        <input
          key={i}
          id={`code-${i}`}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[i] ?? ""}
          onChange={(e) => handleChange(e, i)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          className={[
            "h-12 w-10 rounded-lg border text-center text-lg font-bold",
            "bg-secondary/60 text-foreground",
            "focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none",
            "transition-all duration-150",
            digits[i] ? "border-primary/60" : "border-border/60",
          ].join(" ")}
          autoComplete="one-time-code"
        />
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SignUpPage() {
  const router = useRouter();
  const {
    register: registerUser,
    isLoading,
    authError,
    clearError,
  } = useAuthStore();

  // Step management
  const [step, setStep] = useState<"form" | "verify">("form");
  const [pendingEmail, setPendingEmail] = useState("");
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(RegisterSchema as never),
    defaultValues: { username: "", email: "", password: "" },
  });

  const watchedEmail = useWatch({ control, name: "email" });
  const watchedPassword = useWatch({ control, name: "password" });

  // ── Step 1: Submit form → get verification code ──────────────────────────

  const onSubmit = async (data: RegisterInput): Promise<void> => {
    clearError();
    try {
      const res = await apiClient<{ email: string; message: string }>("/auth/register", {
        method: "POST",
        body: JSON.stringify(data),
      });
      setPendingEmail(res.email);
      setStep("verify");
      toast.success("Code envoyé ! Vérifiez votre boîte email.");
    } catch {
      toast.error("Erreur lors de l'inscription");
    }
  };

  // ── Step 2: Verify code → complete registration ──────────────────────────

  const onVerify = async () => {
    if (code.length < 6) return;
    setVerifying(true);
    clearError();
    try {
      await registerUser({ email: pendingEmail, code } as any);
      toast.success("Compte créé avec succès ! Bienvenue sur VendeoAI 🎉");
      router.push("/dashboard");
    } catch {
      toast.error("Code incorrect ou expiré");
    } finally {
      setVerifying(false);
    }
  };

  const onResend = async () => {
    setResending(true);
    try {
      await apiClient("/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email: pendingEmail }),
      });
      toast.success("Nouveau code envoyé !");
      setCode("");
    } catch {
      toast.error("Impossible de renvoyer le code");
    } finally {
      setResending(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="relative min-h-screen flex bg-background">
      <AuthDotGrid />
      <div className="fixed right-4 top-4 z-50">
        <ThemeSwitcher />
      </div>

      {/* ── Left — form / verify ── */}
      <div className="relative z-10 flex flex-1 items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[360px]">
          <motion.div {...fadeUp(0)} className="mb-7 flex items-center gap-2">
            <VendeoLogo size={7} />
            <span className="text-sm font-bold">VendeoAI</span>
          </motion.div>

          <AnimatePresence mode="wait">
            {step === "form" ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3, ease: EASE }}
              >
                <div className="mb-7 space-y-1.5">
                  <h1 className="text-[1.6rem] font-bold tracking-tight">
                    Créez votre compte
                  </h1>
                  <p className="text-[13px] text-muted-foreground">
                    Gratuit · Pas de carte · Accès en 2 min
                  </p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5" noValidate>
                  {authError && (
                    <p role="alert" className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-[12px] text-destructive">
                      {authError}
                    </p>
                  )}

                  {/* Username */}
                  <div className="space-y-1.5">
                    <Label htmlFor="username" className="text-[12px] font-medium">
                      Nom d&apos;utilisateur
                    </Label>
                    <Input
                      id="username"
                      placeholder="jean_dupont"
                      className="h-9 text-[13px]"
                      autoComplete="username"
                      aria-invalid={!!errors.username}
                      {...register("username")}
                    />
                    {errors.username
                      ? <p className="text-[11px] text-destructive">{errors.username.message}</p>
                      : <p className="text-[11px] text-muted-foreground/60">Visible dans votre espace VendeoAI</p>
                    }
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-[12px] font-medium">
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="vous@exemple.com"
                      className="h-9 text-[13px]"
                      autoComplete="email"
                      aria-invalid={!!errors.email}
                      {...register("email")}
                    />
                    <EmailHint value={watchedEmail ?? ""} error={errors.email?.message} />
                  </div>

                  {/* Password */}
                  <PasswordInput
                    label="Mot de passe"
                    placeholder="Minimum 8 caractères"
                    autoComplete="new-password"
                    aria-invalid={!!errors.password}
                    error={errors.password?.message}
                    showRequirements
                    value={watchedPassword ?? ""}
                    {...register("password")}
                  />

                  <Button
                    type="submit"
                    className="w-full h-9 gap-2 text-[13px] font-semibold mt-1"
                    disabled={isLoading}
                    style={{ boxShadow: isLoading ? "none" : "0 4px 16px oklch(0.52 0.24 256 / 28%)" }}
                  >
                    {isLoading ? <Spinner /> : (
                      <>
                        <span>Continuer</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </>
                    )}
                  </Button>
                </form>

                <div className="relative my-5">
                  <Separator />
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    ou
                  </span>
                </div>

                <Button variant="outline" type="button" className="w-full h-9 gap-2 text-[13px] font-medium border-border/60">
                  <IconBrandGoogle className="h-4 w-4" />
                  S&apos;inscrire avec Google
                </Button>

                <div className="mt-5 space-y-2 text-center">
                  <p className="text-[12px] text-muted-foreground">
                    Déjà un compte ?{" "}
                    <Link href="/sign-in" className="font-semibold text-primary hover:text-primary/75 transition-colors">
                      Se connecter
                    </Link>
                  </p>
                  <p className="text-[11px] text-muted-foreground/55 leading-relaxed">
                    En créant un compte, vous acceptez nos{" "}
                    <Link href="/terms" className="text-primary/70 hover:text-primary underline underline-offset-2">
                      CGU
                    </Link>{" "}
                    et notre{" "}
                    <Link href="/privacy" className="text-primary/70 hover:text-primary underline underline-offset-2">
                      Politique de confidentialité
                    </Link>
                  </p>
                </div>
              </motion.div>
            ) : (
              /* ── Verify step ── */
              <motion.div
                key="verify"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="space-y-6"
              >
                {/* Icon */}
                <div
                  className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center"
                  style={{ boxShadow: "0 0 20px oklch(0.52 0.24 256 / 14%)" }}
                >
                  <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>

                <div className="space-y-1.5">
                  <h1 className="text-[1.55rem] font-bold tracking-tight">
                    Vérifiez votre email
                  </h1>
                  <p className="text-[13px] text-muted-foreground leading-relaxed">
                    Nous avons envoyé un code à 6 chiffres à{" "}
                    <span className="font-semibold text-foreground">{pendingEmail}</span>.
                    Il expire dans 30 minutes.
                  </p>
                </div>

                {authError && (
                  <p role="alert" className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-[12px] text-destructive">
                    {authError}
                  </p>
                )}

                <CodeInput value={code} onChange={setCode} />

                <Button
                  className="w-full h-9 gap-2 text-[13px] font-semibold"
                  disabled={code.length < 6 || verifying}
                  onClick={onVerify}
                  style={{ boxShadow: code.length === 6 ? "0 4px 16px oklch(0.52 0.24 256 / 28%)" : "none" }}
                >
                  {verifying ? <Spinner /> : (
                    <>
                      <span>Confirmer mon compte</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </Button>

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => { setStep("form"); setCode(""); }}
                    className="text-[12px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    ← Modifier l&apos;email
                  </button>
                  <button
                    type="button"
                    onClick={onResend}
                    disabled={resending}
                    className="text-[12px] text-primary hover:text-primary/75 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {resending ? <Spinner /> : <RotateCcw className="h-3 w-3" />}
                    Renvoyer le code
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Right — demo panel ── */}
      <motion.div
        className="relative z-10 hidden lg:flex lg:w-[46%] flex-col justify-between border-l border-border/30 p-10"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: EASE }}
      >
        <div
          className="pointer-events-none absolute left-0 top-1/3"
          style={{
            width: 300, height: 300, borderRadius: "50%",
            background: "radial-gradient(circle, oklch(0.52 0.24 256 / 0.07) 0%, transparent 70%)",
            transform: "translateX(-40%)",
          }}
        />
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Pour les vendeurs Facebook
            </span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight leading-tight">
            Vendez plus,<br />répondez moins
          </h2>
          <p className="text-sm text-muted-foreground">
            VendeoAI répond instantanément à vos messages et commentaires Facebook — 24h/24, 7j/7.
          </p>
        </div>

        <div className="my-8">
          <DashboardDemo />
        </div>

        <div className="space-y-3">
          {BULLETS.map(({ icon: Icon, text }, i) => (
            <motion.div
              key={text}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.3 + i * 0.08, duration: 0.4 }}
              className="flex items-center gap-2.5 text-sm text-muted-foreground"
            >
              <div className="h-5 w-5 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="h-3 w-3 text-primary" />
              </div>
              {text}
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
