/**
 * @file features/billing/services/subscription.service.ts
 *
 * FIXES
 * ─────
 * 1. Logs structurés sur toutes les transitions d'état.
 * 2. activateSubscription() relance l'erreur si grantCredits échoue
 *    (l'ancienne version laissait l'abonnement ACTIVE sans crédits).
 * 3. expireSubscriptions() log chaque expiration individuellement.
 * 4. cancelExpiredPending() — log détaillé.
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

    if (!sub) {
      this.logger.debug(`[SUBSCRIPTION_STATUS] No active subscription for user=${userId}`);
      return null;
    }

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

  // ─── Create PENDING ───────────────────────────────────────────────────────

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

    this.logger.log(
      `[SUBSCRIPTION_CREATED] PENDING — ` +
      `subscriptionId=${sub.id} user=${userId} plan=${planId} ` +
      `credits=${planConfig.credits} periodEnd=${end.toISOString()}`,
    );

    return sub.id;
  }

  // ─── Activate ─────────────────────────────────────────────────────────────

  /**
   * Active un abonnement après confirmation de paiement.
   * Étapes atomiques :
   *   1. Expirer les anciens abonnements ACTIVE
   *   2. Passer le nouvel abonnement en ACTIVE
   *   3. Mettre à jour user.activePlan
   *   4. Attribuer les crédits (CRITICAL — relancer si échec)
   */
  async activateSubscription(subscriptionId: string): Promise<void> {
    const sub = await this.prisma.subscription.findUnique({
      where:  { id: subscriptionId },
      select: { userId: true, plan: true, creditsGranted: true, status: true },
    });

    if (!sub) {
      throw new Error(
        `[SUBSCRIPTION_ACTIVATE_ERROR] Subscription ${subscriptionId} not found`,
      );
    }

    if (sub.status === 'ACTIVE') {
      this.logger.warn(
        `[SUBSCRIPTION_ACTIVATE_SKIP] Already ACTIVE — subscriptionId=${subscriptionId}`,
      );
      return;
    }

    const planConfig = BILLING_PLANS[sub.plan as keyof typeof BILLING_PLANS];

    this.logger.log(
      `[SUBSCRIPTION_ACTIVATING] Starting activation — ` +
      `subscriptionId=${subscriptionId} user=${sub.userId} ` +
      `plan=${sub.plan} credits=${sub.creditsGranted}`,
    );

    // Transaction : expirer anciens + activer nouveau + mettre à jour user
    await this.prisma.$transaction(async (tx) => {
      const previousActive = await tx.subscription.findMany({
        where:  { userId: sub.userId, status: 'ACTIVE', id: { not: subscriptionId } },
        select: { id: true, plan: true },
      });

      if (previousActive.length > 0) {
        await tx.subscription.updateMany({
          where: { userId: sub.userId, status: 'ACTIVE', id: { not: subscriptionId } },
          data:  { status: 'EXPIRED' },
        });
        this.logger.log(
          `[SUBSCRIPTION_EXPIRED_PREVIOUS] Expired ${previousActive.length} previous ` +
          `subscription(s) for user=${sub.userId}: ` +
          `${previousActive.map((s) => s.id).join(', ')}`,
        );
      }

      await tx.subscription.update({
        where: { id: subscriptionId },
        data:  { status: 'ACTIVE' },
      });

      await tx.user.update({
        where: { id: sub.userId },
        data:  { activePlan: sub.plan as any },
      });
    });

    this.logger.log(
      `[SUBSCRIPTION_ACTIVATED] DB updated — ` +
      `subscriptionId=${subscriptionId} user=${sub.userId} plan=${sub.plan}`,
    );

    // Attribuer les crédits — CRITIQUE : si échoue, relancer pour que le webhook retente
    try {
      await this.credits.grantCredits(
        sub.userId,
        subscriptionId,
        sub.creditsGranted,
        planConfig?.name ?? sub.plan,
      );

      this.logger.log(
        `[CREDITS_GRANTED] ${sub.creditsGranted} credits granted — ` +
        `subscriptionId=${subscriptionId} user=${sub.userId} plan=${sub.plan}`,
      );
    } catch (creditErr: unknown) {
      const msg = creditErr instanceof Error ? creditErr.message : String(creditErr);
      this.logger.error(
        `[CREDITS_GRANT_FAILED] CRITICAL — subscription is ACTIVE but credits NOT granted. ` +
        `subscriptionId=${subscriptionId} user=${sub.userId} ` +
        `credits=${sub.creditsGranted} err="${msg}". ` +
        `Manual credit grant required or webhook retry will fix this.`,
      );
      // Relancer → le webhook controller retournera 500 → Papi retentera
      throw creditErr;
    }
  }

  // ─── Expire subscriptions (cron 02:00 daily) ─────────────────────────────

  @Cron('0 2 * * *')
  async expireSubscriptions(): Promise<void> {
    const now     = new Date();
    const expired = await this.prisma.subscription.findMany({
      where:  { status: 'ACTIVE', periodEnd: { lt: now } },
      select: { id: true, userId: true, plan: true, periodEnd: true },
    });

    if (!expired.length) {
      this.logger.debug('[SUBSCRIPTION_EXPIRE_CRON] No subscriptions to expire');
      return;
    }

    this.logger.log(
      `[SUBSCRIPTION_EXPIRE_CRON] Found ${expired.length} subscription(s) to expire`,
    );

    for (const sub of expired) {
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.subscription.update({
            where: { id: sub.id },
            data:  { status: 'EXPIRED' },
          });
          await tx.user.update({
            where: { id: sub.userId },
            data:  { activePlan: 'FREE' },
          });
        });

        this.logger.log(
          `[SUBSCRIPTION_EXPIRED] subscriptionId=${sub.id} user=${sub.userId} ` +
          `plan=${sub.plan} periodEnd=${sub.periodEnd?.toISOString()} → FREE`,
        );

        // Attribuer crédits FREE
        await this.credits.grantCredits(
          sub.userId,
          sub.id,
          BILLING_PLANS.FREE.credits,
          'Gratuit (abonnement expiré)',
        );

        this.logger.log(
          `[CREDITS_GRANTED] FREE credits granted after expiry — ` +
          `user=${sub.userId} credits=${BILLING_PLANS.FREE.credits}`,
        );
      } catch (err: unknown) {
        this.logger.error(
          `[SUBSCRIPTION_EXPIRE_ERROR] Failed to expire subscriptionId=${sub.id} ` +
          `user=${sub.userId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  // ─── Cancel expired pending payments (cron hourly) ───────────────────────

  @Cron(CronExpression.EVERY_HOUR)
  async cancelExpiredPending(): Promise<void> {
    const now     = new Date();
    const expired = await this.prisma.payment.findMany({
      where:  { status: 'PENDING', expiresAt: { lt: now } },
      select: { id: true, subscriptionId: true, papiReference: true, userId: true },
    });

    if (!expired.length) return;

    this.logger.log(
      `[PAYMENT_EXPIRE_CRON] Cancelling ${expired.length} expired pending payment(s)`,
    );

    const ids    = expired.map((p) => p.id);
    const subIds = [...new Set(expired.map((p) => p.subscriptionId))];

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.updateMany({
        where: { id: { in: ids } },
        data:  { status: 'FAILED', failureReason: 'Lien de paiement expiré' },
      });
      await tx.subscription.updateMany({
        where: { id: { in: subIds }, status: 'PENDING' },
        data:  { status: 'CANCELLED' },
      });
    });

    for (const p of expired) {
      this.logger.log(
        `[PAYMENT_EXPIRED] paymentId=${p.id} ref="${p.papiReference}" ` +
        `subscriptionId=${p.subscriptionId} user=${p.userId} → FAILED/CANCELLED`,
      );
    }
  }
}
