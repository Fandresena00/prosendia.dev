"use client";

import { fadeUpVariant, stagger } from "@/lib/motion";
import { IconBrandFacebook, IconRobot, IconUsers } from "@tabler/icons-react";
import { motion } from "framer-motion";
import {
  LucideBolt,
  LucideChartBarBig,
  LucideShieldCheck,
  MessageCircleMore,
  Settings,
  ShoppingBagIcon,
} from "lucide-react";
import { SectionHeader } from "../_sections/section-header";

export function Features() {
  return (
    <section id="features" className="relative z-10 px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <SectionHeader
          label="Fonctionnalités"
          title="Fonctionnalités puissantes"
          sub="Tout ce dont vous avez besoin pour automatiser vos ventes Facebook"
        />

        <motion.div
          className="grid gap-3 md:grid-cols-2 lg:grid-cols-3"
          variants={stagger(0.07)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          {[
            {
              icon: MessageCircleMore,
              title: "Réponses automatiques",
              desc: "Messages privés et commentaires répondus automatiquement",
            },
            {
              icon: IconRobot,
              title: "IA intelligente",
              desc: "Compréhension du contexte et adaptation selon vos produits",
            },
            {
              icon: IconUsers,
              title: "Mode humain",
              desc: "Reprenez la main à tout moment pour les cas complexes",
            },
            {
              icon: IconBrandFacebook,
              title: "Gestion commentaires",
              desc: "Réponses aux commentaires + envoi de DM automatique",
            },
            {
              icon: ShoppingBagIcon,
              title: "Gestion produits",
              desc: "Base de données avec prix, disponibilité et descriptions",
            },
            {
              icon: Settings,
              title: "Automatisation",
              desc: "Règles simples pour personnaliser chaque réponse",
            },
            {
              icon: LucideChartBarBig,
              title: "Analytics",
              desc: "Messages traités, taux de conversion, tendances",
            },
            {
              icon: LucideBolt,
              title: "Mise en place rapide",
              desc: "Configuration en moins de 5 minutes, opérationnel immédiatement",
            },
            {
              icon: LucideShieldCheck,
              title: "Sécurisé",
              desc: "OAuth Facebook officiel, données chiffrées et protégées",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <motion.div
              key={title}
              variants={fadeUpVariant}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
              className="group rounded-2xl border border-border/50 bg-card/60 p-5 backdrop-blur-sm transition-colors hover:border-primary/35 hover:bg-card/80"
            >
              <div className="mb-3.5 flex h-8 w-8 items-center justify-center rounded-xl bg-primary/12">
                <Icon className="h-4 w-4 text-primary" />
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
