"use client";

import { fadeUpVariant, stagger } from "@/lib/motion";
import { motion } from "framer-motion";
import { CheckItem } from "../_sections/check-item";
import { SectionHeader } from "../_sections/section-header";

export function Pricing() {
  return (
    <section id="pricing" className="relative z-10 px-6 py-24">
      <div className="mx-auto max-w-4xl">
        <SectionHeader
          label="Tarifs"
          title="Tarifs simples et transparents"
          sub="Commencez gratuitement, évoluez selon vos besoins"
        />

        <motion.div
          className="grid gap-4 md:grid-cols-3"
          variants={stagger(0.1)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          {/* Basic */}
          <motion.div
            variants={fadeUpVariant}
            className="rounded-2xl border border-border/50 bg-card/60 p-6 backdrop-blur-sm"
          >
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Basic
            </p>
            <p className="mb-1 text-[1.75rem] font-extrabold text-foreground">
              Gratuit
            </p>
            <p className="mb-6 text-[11px] text-muted-foreground">
              Pour découvrir
            </p>
            <ul className="mb-7 space-y-2.5">
              {[
                "1 page Facebook",
                "100 messages/mois",
                "Réponses basiques",
                "Support email",
              ].map((t) => (
                <CheckItem key={t} text={t} />
              ))}
            </ul>
            <button className="w-full rounded-xl border border-border/60 py-2.5 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground">
              Commencer gratuitement
            </button>
          </motion.div>

          {/* Pro — highlighted */}
          <motion.div
            variants={fadeUpVariant}
            className="relative rounded-2xl p-px"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.52 0.24 256), oklch(0.42 0.2 250))",
              boxShadow: "0 0 36px oklch(0.52 0.24 256 / 25%)",
            }}
          >
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
              <span className="rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                Le plus populaire
              </span>
            </div>
            <div className="h-full rounded-2xl bg-card p-6">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-primary">
                Pro
              </p>
              <div className="mb-1 flex items-end gap-1">
                <span className="text-[1.75rem] font-extrabold text-foreground">
                  29€
                </span>
                <span className="mb-1 text-[11px] text-muted-foreground">
                  /mois
                </span>
              </div>
              <p className="mb-6 text-[11px] text-muted-foreground">
                Pour les vendeurs actifs
              </p>
              <ul className="mb-7 space-y-2.5">
                {[
                  "3 pages Facebook",
                  "Messages illimités",
                  "IA avancée",
                  "Analytics complets",
                  "Support prioritaire",
                ].map((t) => (
                  <CheckItem key={t} text={t} />
                ))}
              </ul>
              <button className="w-full rounded-xl bg-primary py-2.5 text-[12px] font-semibold text-primary-foreground transition-all hover:opacity-90">
                Commencer l&apos;essai gratuit
              </button>
            </div>
          </motion.div>

          {/* Enterprise */}
          <motion.div
            variants={fadeUpVariant}
            className="rounded-2xl border border-border/50 bg-card/60 p-6 backdrop-blur-sm"
          >
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Enterprise
            </p>
            <p className="mb-1 text-[1.75rem] font-extrabold text-foreground">
              Sur mesure
            </p>
            <p className="mb-6 text-[11px] text-muted-foreground">
              Pour les grandes équipes
            </p>
            <ul className="mb-7 space-y-2.5">
              {[
                "Pages illimitées",
                "API personnalisée",
                "Intégrations avancées",
                "Support dédié",
                "Formation équipe",
              ].map((t) => (
                <CheckItem key={t} text={t} />
              ))}
            </ul>
            <button className="w-full rounded-xl border border-border/60 py-2.5 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground">
              Nous contacter
            </button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
