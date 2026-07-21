"use client";

/**
 * @file src/app/(auth)/sign-up/page.tsx
 *
 * FIXES:
 *   1. onSubmit appelle store.initiateRegistration() — loader local propre,
 *      authError du store affiché si email déjà pris / erreur réseau
 *   2. onVerify appelle store.verifyEmail() — POST /auth/verify-email —
 *      crée la session + redirige vers /dashboard
 *   3. PasswordInput : showRequirements lit watchedPassword (useWatch),
 *      register("password") gère onChange/ref pour RHF → plus de double binding
 *   4. Cooldown 60s sur "Renvoyer le code" pour éviter le spam
 *   5. Auto-focus case 0 à l'entrée dans step "verify"
 *   6. Paste handler : coller "123456" remplit toutes les cases
 *   7. Auto-submit quand 6 chiffres saisis
 */

import { ProsendiaLogo } from "@/components/shared/prosendia-logo";
import { ThemeSwitcher } from "@/components/shared/theme-switcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import {
  RegisterSchema,
  type RegisterInput,
} from "@/features/auth/schemas/auth.schema";
import { authService } from "@/features/auth/services/auth.service";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { EASE, fadeUp } from "@/lib/motion";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconBrandGoogle } from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  MessageCircleMore,
  RotateCcw,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { AuthDotGrid } from "../components/shared/auth-background";
import { EmailHint, PasswordInput } from "../components/shared/password-field";
import { DashboardDemo } from "../components/signup/dashboard-demo";

const BULLETS = [
  { icon: Zap, text: "Réponses IA en moins de 1 seconde" },
  { icon: BarChart3, text: "Analytics et taux de conversion en temps réel" },
  {
    icon: MessageCircleMore,
    text: "Gestion multi-pages Facebook depuis une interface",
  },
] as const;

const GOOGLE_URL = `${process.env.NEXT_PUBLIC_API_URL ?? ""}/auth/google`;
const RESEND_COOLDOWN = 60;

// ─── CodeInput ────────────────────────────────────────────────────────────────

function CodeInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const padded = value.padEnd(6, " ").split("").slice(0, 6);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  const update = (next: string) => onChange(next.replace(/ /g, ""));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, i: number) => {
    const ch = e.target.value.replace(/\D/g, "").slice(-1);
    const next = padded.map((d, idx) => (idx === i ? ch || " " : d)).join("");
    update(next);
    if (ch && i < 5) inputsRef.current[i + 1]?.focus();
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    i: number,
  ) => {
    if (e.key === "Backspace") {
      if (!padded[i]?.trim() && i > 0) {
        inputsRef.current[i - 1]?.focus();
        update(padded.map((d, idx) => (idx === i - 1 ? " " : d)).join(""));
      } else {
        update(padded.map((d, idx) => (idx === i ? " " : d)).join(""));
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (!pasted) return;
    update(pasted.padEnd(6, " "));
    inputsRef.current[Math.min(pasted.length, 5)]?.focus();
  };

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {padded.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            inputsRef.current[i] = el;
          }}
          id={`code-${i}`}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit.trim()}
          onChange={(e) => handleChange(e, i)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          disabled={disabled}
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`Chiffre ${i + 1} du code`}
          className={[
            "h-12 w-10 rounded-lg border text-center text-lg font-bold outline-none",
            "bg-secondary/60 text-foreground transition-all duration-150",
            "focus:border-primary focus:ring-2 focus:ring-primary/20",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            digit.trim()
              ? "border-primary/60 bg-primary/5"
              : "border-border/60",
          ].join(" ")}
        />
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SignUpPage() {
  const router = useRouter();
  const {
    initiateRegistration,
    verifyEmail,
    isLoading,
    authError,
    clearError,
  } = useAuthStore();

  const [step, setStep] = useState<"form" | "verify">("form");
  const [pendingEmail, setPendingEmail] = useState("");
  const [code, setCode] = useState("");
  const [initiating, setInitiating] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

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

  // ── Step 1 ────────────────────────────────────────────────────────────────

  const onSubmit = async (data: RegisterInput): Promise<void> => {
    clearError();
    setInitiating(true);
    try {
      const { email } = await initiateRegistration(data);
      setPendingEmail(email);
      setCode("");
      setStep("verify");
      setCooldown(RESEND_COOLDOWN);
      toast.success("Code envoyé ! Vérifiez votre boîte email.");
    } catch {
      // authError déjà set dans le store
    } finally {
      setInitiating(false);
    }
  };

  // ── Step 2 ────────────────────────────────────────────────────────────────

  const onVerify = async (): Promise<void> => {
    if (code.length < 6 || isLoading) return;
    clearError();
    try {
      await verifyEmail({ email: pendingEmail, code });
      toast.success("Compte créé ! Bienvenue sur prosendia 🎉");
      router.push("/dashboard");
    } catch {
      setCode("");
      setTimeout(() => inputsRef.current?.[0]?.focus(), 50);
    }
  };

  // Ref pour re-focus après erreur
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-submit à 6 chiffres
  useEffect(() => {
    if (code.length === 6 && step === "verify" && !isLoading) {
      void onVerify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // ── Renvoyer ──────────────────────────────────────────────────────────────

  const onResend = async (): Promise<void> => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    clearError();
    try {
      await authService.resendVerification(pendingEmail);
      setCode("");
      setCooldown(RESEND_COOLDOWN);
      toast.success("Nouveau code envoyé !");
    } catch {
      toast.error("Impossible de renvoyer le code. Réessayez.");
    } finally {
      setResending(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="relative min-h-screen flex bg-background">
      <AuthDotGrid />
      <div className="fixed right-4 top-4 z-50">
        <ThemeSwitcher />
      </div>

      {/* ── Left col ── */}
      <div className="relative z-10 flex flex-1 items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-90">
          <motion.div {...fadeUp(0)} className="mb-7 flex items-center gap-2">
            <ProsendiaLogo size={15} />
            <span className="text-sm font-bold">prosendia</span>
          </motion.div>

          <AnimatePresence mode="wait">
            {/* ──── STEP 1 : Formulaire ──── */}
            {step === "form" && (
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

                <form
                  onSubmit={handleSubmit(onSubmit)}
                  className="space-y-3.5"
                  noValidate
                >
                  {authError && (
                    <p
                      role="alert"
                      className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-[12px] text-destructive"
                    >
                      {authError}
                    </p>
                  )}

                  {/* Username */}
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="username"
                      className="text-[12px] font-medium"
                    >
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
                    {errors.username ? (
                      <p className="text-[11px] text-destructive">
                        {errors.username.message}
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground/60">
                        Visible dans votre espace prosendia
                      </p>
                    )}
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
                    <EmailHint
                      value={watchedEmail ?? ""}
                      error={errors.email?.message}
                    />
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
                    disabled={initiating}
                    style={{
                      boxShadow: initiating
                        ? "none"
                        : "0 4px 16px oklch(0.52 0.24 256 / 28%)",
                    }}
                  >
                    {initiating ? (
                      <Spinner />
                    ) : (
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

                <a href={GOOGLE_URL}>
                  <Button
                    variant="outline"
                    type="button"
                    className="w-full h-9 gap-2 text-[13px] font-medium border-border/60 hover:border-border"
                  >
                    <IconBrandGoogle className="h-4 w-4" />
                    S&apos;inscrire avec Google
                  </Button>
                </a>

                <div className="mt-5 space-y-2 text-center">
                  <p className="text-[12px] text-muted-foreground">
                    Déjà un compte ?{" "}
                    <Link
                      href="/sign-in"
                      className="font-semibold text-primary hover:text-primary/75 transition-colors"
                    >
                      Se connecter
                    </Link>
                  </p>
                  <p className="text-[11px] text-muted-foreground/55 leading-relaxed">
                    En créant un compte, vous acceptez nos{" "}
                    <Link
                      href="/terms"
                      className="text-primary/70 hover:text-primary underline underline-offset-2"
                    >
                      CGU
                    </Link>{" "}
                    et notre{" "}
                    <Link
                      href="/privacy"
                      className="text-primary/70 hover:text-primary underline underline-offset-2"
                    >
                      Politique de confidentialité
                    </Link>
                  </p>
                </div>
              </motion.div>
            )}

            {/* ──── STEP 2 : Vérification ──── */}
            {step === "verify" && (
              <motion.div
                key="verify"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="space-y-6"
              >
                {/* Icône */}
                <div
                  className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center"
                  style={{ boxShadow: "0 0 20px oklch(0.52 0.24 256 / 14%)" }}
                >
                  <svg
                    className="h-5 w-5 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                </div>

                <div className="space-y-1.5">
                  <h1 className="text-[1.55rem] font-bold tracking-tight">
                    Vérifiez votre email
                  </h1>
                  <p className="text-[13px] text-muted-foreground leading-relaxed">
                    Nous avons envoyé un code à 6 chiffres à{" "}
                    <span className="font-semibold text-foreground">
                      {pendingEmail}
                    </span>
                    .
                    <br />
                    <span className="text-[12px]">
                      Il expire dans 30 minutes.
                    </span>
                  </p>
                </div>

                {authError && (
                  <p
                    role="alert"
                    className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-[12px] text-destructive"
                  >
                    {authError}
                  </p>
                )}

                <CodeInput
                  value={code}
                  onChange={setCode}
                  disabled={isLoading}
                />

                <Button
                  className="w-full h-9 gap-2 text-[13px] font-semibold"
                  disabled={code.length < 6 || isLoading}
                  onClick={onVerify}
                  style={{
                    boxShadow:
                      code.length === 6
                        ? "0 4px 16px oklch(0.52 0.24 256 / 28%)"
                        : "none",
                  }}
                >
                  {isLoading ? (
                    <Spinner />
                  ) : (
                    <>
                      <span>Confirmer mon compte</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </Button>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setStep("form");
                      setCode("");
                      clearError();
                    }}
                    className="text-[12px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    ← Modifier l&apos;email
                  </button>

                  <button
                    type="button"
                    onClick={onResend}
                    disabled={cooldown > 0 || resending}
                    className="text-[12px] text-primary hover:text-primary/75 transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {resending ? (
                      <Spinner />
                    ) : (
                      <RotateCcw className="h-3 w-3" />
                    )}
                    {cooldown > 0
                      ? `Renvoyer (${cooldown}s)`
                      : "Renvoyer le code"}
                  </button>
                </div>

                <p className="text-[11px] text-muted-foreground/50 text-center">
                  Vérifiez aussi votre dossier spam si vous ne voyez pas
                  l&apos;email.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Right col — demo ── */}
      <motion.div
        className="relative z-10 hidden lg:flex lg:w-[46%] flex-col justify-between border-l border-border/30 p-10"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: EASE }}
      >
        <div
          className="pointer-events-none absolute left-0 top-1/3"
          style={{
            width: 300,
            height: 300,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, oklch(0.52 0.24 256 / 0.07) 0%, transparent 70%)",
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
            Vendez plus,
            <br />
            répondez moins
          </h2>
          <p className="text-sm text-muted-foreground">
            prosendia répond instantanément à vos messages et commentaires
            Facebook — 24h/24, 7j/7.
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
