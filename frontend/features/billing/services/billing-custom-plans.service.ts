/**
 * @file features/billing/services/billing-custom-plans.service.ts
 *
 * Fetche la config custom de CET user depuis GET /billing/custom-plan (singulier).
 * Retourne null si l'user n'a pas de config ou si l'endpoint n'existe pas encore.
 */

import { apiClient } from "@/lib/api-client";
import type { CustomPlanTemplate } from "../components/packs-card";

export const billingCustomPlansService = {
  /**
   * Retourne la config custom propre à cet utilisateur (null si aucune).
   * Silencieux si le backend n'a pas encore l'endpoint.
   */
  async getMyCustomPlan(): Promise<CustomPlanTemplate | null> {
    try {
      return await apiClient<CustomPlanTemplate | null>("/billing/custom-plan");
    } catch {
      return null;
    }
  },
};
