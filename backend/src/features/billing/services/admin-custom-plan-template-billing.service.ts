// src/features/admin/services/admin-custom-plan-template-billing.service.ts
//
// FIX: utilise this.prisma.customPlanConfig (le modèle réel, user-specific)
// au lieu de this.prisma.customPlanTemplate (ancien nom, n'existe plus).
//
// Gère la création d'une subscription PENDING CUSTOM quand un user achète
// SA config custom via Papi.
//
// Appelé depuis BillingService.initiatePayment() quand planId correspond
// à l'ID d'une CustomPlanConfig plutôt qu'à un plan standard (FREE/STARTER/PRO).

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';

@Injectable()
export class AdminCustomPlanTemplateBillingService {
  constructor(private readonly prisma: PrismaService) {}

  async getPurchasableConfig(userId: string, configId: string) {
    const config = await this.prisma.customPlanConfig.findUnique({
      where: { id: configId },
    });

    if (!config) {
      throw new NotFoundException(`Config custom ${configId} introuvable.`);
    }
    if (config.userId !== userId) {
      throw new NotFoundException(
        `Cette config custom n'appartient pas à cet utilisateur.`,
      );
    }
    if (!config.isVisible || !config.isPurchasable) {
      throw new NotFoundException(
        `Cette config custom n'est pas disponible à l'achat.`,
      );
    }

    return config;
  }

  /**
   * Crée une subscription PENDING CUSTOM basée sur la config custom du user.
   * Vérifie que la config appartient bien à userId (sécurité — un user ne
   * peut acheter que SA PROPRE config, jamais celle d'un autre).
   */
  async createPendingFromTemplate(
    userId: string,
    configId: string,
  ): Promise<{
    subscriptionId: string;
    name: string;
    amount: number;
    credits: number;
    durationDays: number;
    maxPages: number;
    maxManagedPosts: number;
    maxReferenceImages: number;
  }> {
    const config = await this.getPurchasableConfig(userId, configId);

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + config.durationDays);

    const sub = await this.prisma.subscription.create({
      data: {
        userId,
        plan: 'CUSTOM',
        status: 'PENDING',
        creditsGranted: config.credits,
        periodStart: now,
        periodEnd,
      },
      select: { id: true },
    });

    return {
      subscriptionId: sub.id,
      name: config.name,
      amount: config.priceAriary,
      credits: config.credits,
      durationDays: config.durationDays,
      maxPages: config.maxPages,
      maxManagedPosts: config.maxManagedPosts,
      maxReferenceImages: config.maxReferenceImages,
    };
  }

  /**
   * Vérifie si un planId est l'UUID d'une config custom plutôt qu'un plan
   * standard (FREE/STARTER/PRO/CUSTOM sont des chaînes fixes, pas des UUID).
   */
  static isConfigId(planId: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      planId,
    );
  }
}
