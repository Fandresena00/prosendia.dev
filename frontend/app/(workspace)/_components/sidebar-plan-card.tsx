/**
 * @file components/sidebar-plan-card.tsx
 * @description Plan usage card in the sidebar footer.
 * Reads plan + usage from the auth store.
 * Hides the upgrade button for ENTERPRISE users.
 */

"use client";

import { Button } from "@/components/ui/button";
import type { Plan } from "@/features/auth/schemas/user.schema";
import { useCurrentUser } from "@/features/auth/store/auth.store";
import Link from "next/link";

const PLAN_LABELS: Record<Plan, string> = {
  FREE: "Plan Gratuit",
  PRO: "Plan Pro",
  ENTERPRISE: "Enterprise",
};

export function SidebarPlanCard() {
  const user = useCurrentUser();
  const plan: Plan = user?.activePlan ?? "FREE";
  const showUpgrade = plan !== "ENTERPRISE";

  // TODO: replace with real usage from an API query
  const used = 127;
  const limit = 500;
  const percent = Math.min((used / limit) * 100, 100);

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/6 px-3 py-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[11px] font-semibold text-primary">
          {PLAN_LABELS[plan]}
        </p>
        {showUpgrade && (
          <Button
            size="sm"
            className="h-6 px-2.5 text-[10px] font-semibold rounded-md"
            style={{ boxShadow: "0 0 8px oklch(0.52 0.24 256 / 20%)" }}
            asChild
          >
            <Link href="/billing">Upgrade</Link>
          </Button>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <div className="h-1.5 flex-1 rounded-full bg-border/60">
          <div
            className="h-1.5 rounded-full bg-primary transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
          {used}/{limit}
        </p>
      </div>
    </div>
  );
}
