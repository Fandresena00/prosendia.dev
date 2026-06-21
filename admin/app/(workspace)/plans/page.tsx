// (workspace)/plans/page.tsx

"use client";

import { adminPlansApi, type AdminPlan } from "@/lib/admin-api";
import { useEffect, useState } from "react";

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<AdminPlan[]>([]);

  useEffect(() => {
    adminPlansApi.list().then(setPlans);
  }, []);

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-zinc-100">Plans</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Catalogue défini dans le backend (billing.constants.ts) — lecture seule.
      </p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-5"
          >
            <h2 className="text-sm font-semibold text-zinc-100">{plan.name}</h2>
            <p className="mt-1 text-xl font-semibold text-zinc-100">
              {plan.priceAriary !== null
                ? `${plan.priceAriary.toLocaleString("fr-FR")} Ar`
                : "Sur devis"}
              {plan.priceAriary !== null && (
                <span className="text-xs font-normal text-zinc-500">
                  {" "}
                  / {plan.durationDays}j
                </span>
              )}
            </p>
            <ul className="mt-3 space-y-1 text-xs text-zinc-400">
              <li>
                {plan.credits !== null
                  ? `${plan.credits.toLocaleString("fr-FR")} crédits`
                  : "Crédits personnalisés"}
              </li>
              <li>
                {plan.maxPages !== null
                  ? `${plan.maxPages} page(s)`
                  : "Pages illimitées"}
              </li>
              <li>
                {plan.maxManagedPosts !== null
                  ? `${plan.maxManagedPosts} posts gérés`
                  : "Posts illimités"}
              </li>
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
