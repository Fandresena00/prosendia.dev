// src/features/admin/services/admin-custom-subscription.service.ts
//
// Crée ou remplace un abonnement CUSTOM pour un utilisateur ciblé.
// Ce service est INDÉPENDANT du BillingModule — il accède directement
// à Prisma et à CreditService (importé via BillingModule dans AdminModule).
//
// Endpoint : POST /admin/users/:id/subscription/custom

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import { SubscriptionService } from '../../billing/services/subscription.service.js';
import { resolveCustomBillingPlan } from '../../billing/billing.constants.js';
import type { CreateCustomSubscriptionDto } from '../dto/admin-custom-subscription.dto.js';

@Injectable()
export class AdminCustomSubscriptionService {
  private readonly logger = new Logger(AdminCustomSubscriptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionService,
  ) {}

  async createCustomSubscription(
    targetUserId: string,
    dto: CreateCustomSubscriptionDto,
    adminId: string,
  ) {
    // 1. Vérifier que l'utilisateur existe
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, email: true, activePlan: true },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');

    if (dto.credits <= 0) {
      throw new BadRequestException('Le nombre de crédits doit être positif.');
    }
    if (dto.durationDays <= 0 || dto.durationDays > 3650) {
      throw new BadRequestException('Durée invalide (1–3650 jours).');
    }

    const customPlan = resolveCustomBillingPlan({
      name: 'Custom',
      priceAriary: dto.priceAriary,
      durationDays: dto.durationDays,
      credits: dto.credits,
      maxPages: dto.maxPages,
      maxManagedPosts: dto.maxManagedPosts,
      maxReferenceImages: dto.maxReferenceImages,
    });

    await this.prisma.customPlanConfig.upsert({
      where: { userId: targetUserId },
      create: {
        userId: targetUserId,
        name: 'Plan Custom',
        description: dto.note ?? null,
        priceAriary: dto.priceAriary,
        durationDays: dto.durationDays,
        credits: dto.credits,
        maxPages: dto.maxPages,
        maxManagedPosts: dto.maxManagedPosts,
        maxReferenceImages: dto.maxReferenceImages,
        isVisible: true,
        isPurchasable: false,
        createdByAdminId: adminId,
        note: dto.note,
      },
      update: {
        priceAriary: dto.priceAriary,
        durationDays: dto.durationDays,
        credits: dto.credits,
        maxPages: dto.maxPages,
        maxManagedPosts: dto.maxManagedPosts,
        maxReferenceImages: dto.maxReferenceImages,
        isVisible: true,
        isPurchasable: false,
        note: dto.note,
      },
    });

    const subscriptionId = await this.subscriptions.createManualSubscription(
      targetUserId,
      'CUSTOM',
      {
        credits: customPlan.credits ?? dto.credits,
        durationDays: customPlan.durationDays,
        planName: `Custom (admin) — ${dto.note ?? 'Plan personnalisé'}`,
      },
    );

    const sub = await this.prisma.subscription.findUniqueOrThrow({
      where: { id: subscriptionId },
      select: { id: true, periodEnd: true },
    });

    this.logger.log(
      `[CUSTOM_SUB_CREATED] subscriptionId=${sub.id} user=${targetUserId} ` +
      `credits=${dto.credits} days=${dto.durationDays} periodEnd=${sub.periodEnd.toISOString()}`,
    );

    // 3. Audit log
    await this.prisma.adminAuditLog.create({
      data: {
        adminId,
        action:     'CHANGE_PLAN',
        targetType: 'USER',
        targetId:   targetUserId,
        metadata: {
          plan:        'CUSTOM',
          credits:     dto.credits,
          durationDays: dto.durationDays,
          priceAriary:  dto.priceAriary,
          maxPages:     dto.maxPages,
          maxManagedPosts: dto.maxManagedPosts,
          maxReferenceImages: dto.maxReferenceImages,
          note:        dto.note,
          subscriptionId: sub.id,
        },
      },
    });

    return {
      subscriptionId: sub.id,
      plan:           'CUSTOM',
      credits:        dto.credits,
      periodEnd:      sub.periodEnd,
      userId:         targetUserId,
    };
  }
}
