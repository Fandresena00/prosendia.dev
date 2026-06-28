/**
 * @file features/billing/services/billing-custom-plans.service.ts
 *
 * Fetche les templates de plans custom publics depuis le backend.
 * Utilisé par la page /billing pour afficher les offres custom achetables.
 *
 * Endpoint: GET /billing/custom-plans (route publique côté user, voir NOTE ci-dessous)
 *
 * NOTE : Il faut ajouter cet endpoint dans BillingController côté backend :
 *   GET /billing/custom-plans → délègue à AdminCustomPlanTemplateService.listPublicTemplates()
 *   Protégé par JwtAuthGuard comme les autres routes billing.
 */

import { apiClient } from "@/lib/api-client";
import type { CustomPlanTemplate } from "../components/packs-card";

export const billingCustomPlansService = {
  /**
   * Retourne les templates custom publics et actifs.
   * Retourne [] si aucun template ou si le backend n'a pas encore l'endpoint.
   */
  async getPublicTemplates(): Promise<CustomPlanTemplate[]> {
    try {
      return await apiClient<CustomPlanTemplate[]>("/billing/custom-plans");
    } catch {
      // Silencieux : si l'endpoint n'existe pas encore, on retourne []
      // → la PackCard affichera "Nous contacter" par défaut
      return [];
    }
  },
};
