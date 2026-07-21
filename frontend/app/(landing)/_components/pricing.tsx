"use client";

import { fadeUpVariant, stagger } from "@/lib/motion";
import { billingService } from "@/features/billing/services/billing.service";
import type { Plan } from "@/features/billing/types/billing.types";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckItem } from "../_sections/check-item";
import { SectionHeader } from "../_sections/section-header";

type FetchState = "loading" | "ready" | "error";

function formatPrice(priceAriary: number | null) {
  if (priceAriary === null) return "Sur devis";
  if (priceAriary === 0) return "Gratuit";
  return `${priceAriary.toLocaleString("fr-MG")} Ar`;
}

function formatCredits(credits: number | null) {
  return credits === null
    ? "Crédits personnalisés"
    : `${credits.toLocaleString("fr-MG")} crédits IA`;
}

/** Tagline dérivée du prix/des crédits — pas de mapping par id, donc
 *  n'importe quel nouveau plan renvoyé par le backend s'affiche correctement
 *  sans modification de ce fichier. */
function tagline(plan: Plan) {
  if (plan.priceAriary === null) return "Pour les grandes équipes";
  if (plan.priceAriary === 0) return "Pour découvrir";
  return plan.supportPriority ? "Pour les vendeurs actifs" : "Pour démarrer";
}

function ctaLabel(plan: Plan) {
  if (plan.priceAriary === null) return "Nous contacter";
  if (plan.priceAriary === 0) return "Commencer gratuitement";
  return "Commencer l'essai gratuit";
}

function PlanCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-border/50 bg-card/60 p-6">
      <div className="mb-3 h-3 w-16 rounded bg-secondary/60" />
      <div className="mb-2 h-8 w-24 rounded bg-secondary/60" />
      <div className="mb-6 h-3 w-28 rounded bg-secondary/60" />
      <div className="mb-7 space-y-2.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-3 w-full rounded bg-secondary/40" />
        ))}
      </div>
      <div className="h-9 w-full rounded-xl bg-secondary/60" />
    </div>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const cta = ctaLabel(plan);
  const isContact = plan.priceAriary === null;

  const button = (
    <button
      className={`w-full rounded-xl py-2.5 text-[12px] font-semibold transition-all ${
        plan.popular
          ? "bg-primary text-primary-foreground hover:opacity-90"
          : "border border-border/60 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
      }`}
    >
      {cta}
    </button>
  );

  const body = (
    <>
      <p
        className={`mb-1 text-[10px] font-semibold uppercase tracking-widest ${
          plan.popular ? "text-primary" : "text-muted-foreground"
        }`}
      >
        {plan.name}
      </p>
      <div className="mb-1 flex items-end gap-1">
        <span className="text-[1.75rem] font-extrabold text-foreground">
          {formatPrice(plan.priceAriary)}
        </span>
        {plan.priceAriary !== null && plan.priceAriary > 0 && (
          <span className="mb-1 text-[11px] text-muted-foreground">
            /{plan.durationDays} jours
          </span>
        )}
      </div>
      <p className="mb-6 text-[11px] text-muted-foreground">
        {tagline(plan)} · {formatCredits(plan.credits)}
      </p>
      <ul className="mb-7 space-y-2.5">
        {plan.features.map((t) => (
          <CheckItem key={t} text={t} />
        ))}
      </ul>
      {isContact ? (
        <a href="mailto:contact@genforus.com">{button}</a>
      ) : (
        <Link href="/sign-up">{button}</Link>
      )}
    </>
  );

  if (plan.popular) {
    return (
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
        <div className="h-full rounded-2xl bg-card p-6">{body}</div>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={fadeUpVariant}
      className="rounded-2xl border border-border/50 bg-card/60 p-6 backdrop-blur-sm"
    >
      {body}
    </motion.div>
  );
}

export function Pricing() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [state, setState] = useState<FetchState>("loading");

  useEffect(() => {
    let active = true;
    billingService
      .getPlans()
      .then((data) => {
        if (!active) return;
        // Cheapest first — "sur devis" (priceAriary: null) sorts last.
        const sorted = [...data].sort((a, b) => {
          const pa = a.priceAriary ?? Number.POSITIVE_INFINITY;
          const pb = b.priceAriary ?? Number.POSITIVE_INFINITY;
          return pa - pb;
        });
        setPlans(sorted);
        setState("ready");
      })
      .catch(() => {
        if (active) setState("error");
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section id="pricing" className="relative z-10 px-6 py-24">
      <div className="mx-auto max-w-4xl">
        <SectionHeader
          label="Tarifs"
          title="Tarifs simples et transparents"
          sub="Commencez gratuitement, évoluez selon vos besoins"
        />

        {state === "loading" && (
          <div className="grid gap-4 md:grid-cols-3">
            <PlanCardSkeleton />
            <PlanCardSkeleton />
            <PlanCardSkeleton />
          </div>
        )}

        {state === "error" && (
          <div className="rounded-2xl border border-border/50 bg-card/60 p-10 text-center backdrop-blur-sm">
            <p className="mb-1 text-sm font-semibold text-foreground">
              Nos tarifs sont momentanément indisponibles
            </p>
            <p className="mb-5 text-[12px] text-muted-foreground">
              Contactez-nous directement, on vous les communique tout de suite.
            </p>
            <a
              href="mailto:contact@genforus.com"
              className="inline-flex rounded-xl bg-primary px-5 py-2.5 text-[12px] font-semibold text-primary-foreground transition-all hover:opacity-90"
            >
              Nous contacter
            </a>
          </div>
        )}

        {state === "ready" && (
          <motion.div
            className="grid gap-4 md:grid-cols-3"
            variants={stagger(0.1)}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
          >
            {plans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} />
            ))}
          </motion.div>
        )}
      </div>
    </section>
  );
}
