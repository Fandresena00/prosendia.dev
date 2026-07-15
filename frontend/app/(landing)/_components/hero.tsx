"use client";

import { Badge } from "@/components/ui/badge";
import { EASE, heroFade, fadeIn } from "@/lib/motion";
import { IconRobot } from "@tabler/icons-react";
import { motion } from "framer-motion";
import { ArrowRight, MessageCircleMore, TrendingUp, Users, Zap } from "lucide-react";
import Link from "next/link";

interface HeroProps {
  onScrollTo: (id: string) => void;
}

export function Hero({ onScrollTo }: HeroProps) {
  return (
    <section className="relative z-10 overflow-hidden px-6 pb-28 pt-28">
      {/* Ambient orbs */}
      <div
        className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2"
        style={{
          width: 700,
          height: 700,
          background: "radial-gradient(ellipse at center, oklch(0.52 0.24 256 / 0.09) 0%, transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute right-0 top-1/3"
        style={{
          width: 320,
          height: 320,
          background: "radial-gradient(circle, oklch(0.6 0.2 290 / 0.07) 0%, transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-5xl">
        {/* Eyebrow */}
        <motion.div
          className="mb-6 flex justify-center"
          {...heroFade(0)}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-secondary/50 px-3.5 py-1.5 backdrop-blur-sm">
            <Zap className="h-3 w-3 text-primary" />
            <span className="text-[11px] font-medium text-foreground/75">
              Nouvelle version avec IA avancée
            </span>
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
          </div>
        </motion.div>

        {/* Headline */}
        <motion.h1
          className="mb-5 text-center text-[2.6rem] font-extrabold leading-[1.04] tracking-[-0.025em] md:text-[4.2rem]"
          {...heroFade(0.08)}
        >
          Automatisez vos réponses
          <br />
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage: "linear-gradient(135deg, oklch(0.72 0.2 256), oklch(0.58 0.22 272))",
            }}
          >
            Facebook. Ne perdez plus
            <br className="hidden md:block" /> aucun client.
          </span>
        </motion.h1>

        {/* Sub */}
        <motion.p
          className="mx-auto mb-9 max-w-2xl text-center text-base leading-relaxed text-muted-foreground"
          {...heroFade(0.16)}
        >
          prosendia répond automatiquement aux messages et commentaires
          Facebook, filtre les messages et vous alerte uniquement quand
          c&apos;est nécessaire. Boostez vos ventes 24/7.
        </motion.p>

        {/* CTAs */}
        <motion.div
          className="mb-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
          {...heroFade(0.24)}
        >
          <Link href="/sign-up">
            <button
              className="flex items-center gap-2 rounded-xl bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground transition-all hover:scale-[1.03] hover:opacity-95"
              style={{ boxShadow: "0 8px 28px oklch(0.52 0.24 256 / 32%)" }}
            >
              Commencer gratuitement
              <ArrowRight className="h-4 w-4" />
            </button>
          </Link>
          <button
            onClick={() => onScrollTo("features")}
            className="rounded-xl border border-border/60 px-7 py-3 text-sm font-medium text-muted-foreground transition-all hover:bg-secondary/60 hover:text-foreground"
          >
            Voir les fonctionnalités
          </button>
        </motion.div>

        {/* Trust bar */}
        <motion.div
          className="mb-16 flex flex-wrap items-center justify-center gap-5 border-t border-border/30 pt-5"
          {...fadeIn(0.35)}
        >
          {[
            { value: "Gratuit", sub: "pour commencer"    },
            { value: "5 min",   sub: "de configuration"  },
            { value: "Sans CB", sub: "requise"           },
          ].map(({ value, sub }) => (
            <div key={sub} className="text-center">
              <p className="text-[13px] font-semibold text-foreground">{value}</p>
              <p className="text-[11px] text-muted-foreground">{sub}</p>
            </div>
          ))}
        </motion.div>

        {/* Hero dashboard widget */}
        <motion.div
          className="relative mx-auto max-w-3xl"
          initial={{ opacity: 0, y: 40, filter: "blur(12px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 1.1, ease: EASE, delay: 0.3 }}
        >
          {/* Halo */}
          <div
            className="absolute -inset-6 rounded-3xl blur-3xl"
            style={{
              background: "radial-gradient(ellipse at 50% 50%, oklch(0.52 0.24 256 / 0.1) 0%, transparent 70%)",
            }}
          />

          <div
            className="relative rounded-3xl p-px shadow-2xl"
            style={{
              background: "linear-gradient(135deg, oklch(0.52 0.24 256 / 45%), oklch(0.22 0.05 258 / 40%), oklch(0.4 0.2 280 / 25%))",
            }}
          >
            <div className="rounded-3xl bg-card/95 px-7 py-7 backdrop-blur-sm">
              {/* Live bar */}
              <div className="mb-5 flex items-center gap-3">
                <span
                  className="h-2 w-2 rounded-full bg-emerald-400"
                  style={{ boxShadow: "0 0 8px #34d399" }}
                />
                <span className="text-[12px] font-medium text-muted-foreground">
                  En direct · Ma Boutique Mode
                </span>
                <Badge className="ml-auto border-green-500/30 bg-green-500/15 text-green-400 text-[10px]">
                  IA Active
                </Badge>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-6 divide-x divide-border/50">
                {[
                  { icon: MessageCircleMore, label: "Messages traités", value: "1,247", change: "+23%", positive: true,  color: "oklch(0.62 0.22 256)", bg: "oklch(0.52 0.24 256 / 13%)" },
                  { icon: IconRobot,         label: "Taux IA",          value: "94%",   change: "+5%",  positive: true,  color: "#34d399",               bg: "oklch(0.5 0.15 155 / 10%)" },
                  { icon: Users,             label: "En attente",       value: "2",     change: "-1",   positive: false, color: "#fbbf24",               bg: "oklch(0.75 0.16 65 / 10%)" },
                ].map(({ icon: Icon, label, value, change, positive, color, bg }, i) => (
                  <div key={i} className={`text-center ${i > 0 ? "pl-6" : ""}`}>
                    <div
                      className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl"
                      style={{ background: bg }}
                    >
                      <Icon className="h-5 w-5" style={{ color }} />
                    </div>
                    <p className="mb-1 text-[10px] font-medium text-muted-foreground">{label}</p>
                    <p className="mb-0.5 text-2xl font-bold" style={{ color }}>{value}</p>
                    <span className={`text-[11px] font-medium ${positive ? "text-emerald-400" : "text-rose-400"}`}>
                      {change}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Floating card A */}
          <div className="float-card-a absolute -right-4 -top-5 rounded-2xl border border-primary/20 bg-card/90 p-2.5 shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary/15">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Ventes aujourd&apos;hui</p>
                <p className="text-[13px] font-bold text-primary">
                  +18{" "}
                  <span className="text-[10px] font-normal text-emerald-400">↑ record</span>
                </p>
              </div>
            </div>
          </div>

          {/* Floating card B */}
          <div className="float-card-b absolute -bottom-4 -left-4 rounded-2xl border border-border/50 bg-card/90 p-2.5 shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-secondary">
                <Zap className="h-3.5 w-3.5 text-emerald-400" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Réponse moyenne</p>
                <p className="text-[13px] font-bold text-emerald-400">{"< 3 secondes"}</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
