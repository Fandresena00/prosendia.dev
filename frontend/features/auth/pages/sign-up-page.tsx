"use client";

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
import { EASE, fadeUp } from "@/lib/motion";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconBrandGoogle } from "@tabler/icons-react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  MessageCircleMore,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { AuthDotGrid } from "../components/shared/auth-background";
import { DashboardDemo } from "../components/signup/dashboard-demo";

// ─── Feature bullets ──────────────────────────────────────────────────────────

const BULLETS = [
  { icon: Zap, text: "Réponses IA en moins de 1 seconde" },
  { icon: BarChart3, text: "Analytics et taux de conversion en temps réel" },
  {
    icon: MessageCircleMore,
    text: "Gestion multi-pages Facebook depuis une interface",
  },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export default function SignUpPage() {
  const router = useRouter();
  // Renamed to avoid shadowing RHF's `register` method
  const {
    register: registerUser,
    isLoading,
    authError,
    clearError,
  } = useAuthStore();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(RegisterSchema as never),
    defaultValues: { username: "", email: "", password: "" },
  });

  // ✅ Correction Bug React Compiler: Utilisation de useWatch au lieu de watch()
  const password = useWatch({
    control,
    name: "password",
  });
  const remaining = Math.max(0, 8 - (password?.length ?? 0));

  const onSubmit = async (data: RegisterInput): Promise<void> => {
    clearError();
    try {
      await registerUser(data);
      toast.success("Compte créé avec succès ! Bienvenue sur VendeoAI 🎉");
      router.push("/dashboard");
    } catch (err) {
      // L'erreur est capturée par le store et affichée via authError
      toast.error("Erreur lors de l'inscription");
      throw err;
    }
  };

  return (
    <div className="relative min-h-screen flex bg-background">
      <AuthDotGrid />
      <div className="fixed right-4 top-4 z-50">
        <ThemeSwitcher />
      </div>

      {/* ── Left — form ── */}
      <div className="relative z-10 flex flex-1 items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-90">
          {/* Logo */}
          <motion.div {...fadeUp(0)} className="mb-7 flex items-center gap-2">
            <VendeoLogo size={7} />
            <span className="text-sm font-bold">VendeoAI</span>
          </motion.div>

          {/* Heading */}
          <motion.div {...fadeUp(0.05)} className="mb-7 space-y-1.5">
            <h1 className="text-[1.6rem] font-bold tracking-tight">
              Créez votre compte
            </h1>
            <p className="text-[13px] text-muted-foreground">
              Gratuit · Pas de carte · Accès en 2 min
            </p>
          </motion.div>

          {/* Form */}
          <motion.div {...fadeUp(0.1)}>
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-3.5"
              noValidate
            >
              {/* Store-level error */}
              {authError && (
                <p
                  role="alert"
                  className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-[12px] text-destructive"
                >
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
                {errors.username ? (
                  <p className="text-[11px] text-destructive">
                    {errors.username.message}
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground/60">
                    Visible dans votre espace VendeoAI
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
                {errors.email && (
                  <p className="text-[11px] text-destructive">
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-[12px] font-medium">
                  Mot de passe
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Minimum 8 caractères"
                  className="h-9 text-[13px]"
                  autoComplete="new-password"
                  aria-invalid={!!errors.password}
                  {...register("password")}
                />
                {/* Live hint while typing — disappears once Zod error takes over */}
                {!errors.password &&
                  remaining > 0 &&
                  (password?.length ?? 0) > 0 && (
                    <p className="text-[11px] text-amber-500">
                      {remaining} caractère{remaining > 1 ? "s" : ""} manquant
                      {remaining > 1 ? "s" : ""}
                    </p>
                  )}
                {errors.password && (
                  <p className="text-[11px] text-destructive">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-9 gap-2 text-[13px] font-semibold"
                disabled={isLoading}
                style={{
                  boxShadow: isLoading
                    ? "none"
                    : "0 4px 16px oklch(0.52 0.24 256 / 28%)",
                }}
              >
                {isLoading ? (
                  <Spinner />
                ) : (
                  <>
                    <span>Créer mon compte</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            </form>
          </motion.div>

          {/* Divider */}
          <motion.div {...fadeUp(0.15)} className="relative my-5">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              ou
            </span>
          </motion.div>

          {/* Google */}
          <motion.div {...fadeUp(0.18)}>
            <Button
              variant="outline"
              type="button"
              className="w-full h-9 gap-2 text-[13px] font-medium border-border/60"
            >
              <IconBrandGoogle className="h-4 w-4" />
              S&apos;inscrire avec Google
            </Button>
          </motion.div>

          {/* Links */}
          <motion.div {...fadeUp(0.22)} className="mt-5 space-y-2 text-center">
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
                className="text-primary/70 hover:text-primary underline underline-offset-2 transition-colors"
              >
                Conditions d&apos;utilisation
              </Link>{" "}
              et notre{" "}
              <Link
                href="/privacy"
                className="text-primary/70 hover:text-primary underline underline-offset-2 transition-colors"
              >
                Politique de confidentialité
              </Link>
            </p>
          </motion.div>
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
            VendeoAI répond instantanément à vos messages et commentaires
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
