"use client";

// app/(workspace)/plans/page.tsx

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { adminPlansApi, type AdminPlan } from "@/lib/admin-api";
import { cn } from "@/lib/utils";
import { Check, Zap } from "lucide-react";
import { useEffect, useState } from "react";

const PLAN_ACCENT: Record<
  string,
  { ring: string; badge: string; icon: string }
> = {
  FREE: {
    ring: "ring-zinc-800",
    badge: "border-zinc-700 text-zinc-400",
    icon: "text-zinc-500 bg-zinc-800",
  },
  STARTER: {
    ring: "ring-blue-900/40",
    badge: "border-blue-800/40 text-blue-400",
    icon: "text-blue-400 bg-blue-950/60",
  },
  PRO: {
    ring: "ring-emerald-900/40",
    badge: "border-emerald-800/40 text-emerald-400",
    icon: "text-emerald-400 bg-emerald-950/60",
  },
  CUSTOM: {
    ring: "ring-purple-900/40",
    badge: "border-purple-800/40 text-purple-400",
    icon: "text-purple-400 bg-purple-950/60",
  },
};

function PlanCard({ plan }: { plan: AdminPlan }) {
  const accent = PLAN_ACCENT[plan.id] ?? PLAN_ACCENT.FREE;

  const specs = [
    plan.credits !== null
      ? `${plan.credits.toLocaleString("fr-FR")} crédits`
      : "Crédits personnalisés",
    plan.maxPages !== null
      ? `${plan.maxPages} page${plan.maxPages > 1 ? "s" : ""} Facebook`
      : "Pages illimitées",
    plan.maxManagedPosts !== null
      ? `${plan.maxManagedPosts} posts gérés`
      : "Posts illimités",
    plan.maxReferenceImages !== null
      ? `${plan.maxReferenceImages} images de référence`
      : null,
  ].filter(Boolean);

  return (
    <Card
      className={cn("border-zinc-800/60 bg-zinc-900/50 ring-1", accent.ring)}
    >
      <CardHeader className="pb-2 pt-5">
        <div className="flex items-start justify-between">
          <div>
            <Badge
              variant="outline"
              className={cn("mb-2 text-[10px] font-semibold", accent.badge)}
            >
              {plan.name}
            </Badge>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-2xl font-semibold tabular-nums text-zinc-100">
                {plan.priceAriary !== null
                  ? plan.priceAriary.toLocaleString("fr-FR")
                  : "—"}
              </span>
              {plan.priceAriary !== null && (
                <span className="text-[12px] text-zinc-500">
                  Ar / {plan.durationDays}j
                </span>
              )}
              {plan.priceAriary === null && (
                <span className="text-[13px] text-zinc-500">Sur devis</span>
              )}
            </div>
          </div>
          <div className={cn("rounded-lg p-2", accent.icon)}>
            <Zap className="h-4 w-4" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <ul className="space-y-2">
          {specs.map((spec) => (
            <li
              key={spec}
              className="flex items-center gap-2 text-[12px] text-zinc-400"
            >
              <Check className="h-3 w-3 shrink-0 text-zinc-600" />
              {spec}
            </li>
          ))}
          {plan.features.map((feature) => (
            <li
              key={feature}
              className="flex items-center gap-2 text-[12px] text-zinc-400"
            >
              <Check className="h-3 w-3 shrink-0 text-zinc-600" />
              {feature}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function PlanSkeleton() {
  return (
    <Card className="border-zinc-800/60 bg-zinc-900/50">
      <CardContent className="p-5 space-y-3">
        <Skeleton className="h-4 w-16 bg-zinc-800" />
        <Skeleton className="h-8 w-28 bg-zinc-800" />
        <div className="space-y-2 pt-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-3.5 w-full bg-zinc-800" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminPlansApi
      .list()
      .then(setPlans)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-[18px] font-semibold tracking-tight text-zinc-100">
          Plans
        </h1>
        <p className="mt-0.5 text-[13px] text-zinc-500">
          Catalogue défini dans{" "}
          <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-[11px] text-zinc-400">
            billing.constants.ts
          </code>{" "}
          — lecture seule.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <PlanSkeleton key={i} />)
          : plans.map((plan) => <PlanCard key={plan.id} plan={plan} />)}
      </div>
    </div>
  );
}
