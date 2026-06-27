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
import { CreditService } from '../../billing/services/credit.service.js';
import type { CreateCustomSubscriptionDto } from '../dto/admin-custom-subscription.dto.js';

@Injectable()
export class AdminCustomSubscriptionService {
  private readonly logger = new Logger(AdminCustomSubscriptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly credits: CreditService,
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

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + dto.durationDays);

    // 2. Transaction : expirer subs actives + créer CUSTOM ACTIVE
    const sub = await this.prisma.$transaction(async (tx) => {
      // Expirer toutes les subscriptions actives existantes
      await tx.subscription.updateMany({
        where: { userId: targetUserId, status: 'ACTIVE' },
        data:  { status: 'EXPIRED' },
      });

      // Créer la nouvelle subscription CUSTOM directement ACTIVE
      const newSub = await tx.subscription.create({
        data: {
          userId:         targetUserId,
          plan:           'CUSTOM',
          status:         'ACTIVE',
          creditsGranted: dto.credits,
          periodStart:    now,
          periodEnd,
        },
      });

      // Mettre à jour le plan de l'utilisateur
      await tx.user.update({
        where: { id: targetUserId },
        data:  { activePlan: 'CUSTOM' },
      });

      // Stocker la config custom si le modèle CustomSubscriptionConfig existe
      // (à activer quand le modèle Prisma est migré)
      // await tx.customSubscriptionConfig.upsert({ ... })

      return newSub;
    });

    this.logger.log(
      `[CUSTOM_SUB_CREATED] subscriptionId=${sub.id} user=${targetUserId} ` +
      `credits=${dto.credits} days=${dto.durationDays} periodEnd=${periodEnd.toISOString()}`,
    );

    // 3. Attribuer les crédits (SET au quota complet)
    await this.credits.grantCredits(
      targetUserId,
      sub.id,
      dto.credits,
      `Custom (admin) — ${dto.note ?? 'Plan personnalisé'}`,
    );

    this.logger.log(
      `[CREDITS_GRANTED] ${dto.credits} crédits → user=${targetUserId}`,
    );

    // 4. Audit log
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
      periodEnd,
      userId:         targetUserId,
    };
  }
}
