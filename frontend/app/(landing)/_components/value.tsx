"use client";

// ─── value.tsx ────────────────────────────────────────────────────────────────
// Value proposition pair: Benefits (why choose us) + UseCases (for whom).
// Both are icon-grid sections with identical visual treatment and scale together.

import { fadeUpVariant, stagger } from "@/lib/motion";
import { IconBrandFacebook, IconUsers } from "@tabler/icons-react";
import { motion } from "framer-motion";
import { Bolt, Clock, ShoppingBag, Star, TrendingUp } from "lucide-react";
import { Divider } from "../_sections/layout";
import { SectionHeader } from "../_sections/section-header";

// ─── Benefits ─────────────────────────────────────────────────────────────────
function Benefits() {
  const items = [
    {
      icon: Clock,
      color: "oklch(0.62 0.22 256)",
      bg: "oklch(0.52 0.24 256 / 12%)",
      title: "Gagnez du temps",
      desc: "Réponses 24/7, plus besoin de surveiller constamment",
    },
    {
      icon: TrendingUp,
      color: "#34d399",
      bg: "oklch(0.5 0.15 155 / 10%)",
      title: "Augmentez vos ventes",
      desc: "Réponses instantanées = plus de clients = plus de ventes",
    },
    {
      icon: Bolt,
      color: "#a78bfa",
      bg: "oklch(0.5 0.18 290 / 10%)",
      title: "Automatisation 24/7",
      desc: "Vendez même pendant votre sommeil",
    },
    {
      icon: IconUsers,
      color: "#fb923c",
      bg: "oklch(0.65 0.18 50 / 10%)",
      title: "Moins de stress",
      desc: "Déléguez les tâches répétitives, concentrez-vous",
    },
  ] as const;

  return (
    <section className="relative z-10 px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <SectionHeader
          label="Avantages"
          title="Pourquoi choisir prosendia ?"
          sub="Les avantages qui font la différence"
        />
        <motion.div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          variants={stagger(0.09)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          {items.map(({ icon: Icon, color, bg, title, desc }) => (
            <motion.div
              key={title}
              variants={fadeUpVariant}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
              className="rounded-2xl border border-border/50 bg-card/60 p-5 backdrop-blur-sm transition-colors hover:border-primary/25"
            >
              <div
                className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: bg }}
              >
                <Icon className="h-4.5 w-4.5" style={{ color }} />
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

// ─── UseCases ─────────────────────────────────────────────────────────────────
function UseCases() {
  const profiles = [
    {
      icon: ShoppingBag,
      title: "E-commerçants",
      desc: "Boutiques en ligne, dropshipping, produits physiques",
    },
    {
      icon: IconUsers,
      title: "Boutiques locales",
      desc: "Restaurants, coiffeurs, services locaux",
    },
    {
      icon: IconBrandFacebook,
      title: "Agences",
      desc: "Gestion de plusieurs pages clients",
    },
    {
      icon: Star,
      title: "Créateurs",
      desc: "Artistes, influenceurs vendant leurs produits",
    },
  ] as const;

  return (
    <section className="relative z-10 px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <SectionHeader
          label="Pour qui"
          title="Pour qui ?"
          sub="prosendia s'adapte à tous types de vendeurs Facebook"
        />
        <motion.div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          variants={stagger(0.09)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          {profiles.map(({ icon: Icon, title, desc }) => (
            <motion.div
              key={title}
              variants={fadeUpVariant}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
              className="rounded-2xl border border-border/50 bg-card/60 p-5 text-center backdrop-blur-sm"
            >
              <div className="mx-auto mb-3.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/12">
                <Icon className="h-5 w-5 text-primary" />
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

// ─── Export ───────────────────────────────────────────────────────────────────
export function Value() {
  return (
    <>
      <Benefits />
      <Divider />
      <UseCases />
    </>
  );
}
