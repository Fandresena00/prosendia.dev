"use client";

import { fadeUpVariant, stagger } from "@/lib/motion";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { SectionHeader } from "../_sections/section-header";

export function Faq() {
  return (
    <section id="faq" className="relative z-10 px-6 py-24">
      <div className="mx-auto max-w-2xl">
        <SectionHeader
          label="FAQ"
          title="Questions fréquentes"
          sub="Tout ce que vous devez savoir"
        />

        <motion.div
          className="space-y-2.5"
          variants={stagger(0.06)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
        >
          {[
            {
              q: "L'IA peut-elle faire des erreurs dans les réponses ?",
              a: "L'IA est entraînée pour donner des réponses précises, mais elle peut parfois mal interpréter un message complexe. C'est pourquoi vous pouvez toujours reprendre la main et corriger manuellement.",
            },
            {
              q: "Puis-je reprendre la main à tout moment ?",
              a: "Absolument ! Le mode humain vous permet d'intervenir à tout moment dans une conversation. L'IA détecte automatiquement quand elle doit vous passer la main pour les cas complexes.",
            },
            {
              q: "Fonctionne-t-il avec plusieurs pages Facebook ?",
              a: "Oui ! Selon votre plan, vous pouvez connecter plusieurs pages Facebook. Chaque page peut avoir ses propres règles d'automatisation et produits.",
            },
            {
              q: "Mes données sont-elles sécurisées ?",
              a: "Oui, la sécurité est notre priorité. Nous utilisons le protocole OAuth de Facebook pour la connexion, et toutes vos données sont chiffrées et stockées de manière sécurisée.",
            },
            {
              q: "Combien de temps faut-il pour la mise en place ?",
              a: "Moins de 5 minutes ! Il suffit de connecter votre page Facebook, ajouter vos produits, et configurer quelques règles simples.",
            },
          ].map(({ q, a }) => (
            <motion.details
              key={q}
              variants={fadeUpVariant}
              className="group rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 text-[13px] font-semibold text-foreground [list-style:none] [&::-webkit-details-marker]:hidden">
                {q}
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="px-5 pb-5">
                <p className="text-[12px] leading-relaxed text-muted-foreground">
                  {a}
                </p>
              </div>
            </motion.details>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
