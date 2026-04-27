/**
 * @file features/billing/hooks/use-billing.ts
 * @description hooks for the billing page, providing data and utilities related to subscription plans and payment history.
 */

import { useState } from "react";
import { HISTORY, PLANS } from "../data/mok";

export function useBilling() {
  const [plans] = useState(PLANS);
  const [history] = useState(HISTORY);

  const currentPlan = plans.find((p) => p.current);

  const formatCurrency = (n: number) => {
    return n.toLocaleString("fr-MG") + " Ar";
  };

  return {
    plans,
    history,
    currentPlan,
    formatCurrency,
  };
}
