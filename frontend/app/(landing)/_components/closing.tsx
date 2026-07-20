"use client";

// ─── closing.tsx ──────────────────────────────────────────────────────────────
// End-of-funnel pair: Trust signals → CTA.
// Trust builds confidence, CTA converts it. Always adjacent, never split.

import { stagger, fadeUpVariant } from "@/lib/motion";
import { motion } from "framer-motion";
import { ArrowRight, Check, Shield, Smartphone, Zap } from "lucide-react";
import Link from "next/link";
import { SectionHeader } from "../_sections/section-header";
import { Divider } from "../_sections/layout";

// ─── Trust ────────────────────────────────────────────────────────────────────
function Trust() {
  const signals = [
    {
      icon: Shield,
      color: "oklch(0.62 0.22 256)",
      bg: "oklch(0.52 0.24 256 / 12%)",
      title: "Connexion sécurisée",
      desc: "Protocole OAuth officiel de Facebook pour une connexion 100% sécurisée",
    },
    {
      icon: Check,
      color: "#34d399",
      bg: "oklch(0.5 0.15 155 / 10%)",
      title: "Données chiffrées",
      desc: "Toutes vos données sont chiffrées en transit et au repos",
    },
    {
      icon: Smartphone,
      color: "#a78bfa",
      bg: "oklch(0.5 0.18 290 / 10%)",
      title: "Paiement local",
      desc: "Réglez simplement par MVola ou Orange Money, sans carte bancaire",
    },
  ] as const;

  return (
    <section className="relative z-10 px-6 py-24">
      <div className="mx-auto max-w-4xl">
        <SectionHeader
          label="Sécurité"
          title="Sécurité et confiance"
          sub="Vos données sont entre de bonnes mains"
        />
        <motion.div
          className="grid gap-4 md:grid-cols-3"
          variants={stagger(0.1)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          {signals.map(({ icon: Icon, color, bg, title, desc }) => (
            <motion.div
              key={title}
              variants={fadeUpVariant}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
              className="rounded-2xl border border-border/50 bg-card/60 p-6 text-center backdrop-blur-sm transition-colors hover:border-primary/25"
            >
              <div
                className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-2xl"
                style={{ background: bg }}
              >
                <Icon className="h-5 w-5" style={{ color }} />
              </div>
              <h3 className="mb-2 text-[13px] font-semibold text-foreground">
                {title}
              </h3>
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                {desc}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ─── Cta ──────────────────────────────────────────────────────────────────────
function Cta() {
  return (
    <section className="relative z-10 overflow-hidden px-6 py-32 text-center">
      {/* Soft grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)`,
          backgroundSize: "56px 56px",
        }}
      />
      {/* Orbs */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          width: 600,
          height: 400,
          background:
            "radial-gradient(ellipse, oklch(0.52 0.24 256 / 0.1) 0%, transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute -right-16 top-0 h-80 w-80 rounded-full blur-[100px]"
        style={{ background: "oklch(0.52 0.24 256 / 0.07)" }}
      />
      <div
        className="pointer-events-none absolute -left-16 bottom-0 h-64 w-64 rounded-full blur-[100px]"
        style={{ background: "oklch(0.6 0.2 290 / 0.05)" }}
      />

      <div className="relative mx-auto max-w-xl">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger(0.1)}
        >
          <motion.div
            variants={fadeUpVariant}
            className="mb-5 flex justify-center"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-secondary/50 px-3.5 py-1.5 backdrop-blur-sm">
              <Zap className="h-3 w-3 text-primary" />
              <span className="text-[11px] font-medium text-foreground/70">
                Démarrage gratuit, sans carte bancaire
              </span>
            </div>
          </motion.div>

          <motion.h2
            variants={fadeUpVariant}
            className="mb-4 text-[1.85rem] font-bold tracking-tight md:text-[2.4rem]"
          >
            Prêt à automatiser
            <br />
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, oklch(0.72 0.2 256), oklch(0.58 0.22 272))",
              }}
            >
              vos ventes Facebook ?
            </span>
          </motion.h2>

          <motion.p
            variants={fadeUpVariant}
            className="mb-8 text-sm leading-relaxed text-muted-foreground"
          >
            Rejoignez les vendeurs qui font confiance à prosendia.
          </motion.p>

          <motion.div
            variants={fadeUpVariant}
            className="flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Link href="/sign-up">
              <button
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground transition-all hover:scale-[1.03] hover:opacity-95"
                style={{ boxShadow: "0 8px 32px oklch(0.52 0.24 256 / 32%)" }}
              >
                Commencer gratuitement
                <ArrowRight className="h-4 w-4" />
              </button>
            </Link>
          </motion.div>

          <motion.p
            variants={fadeUpVariant}
            className="mt-5 text-[11px] text-muted-foreground/50"
          >
            Sans carte bancaire · Configuration en 5 minutes
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────
export function Closing() {
  return (
    <>
      <Trust />
      <Divider />
      <Cta />
    </>
  );
}
