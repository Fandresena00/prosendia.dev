/**
 * @file features/billing/components/plan-card.tsx
 * @description indiviual card for each subscription plan in the billing page.
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconCheck } from "@tabler/icons-react";
import { ArrowRight, CheckCircle } from "lucide-react";
import { Plan } from "../types/billing.types";

interface PlanCardProps {
  plan: Plan;
  onSelect: (plan: Plan) => void;
  formatCurrency: (n: number) => string;
}

export function PackCard({ plan, onSelect, formatCurrency }: PlanCardProps) {
  return (
    <div
      className={`relative rounded-md border flex flex-col ${plan.popular ? "border-primary/40 bg-primary/3" : "border-border/50 bg-card"}`}
    >
      {plan.popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="text-xs px-3">Populaire</Badge>
        </div>
      )}
      <div className="p-5 flex-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
          {plan.name}
        </p>
        <div className="flex items-end gap-1 mb-1">
          <span className="text-2xl font-extrabold">
            {plan.price === 0 ? "Gratuit" : formatCurrency(plan.price)}
          </span>
          {plan.price > 0 && (
            <span className="text-xs text-muted-foreground mb-1">/mois</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-4">{plan.desc}</p>
        <ul className="space-y-2 mb-5">
          {plan.features.map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm">
              <span className="h-4 w-4 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                <IconCheck className="h-2.5 w-2.5 text-emerald-600" />
              </span>
              {f}
            </li>
          ))}
        </ul>
      </div>
      <div className="p-5 pt-0">
        {plan.current ? (
          <div className="flex items-center justify-center gap-2 rounded-md border border-border/50 bg-muted/40 py-2 text-sm text-muted-foreground">
            <CheckCircle className="h-4 w-4 text-emerald-500" /> Plan actuel
          </div>
        ) : (
          <Button
            className="w-full h-9 text-sm gap-2"
            variant={plan.popular ? "default" : "outline"}
            onClick={() => onSelect(plan)}
          >
            Choisir ce plan <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
