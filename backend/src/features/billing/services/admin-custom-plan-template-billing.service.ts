// src/features/admin/services/admin-custom-plan-template-billing.service.ts
//
// Gère la création d'une subscription PENDING CUSTOM via un template,
// déclenchée quand un user achète un plan custom via Papi.
//
// Appelé depuis BillingService.initiatePayment() quand planId ne correspond
// pas à un plan standard (FREE/STARTER/PRO) mais à un UUID de template custom.
//
// Flux :
//   1. initiatePayment(planId=templateId, ...) →
//   2. BillingService détecte que planId n'est pas dans BILLING_PLANS →
//   3. Délègue ici pour créer une sub PENDING basée sur le template →
//   4. Retourne { subscriptionId, amount, ... } pour Papi

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';

@Injectable()
export class AdminCustomPlanTemplateBillingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée une subscription PENDING CUSTOM basée sur un template.
   * Retourne les infos nécessaires pour initier le paiement Papi.
   */
  async createPendingFromTemplate(userId: string, templateId: string): Promise<{
    subscriptionId: string;
    amount:         number;
    credits:        number;
    durationDays:   number;
  }> {
    const template = await this.prisma.customPlanTemplate.findUnique({
      where: { id: templateId, isActive: true, isPublic: true },
    });

    if (!template) {
      throw new NotFoundException(
        `Template custom ${templateId} introuvable ou inactif.`,
      );
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + template.durationDays);

    const sub = await this.prisma.subscription.create({
      data: {
        userId,
        plan:           'CUSTOM',
        status:         'PENDING',
        creditsGranted: template.credits,
        periodStart:    now,
        periodEnd,
      },
      select: { id: true },
    });

    return {
      subscriptionId: sub.id,
      amount:         template.priceAriary,
      credits:        template.credits,
      durationDays:   template.durationDays,
    };
  }

  /**
   * Vérifie si un planId est un UUID de template custom plutôt qu'un plan standard.
   * Les plans standards sont: FREE, STARTER, PRO, CUSTOM (chaînes fixes).
   * Un template custom a un UUID en guise d'ID.
   */
  static isTemplateId(planId: string): boolean {
    // UUID v4 pattern
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(planId);
  }
}
