"use client";

// ─── contact.tsx ──────────────────────────────────────────────────────────────
// Direct contact channels — email and WhatsApp. Sits right before Closing,
// for the visitor who wants to talk to a human before signing up.

import { fadeUpVariant, stagger } from "@/lib/motion";
import { IconBrandWhatsapp } from "@tabler/icons-react";
import { motion } from "framer-motion";
import { ArrowUpRight, Mail } from "lucide-react";
import { SectionHeader } from "../_sections/section-header";

const CHANNELS = [
  {
    icon: Mail,
    color: "oklch(0.62 0.22 256)",
    bg: "oklch(0.52 0.24 256 / 12%)",
    title: "Email",
    value: "contact@genforus.com",
    sub: "Réponse sous 24h ouvrées",
    href: "mailto:contact@genforus.com",
  },
  {
    icon: IconBrandWhatsapp,
    color: "#34d399",
    bg: "oklch(0.5 0.15 155 / 10%)",
    title: "WhatsApp",
    value: "+261 37 51 127 31",
    sub: "Discutez avec l'équipe en direct",
    href: "https://wa.me/261375112731",
  },
] as const;

export function Contact() {
  return (
    <section id="contact" className="relative z-10 px-6 py-24">
      <div className="mx-auto max-w-3xl">
        <SectionHeader
          label="Contact"
          title="Une question avant de commencer ?"
          sub="Notre équipe répond directement — pas de formulaire, pas d'attente."
        />

        <motion.div
          className="grid gap-4 sm:grid-cols-2"
          variants={stagger(0.09)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          {CHANNELS.map(({ icon: Icon, color, bg, title, value, sub, href }) => (
            <motion.a
              key={title}
              href={href}
              target={href.startsWith("http") ? "_blank" : undefined}
              rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
              variants={fadeUpVariant}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
              className="group relative flex items-start gap-4 overflow-hidden rounded-2xl border border-border/50 bg-card/60 p-6 backdrop-blur-sm transition-colors hover:border-primary/30"
            >
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                style={{ background: bg }}
              >
                <Icon className="h-5 w-5" style={{ color }} />
              </div>
              <div className="min-w-0">
                <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {title}
                </p>
                <p className="truncate text-[13px] font-semibold text-foreground">
                  {value}
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                  {sub}
                </p>
              </div>
              <ArrowUpRight className="absolute right-5 top-5 h-4 w-4 text-muted-foreground/50 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
            </motion.a>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
