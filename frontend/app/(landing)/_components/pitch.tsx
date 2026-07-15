"use client";

// ─── pitch.tsx ────────────────────────────────────────────────────────────────
// Narrative arc: Problem → Solution → How it works.
// These three sections always tell the same story in sequence and
// are never rendered independently, so they live in one file.

import { EASE, fadeUpVariant, stagger } from "@/lib/motion";
import { IconRobot, IconUsers } from "@tabler/icons-react";
import { motion } from "framer-motion";
import { Clock, TrendingUp } from "lucide-react";
import { CheckItem } from "../_sections/check-item";
import { Divider } from "../_sections/layout";
import { SectionHeader } from "../_sections/section-header";

// ─── Problem ──────────────────────────────────────────────────────────────────
function Problem() {
  const painPoints = [
    {
      icon: Clock,
      title: "Temps perdu",
      desc: "Répondre manuellement prend des heures chaque jour",
    },
    {
      icon: TrendingUp,
      title: "Clients perdus",
      desc: "Messages non lus = ventes manquées en temps réel",
    },
    {
      icon: IconUsers,
      title: "Stress constant",
      desc: "Impossible de décrocher sans rater des opportunités",
    },
  ] as const;

  return (
    <section className="relative z-10 px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <SectionHeader
          label="Le problème"
          title="Vous perdez des clients faute de réponse rapide ?"
          sub="Trop de messages à gérer manuellement, des clients qui attendent, du temps perdu à répondre aux mêmes questions…"
        />
        <motion.div
          className="grid gap-4 md:grid-cols-3"
          variants={stagger(0.1)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          {painPoints.map(({ icon: Icon, title, desc }) => (
            <motion.div
              key={title}
              variants={fadeUpVariant}
              className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 backdrop-blur-sm"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10">
                <Icon className="h-4.5 w-4.5 text-rose-400" />
              </div>
              <h3 className="mb-1.5 text-[13px] font-semibold text-foreground">
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

// ─── Solution ─────────────────────────────────────────────────────────────────
function Solution() {
  const bullets = [
    "Réponses personnalisées selon le produit",
    "Détection automatique des urgences",
    "Apprentissage continu de vos préférences",
  ] as const;

  const chatMessages = [
    {
      who: "Client",
      msg: "Bonjour, est-ce que le produit est disponible ?",
      ai: false,
    },
    {
      who: "prosendia",
      msg: "Oui ! Le produit est disponible. Livraison gratuite dès 50€ !",
      ai: true,
    },
  ] as const;

  return (
    <section className="relative z-10 px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <SectionHeader
          label="La solution"
          title="La solution : prosendia"
          sub="Un assistant IA qui répond automatiquement à vos clients Facebook, filtre les messages et vous alerte uniquement quand c'est nécessaire."
        />
        <motion.div
          className="grid overflow-hidden rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm md:grid-cols-2"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={fadeUpVariant}
        >
          {/* Left — pitch */}
          <div className="flex flex-col justify-center p-8 md:p-10">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12">
              <IconRobot className="h-4.5 w-4.5 text-primary" />
            </div>
            <h3 className="mb-3 text-lg font-bold">IA intelligente</h3>
            <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
              Comprend le contexte, adapte les réponses selon vos produits, et
              sait quand passer la main à un humain.
            </p>
            <ul className="space-y-2.5">
              {bullets.map((t) => (
                <CheckItem key={t} text={t} />
              ))}
            </ul>
          </div>

          {/* Right — chat mockup */}
          <div className="flex flex-col justify-center gap-3 border-l border-border/50 bg-secondary/30 p-8 md:p-10">
            {chatMessages.map(({ who, msg, ai }) => (
              <div
                key={who}
                className={`flex items-start gap-3 ${ai ? "flex-row-reverse" : ""}`}
              >
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                  style={{
                    background: ai
                      ? "oklch(0.52 0.24 256 / 20%)"
                      : "oklch(0.22 0.05 258)",
                    color: ai ? "oklch(0.72 0.18 256)" : "oklch(0.7 0.03 255)",
                  }}
                >
                  {ai ? "AI" : who[0]}
                </div>
                <div>
                  <p className="mb-1 text-[10px] font-semibold text-muted-foreground">
                    {who}
                  </p>
                  <div
                    className="max-w-xs px-3.5 py-2.5 text-[12px] leading-relaxed"
                    style={{
                      background: ai
                        ? "oklch(0.52 0.24 256)"
                        : "oklch(0.18 0.04 260)",
                      color: ai ? "white" : "oklch(0.82 0.02 255)",
                      borderRadius: ai
                        ? "1rem 1rem 0.25rem 1rem"
                        : "1rem 1rem 1rem 0.25rem",
                    }}
                  >
                    {msg}
                  </div>
                </div>
              </div>
            ))}
            <div className="ml-10 mt-1 flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground">
                prosendia rédige…
              </span>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-primary"
                  style={{ opacity: 0.5 + i * 0.2 }}
                />
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── HowItWorks ───────────────────────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Connectez Facebook",
      desc: "Liez votre page Facebook en toute sécurité avec une connexion OAuth officielle",
    },
    {
      n: "02",
      title: "Configurez vos produits",
      desc: "Ajoutez vos produits, prix et informations pour que l'IA puisse répondre avec précision",
    },
    {
      n: "03",
      title: "L'IA prend le relais",
      desc: "L'intelligence artificielle répond automatiquement à vos clients 24h/24, 7j/7",
    },
  ] as const;

  return (
    <section className="relative z-10 px-6 py-24">
      <div className="mx-auto max-w-4xl">
        <SectionHeader
          label="Mise en route"
          title="Comment ça marche ?"
          sub="3 étapes simples pour automatiser vos ventes"
        />
        <div className="relative grid gap-8 md:grid-cols-3">
          <div
            className="absolute top-7 left-1/6 right-1/6 hidden h-px md:block"
            style={{
              background:
                "linear-gradient(to right, transparent, oklch(0.52 0.24 256 / 35%), transparent)",
            }}
          />
          {steps.map(({ n, title, desc }, i) => (
            <motion.div
              key={n}
              className="text-center"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-60px" }}
              variants={{
                hidden: { opacity: 0, y: 20, filter: "blur(4px)" },
                visible: {
                  opacity: 1,
                  y: 0,
                  filter: "blur(0px)",
                  transition: { duration: 0.6, ease: EASE, delay: i * 0.12 },
                },
              }}
            >
              <div
                className="relative z-10 mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/35 bg-primary/10 text-base font-extrabold text-primary"
                style={{ boxShadow: "0 0 16px oklch(0.52 0.24 256 / 18%)" }}
              >
                {n}
              </div>
              <h3 className="mb-2 text-[13px] font-semibold text-foreground">
                {title}
              </h3>
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                {desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────
// Renders the full Problem → Solution → HowItWorks narrative block.
export function Pitch() {
  return (
    <>
      <Problem />
      <Divider />
      <Solution />
      <Divider />
      <HowItWorks />
    </>
  );
}
