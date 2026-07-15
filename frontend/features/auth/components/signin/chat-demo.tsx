"use client";

import { EASE } from "@/lib/motion";
import { motion } from "framer-motion";

export function ChatDemo() {
  const messages = [
    {
      who: "Client",
      msg: "Bonjour, ce produit est-il disponible en rouge ?",
      ai: false,
    },
    {
      who: "prosendia",
      msg: "Oui ! Disponible en rouge et bleu. Livraison 48h.",
      ai: true,
    },
    { who: "Client", msg: "Super, je commande le rouge alors 🙌", ai: false },
  ];

  return (
    <div className="rounded-2xl border border-border/40 bg-background/40 p-4 backdrop-blur-sm">
      <div className="mb-4 flex items-center gap-2.5 border-b border-border/30 pb-3">
        <span
          className="h-1.5 w-1.5 rounded-full bg-emerald-400"
          style={{ boxShadow: "0 0 6px #34d399" }}
        />
        <span className="text-[11px] font-medium text-muted-foreground">
          Ma Boutique Mode · IA Active
        </span>
        <div className="ml-auto flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5">
          <span className="text-[9px] font-semibold text-emerald-400">
            LIVE
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {messages.map(({ who, msg, ai }, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: ai ? 8 : -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.8 + i * 0.2 }}
            className={`flex items-start gap-2 ${ai ? "flex-row-reverse" : ""}`}
          >
            <div
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
              style={{
                background: ai
                  ? "oklch(0.52 0.24 256 / 20%)"
                  : "oklch(0.22 0.05 258 / 60%)",
                color: ai ? "oklch(0.72 0.18 256)" : "oklch(0.75 0.03 255)",
              }}
            >
              {ai ? "AI" : who[0]}
            </div>
            <div
              className="max-w-[80%] px-3 py-2 text-[11px] leading-relaxed"
              style={{
                background: ai
                  ? "oklch(0.52 0.24 256)"
                  : "oklch(0.18 0.04 260 / 80%)",
                color: ai ? "white" : "oklch(0.82 0.02 255)",
                borderRadius: ai
                  ? "1rem 1rem 0.25rem 1rem"
                  : "1rem 1rem 1rem 0.25rem",
              }}
            >
              {msg}
            </div>
          </motion.div>
        ))}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6 }}
          className="flex items-center gap-1.5 pl-8"
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-primary"
              style={{
                animation: `typing-dot 1.2s ease-in-out infinite`,
                animationDelay: `${i * 0.2}s`,
                opacity: 0.6,
              }}
            />
          ))}
          <span className="ml-1 text-[10px] text-muted-foreground">
            prosendia répond…
          </span>
        </motion.div>
      </div>

      <style>{`@keyframes typing-dot { 0%,60%,100%{opacity:0.3;transform:translateY(0)} 30%{opacity:1;transform:translateY(-3px)} }`}</style>
    </div>
  );
}
