"use client";

/**
 * @file src/app/(auth)/sign-in/page.tsx
 *
 * CHANGE: Bouton Google fonctionnel (href vers API /auth/google).
 * Affiche une erreur si ?error=google_auth_failed dans l'URL.
 * Fichier complet — remplace l'ancien sign-in-page.tsx.
 */

import { ThemeSwitcher } from "@/components/shared/theme-switcher";
import { ProsendiaLogo } from "@/components/shared/prosendia-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import {
  LoginSchema,
  type LoginInput,
} from "@/features/auth/schemas/auth.schema";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { EASE, fadeUp } from "@/lib/motion";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconBrandGoogle } from "@tabler/icons-react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  MessageCircleMore,
  Settings,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { AuthDotGrid } from "../components/shared/auth-background";
import { ChatDemo } from "../components/signin/chat-demo";
import {
  EmailHint,
  PasswordInput,
} from "../components/shared/password-field";

// ─── Constants ────────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: MessageCircleMore, label: "Réponses auto" },
  { icon: Users,             label: "Mode humain" },
  { icon: TrendingUp,        label: "Analytics" },
  { icon: Settings,          label: "Automatisation" },
  { icon: Zap,               label: "< 3 sec" },
] as const;

/** URL backend du flow OAuth Google — naviguation native (pas fetch) */
const GOOGLE_OAUTH_URL = `${process.env.NEXT_PUBLIC_API_URL ?? ""}/auth/google`;

const URL_ERROR_MESSAGES: Record<string, string> = {
  google_auth_failed:
    "La connexion avec Google a échoué. Réessayez ou utilisez email/mot de passe.",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SignInPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { login, isLoading, authError, clearError } = useAuthStore();

  // Erreur transmise depuis le callback Google (?error=...)
  const urlError    = searchParams.get("error");
  const googleError = urlError ? URL_ERROR_MESSAGES[urlError] : null;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema as never),
    defaultValues: { email: "", password: "" },
  });

  const watchedEmail = useWatch({ control, name: "email" });

  const onSubmit = async (data: LoginInput): Promise<void> => {
    clearError();
    try {
      await login(data);
      toast.success("Connexion réussie !");
      const callbackUrl = searchParams.get("callbackUrl");
      router.push(callbackUrl ?? "/dashboard");
    } catch {
      // authError set dans le store
    }
  };

  return (
    <div className="relative min-h-screen flex bg-background">
      <AuthDotGrid />
      <div className="fixed right-4 top-4 z-50">
        <ThemeSwitcher />
      </div>

      {/* ── Left — brand panel ── */}
      <motion.div
        className="relative z-10 hidden lg:flex lg:w-[46%] flex-col justify-between border-r border-border/30 p-12"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: EASE }}
      >
        <div
          className="pointer-events-none absolute right-0 top-1/4"
          style={{
            width: 300,
            height: 300,
            background:
              "radial-gradient(circle, oklch(0.52 0.24 256 / 0.08) 0%, transparent 70%)",
          }}
        />

        <div className="flex items-center gap-3">
          <ProsendiaLogo size={9} rounded="rounded-xl" />
          <span className="text-[15px] font-bold tracking-tight">prosendia</span>
        </div>

        <div className="space-y-8">
          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">
              Automatisation Facebook
            </p>
            <h2 className="text-[1.65rem] font-bold leading-[1.1] tracking-tight">
              Votre assistant IA répond à vos clients.
              <br />
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, oklch(0.72 0.2 256), oklch(0.58 0.22 272))",
                }}
              >
                Pendant que vous vendez.
              </span>
            </h2>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              prosendia gère vos messages et commentaires Facebook en temps réel,
              filtre les demandes et ne vous alerte que quand c&apos;est
              vraiment nécessaire.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {FEATURES.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-1.5 rounded-full border border-border/50 bg-secondary/50 px-3 py-1.5 backdrop-blur-sm"
              >
                <Icon className="h-3 w-3 text-primary" />
                <span className="text-[11px] font-medium text-foreground/75">
                  {label}
                </span>
              </div>
            ))}
          </div>

          <ChatDemo />
        </div>

        <p className="text-[11px] text-muted-foreground/50">
          © 2025 prosendia · Automatisation IA pour vendeurs Facebook
        </p>
      </motion.div>

      {/* ── Right — form ── */}
      <div className="relative z-10 flex flex-1 items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-90">
          {/* Logo mobile */}
          <motion.div
            {...fadeUp(0)}
            className="mb-8 flex items-center gap-2 lg:hidden"
          >
            <ProsendiaLogo size={7} />
            <span className="text-sm font-bold">prosendia</span>
          </motion.div>

          <motion.div {...fadeUp(0.05)} className="mb-7 space-y-1.5">
            <h1 className="text-[1.6rem] font-bold tracking-tight">
              Bon retour 👋
            </h1>
            <p className="text-[13px] text-muted-foreground">
              Connectez-vous à votre espace prosendia
            </p>
          </motion.div>

          <motion.div {...fadeUp(0.1)}>
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-4"
              noValidate
            >
              {/* Erreur Google (depuis URL) */}
              {googleError && (
                <p
                  role="alert"
                  className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-[12px] text-destructive"
                >
                  {googleError}
                </p>
              )}

              {/* Erreur login local (depuis store) */}
              {authError && !googleError && (
                <p
                  role="alert"
                  className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-[12px] text-destructive"
                >
                  {authError}
                </p>
              )}

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
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="password"
                    className="text-[12px] font-medium"
                  >
                    Mot de passe
                  </Label>
                  <Link
                    href="/forgot-password"
                    className="text-[11px] font-medium text-primary hover:text-primary/75 transition-colors"
                  >
                    Oublié ?
                  </Link>
                </div>
                <PasswordInput
                  id="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  aria-invalid={!!errors.password}
                  error={errors.password?.message}
                  {...register("password")}
                />
              </div>

              <Button
                type="submit"
                className="w-full h-9 gap-2 text-[13px] font-semibold"
                disabled={isLoading}
                style={{
                  boxShadow: "0 4px 16px oklch(0.52 0.24 256 / 28%)",
                }}
              >
                {isLoading ? (
                  <Spinner />
                ) : (
                  <>
                    <span>Se connecter</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            </form>
          </motion.div>

          {/* Séparateur */}
          <motion.div {...fadeUp(0.15)} className="relative my-5">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              ou
            </span>
          </motion.div>

          {/* Bouton Google — lien natif vers le backend OAuth */}
          <motion.div {...fadeUp(0.18)}>
            <a href={GOOGLE_OAUTH_URL} className="block w-full">
              <Button
                variant="outline"
                type="button"
                className="w-full h-9 gap-2 text-[13px] font-medium border-border/60 hover:border-border"
              >
                <IconBrandGoogle className="h-4 w-4" />
                Continuer avec Google
              </Button>
            </a>
          </motion.div>

          <motion.p
            {...fadeUp(0.22)}
            className="mt-6 text-center text-[12px] text-muted-foreground"
          >
            Pas encore de compte ?{" "}
            <Link
              href="/sign-up"
              className="font-semibold text-primary hover:text-primary/75 transition-colors"
            >
              S&apos;inscrire gratuitement
            </Link>
          </motion.p>
        </div>
      </div>
    </div>
  );
}
