/**
 * @file features/billing/services/subscription.service.ts
 *
 * Cycle de vie des abonnements :
 *   PENDING  → en attente de confirmation Papi
 *   ACTIVE   → paiement confirmé, crédits attribués
 *   EXPIRED  → période terminée, basculé FREE
 *   CANCELLED → annulé (lien expiré ou paiement échoué)
 *
 * Abonnement sur 30 jours, renouvellement manuel uniquement.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../database/prisma.service.js';
import { BILLING_PLANS } from '../billing.constants.js';
import type { SubscriptionStatusDto } from '../dto/billing.dto.js';
import { CreditService } from './credit.service.js';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private readonly prisma:   PrismaService,
    private readonly credits:  CreditService,
  ) {}

  // ─── Get active ───────────────────────────────────────────────────────────

  async getActiveSubscription(userId: string): Promise<SubscriptionStatusDto | null> {
    const sub = await this.prisma.subscription.findFirst({
      where:   { userId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });
    if (!sub) return null;

    const user       = await this.prisma.user.findUnique({
      where:  { id: userId },
      select: { creditBalance: true },
    });
    const planConfig = BILLING_PLANS[sub.plan as keyof typeof BILLING_PLANS];

    return {
      id:             sub.id,
      plan:           sub.plan,
      planName:       planConfig?.name ?? sub.plan,
      status:         sub.status,
      periodStart:    sub.periodStart,
      periodEnd:      sub.periodEnd,
      isActive:       true,
      creditBalance:  user?.creditBalance ?? 0,
      creditsGranted: sub.creditsGranted,
    };
  }

  // ─── Create pending ───────────────────────────────────────────────────────

  async createPendingSubscription(userId: string, planId: string): Promise<string> {
    const planConfig = BILLING_PLANS[planId as keyof typeof BILLING_PLANS];
    if (!planConfig || planConfig.priceAriary === null) {
      throw new Error(`Plan ${planId} non disponible pour paiement`);
    }

    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + planConfig.durationDays);

    const sub = await this.prisma.subscription.create({
      data: {
        userId,
        plan:           planId as any,
        status:         'PENDING',
        creditsGranted: planConfig.credits!,
        periodStart:    now,
        periodEnd:      end,
      },
      select: { id: true },
    });

    return sub.id;
  }

  // ─── Activate ─────────────────────────────────────────────────────────────

  async activateSubscription(subscriptionId: string): Promise<void> {
    const sub = await this.prisma.subscription.findUnique({
      where:  { id: subscriptionId },
      select: { userId: true, plan: true, creditsGranted: true },
    });
    if (!sub) throw new Error(`Subscription ${subscriptionId} not found`);

    const planConfig = BILLING_PLANS[sub.plan as keyof typeof BILLING_PLANS];

    await this.prisma.$transaction(async (tx) => {
      // Expirer les anciens abonnements actifs
      await tx.subscription.updateMany({
        where: { userId: sub.userId, status: 'ACTIVE', id: { not: subscriptionId } },
        data:  { status: 'EXPIRED' },
      });
      // Activer
      await tx.subscription.update({
        where: { id: subscriptionId },
        data:  { status: 'ACTIVE' },
      });
      // Mettre à jour le plan user
      await tx.user.update({
        where: { id: sub.userId },
        data:  { activePlan: sub.plan as any },
      });
    });

    await this.credits.grantCredits(
      sub.userId,
      subscriptionId,
      sub.creditsGranted,
      planConfig?.name ?? sub.plan,
    );

    this.logger.log(
      `Subscription activated: id=${subscriptionId} user=${sub.userId} plan=${sub.plan} credits=${sub.creditsGranted}`,
    );
  }

  // ─── Expire (cron 02:00 daily) ────────────────────────────────────────────

  @Cron('0 2 * * *')
  async expireSubscriptions(): Promise<void> {
    const now     = new Date();
    const expired = await this.prisma.subscription.findMany({
      where: { status: 'ACTIVE', periodEnd: { lt: now } },
      select: { id: true, userId: true, plan: true },
    });

    if (!expired.length) return;
    this.logger.log(`Expiring ${expired.length} subscription(s)`);

    for (const sub of expired) {
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.subscription.update({ where: { id: sub.id }, data: { status: 'EXPIRED' } });
          await tx.user.update({ where: { id: sub.userId }, data: { activePlan: 'FREE' } });
        });
        await this.credits.grantCredits(
          sub.userId, sub.id, BILLING_PLANS.FREE.credits, 'Gratuit (abonnement expiré)',
        );
        this.logger.log(`Expired: id=${sub.id} user=${sub.userId} → FREE`);
      } catch (err: unknown) {
        this.logger.error(`Expire failed ${sub.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  // ─── Cancel expired pending payments (cron hourly) ───────────────────────

  @Cron(CronExpression.EVERY_HOUR)
  async cancelExpiredPending(): Promise<void> {
    const now     = new Date();
    const expired = await this.prisma.payment.findMany({
      where: { status: 'PENDING', expiresAt: { lt: now } },
      select: { id: true, subscriptionId: true },
    });
    if (!expired.length) return;

    const ids    = expired.map((p) => p.id);
    const subIds = [...new Set(expired.map((p) => p.subscriptionId))];

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.updateMany({
        where: { id: { in: ids } },
        data:  { status: 'FAILED', failureReason: 'Lien expiré' },
      });
      await tx.subscription.updateMany({
        where: { id: { in: subIds }, status: 'PENDING' },
        data:  { status: 'CANCELLED' },
      });
    });

    this.logger.debug(`Cancelled ${expired.length} expired pending payment(s)`);
  }
}
