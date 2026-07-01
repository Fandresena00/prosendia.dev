/**
 * @file features/billing/services/subscription.service.ts
 *
 * FIXES (batch courant)
 * ─────────────────────
 * 1. createPendingSubscription() — suppression de la garde qui bloquait le rachat
 *    de la même offre ("plan déjà actif"). Un user doit pouvoir renouveler son
 *    offre actuelle à tout moment (ex: PRO → PRO pour repartir avec 20 000 crédits).
 *
 * 2. activateSubscription() — log et description ledger avec "offre" au lieu de
 *    "abonnement".
 *
 * 3. Tous les wording user-facing : "abonnement" → "offre".
 */

import { forwardRef, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../database/prisma.service.js';
import { BILLING_PLANS } from '../billing.constants.js';
import { resolveCustomBillingPlan, type PlanId } from '../billing.constants.js';
import type { SubscriptionStatusDto } from '../dto/billing.dto.js';
import { CreditService } from './credit.service.js';

type NotificationServiceLike = {
  notifySubscriptionActivated(
    userId: string, planName: string, credits: number,
    amount: number, periodEnd: Date,
  ): Promise<void>;
  notifyCreditsLow(userId: string, balance: number, total: number): Promise<void>;
  notifyCredentialsDepleted(userId: string): Promise<void>;
  notifySubscriptionExpiring(userId: string, daysLeft: number, planName: string): Promise<void>;
};

export const NOTIFICATION_SERVICE_TOKEN = 'NOTIFICATION_SERVICE';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private readonly prisma:  PrismaService,
    private readonly credits: CreditService,
    @Optional()
    @Inject(NOTIFICATION_SERVICE_TOKEN)
    private readonly notifService?: NotificationServiceLike,
  ) {}

  // ─── Notify helper ────────────────────────────────────────────────────────

  private async notifySilent(fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (err: unknown) {
      this.logger.warn(
        `[NOTIFICATION_FAILED] ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

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

    const user = await this.prisma.user.findUnique({
      where:  { id: userId },
      select: { creditBalance: true, customPlanConfig: true },
    });
    const planConfig =
      sub.plan === 'CUSTOM' && user?.customPlanConfig
        ? resolveCustomBillingPlan(user.customPlanConfig)
        : BILLING_PLANS[sub.plan as keyof typeof BILLING_PLANS];

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

  /**
   * Crée une subscription PENDING pour le plan demandé.
   *
   * FIX : Suppression de la garde "plan déjà actif".
   * Un user peut racheter la même offre à tout moment :
   *   - Renouvellement anticipé (ex: PRO → PRO pour repartir avec 20 000 crédits)
   *   - Rachat après avoir consommé tous ses crédits
   *   - Changement d'offre (FREE → PRO, PRO → STARTER, etc.)
   *
   * La subscription existante active sera expirée dans activateSubscription()
   * au moment où le paiement est confirmé par Papi.
   */
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

  async createManualSubscription(
    userId: string,
    planId: PlanId,
    options?: {
      credits?: number;
      durationDays?: number;
      planName?: string;
    },
  ): Promise<string> {
    const planConfig = BILLING_PLANS[planId];
    if (!planConfig) {
      throw new Error(`Plan ${planId} inconnu`);
    }

    const credits = options?.credits ?? planConfig.credits;
    if (!credits || credits <= 0) {
      throw new Error(`Plan ${planId} sans quota de crédits attribuable`);
    }

    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + (options?.durationDays ?? planConfig.durationDays));

    const sub = await this.prisma.subscription.create({
      data: {
        userId,
        plan: planId as any,
        status: 'PENDING',
        creditsGranted: credits,
        periodStart: now,
        periodEnd: end,
      },
      select: { id: true },
    });

    this.logger.log(
      `[SUBSCRIPTION_CREATED] MANUAL PENDING — ` +
      `subscriptionId=${sub.id} user=${userId} plan=${planId} ` +
      `credits=${credits} periodEnd=${end.toISOString()}`,
    );

    await this.activateSubscription(sub.id, options?.planName);
    return sub.id;
  }

  // ─── Activate ─────────────────────────────────────────────────────────────

  /**
   * Active une subscription après confirmation du paiement Papi.
   *
   * Séquence :
   *   1. Expire toutes les subscriptions ACTIVE précédentes de l'user
   *   2. Passe la subscription cible en ACTIVE
   *   3. Met à jour user.activePlan
   *   4. grantCredits() → SET du solde au quota complet de la nouvelle offre
   *   5. Notifie l'user (fire-and-forget)
   */
  async activateSubscription(
    subscriptionId: string,
    planNameOverride?: string,
  ): Promise<void> {
    const sub = await this.prisma.subscription.findUnique({
      where:  { id: subscriptionId },
      select: {
        userId:         true,
        plan:           true,
        creditsGranted: true,
        status:         true,
        periodEnd:      true,
      },
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
    const planName = planNameOverride ?? planConfig?.name ?? sub.plan;

    this.logger.log(
      `[SUBSCRIPTION_ACTIVATING] Starting — ` +
      `subscriptionId=${subscriptionId} user=${sub.userId} ` +
      `plan=${sub.plan} credits=${sub.creditsGranted}`,
    );

    // Transaction : expirer toutes les subs actives + activer + mettre à jour user
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
          `subscription(s) — ${previousActive.map((s) => s.id).join(', ')}`,
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

    // Attribuer les crédits — CRITIQUE
    // grantCredits() SET le solde au quota complet : comportement voulu pour
    // tout changement ou renouvellement d'offre.
    try {
      await this.credits.grantCredits(
        sub.userId,
        subscriptionId,
        sub.creditsGranted,
        planName,
      );

      this.logger.log(
        `[CREDITS_GRANTED] ${sub.creditsGranted} credits — ` +
        `subscriptionId=${subscriptionId} user=${sub.userId} plan=${sub.plan}`,
      );
    } catch (creditErr: unknown) {
      const msg = creditErr instanceof Error ? creditErr.message : String(creditErr);
      this.logger.error(
        `[CREDITS_GRANT_FAILED] CRITICAL — subscription ACTIVE but NO credits. ` +
        `subscriptionId=${subscriptionId} user=${sub.userId} ` +
        `credits=${sub.creditsGranted} err="${msg}"`,
      );
      throw creditErr;
    }

    // Notification in-app — fire-and-forget
    if (this.notifService) {
      const payment = await this.prisma.payment.findFirst({
        where:   { subscriptionId, status: 'SUCCESS' },
        select:  { amount: true },
        orderBy: { paidAt: 'desc' },
      });

      await this.notifySilent(() =>
        this.notifService!.notifySubscriptionActivated(
          sub.userId,
          planName,
          sub.creditsGranted,
          payment?.amount ?? 0,
          sub.periodEnd,
        ),
      );

      this.logger.log(
        `[NOTIFICATION_SENT] PAYMENT_CONFIRMED — user=${sub.userId}`,
      );
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
      this.logger.debug('[SUBSCRIPTION_EXPIRE_CRON] Nothing to expire');
      return;
    }

    this.logger.log(
      `[SUBSCRIPTION_EXPIRE_CRON] Expiring ${expired.length} subscription(s)`,
    );

    for (const sub of expired) {
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.subscription.update({ where: { id: sub.id }, data: { status: 'EXPIRED' } });
          await tx.user.update({ where: { id: sub.userId }, data: { activePlan: 'FREE' } });
        });

        this.logger.log(
          `[SUBSCRIPTION_EXPIRED] id=${sub.id} user=${sub.userId} ` +
          `plan=${sub.plan} → FREE`,
        );

        await this.credits.grantCredits(
          sub.userId, sub.id, BILLING_PLANS.FREE.credits, 'Gratuit (offre expirée)',
        );

        this.logger.log(
          `[CREDITS_GRANTED] FREE after expiry — user=${sub.userId}`,
        );
      } catch (err: unknown) {
        this.logger.error(
          `[SUBSCRIPTION_EXPIRE_ERROR] id=${sub.id}: ` +
          `${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  // ─── Expiry warnings (cron 09:00 daily) ──────────────────────────────────

  @Cron('0 9 * * *')
  async checkExpiringSubscriptions(): Promise<void> {
    if (!this.notifService) return;

    const now              = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 86_400_000);

    const expiringSubs = await this.prisma.subscription.findMany({
      where: { status: 'ACTIVE', periodEnd: { gt: now, lt: sevenDaysFromNow } },
      include: { user: { select: { id: true, activePlan: true } } },
    });

    for (const sub of expiringSubs) {
      const daysLeft = Math.ceil((sub.periodEnd.getTime() - now.getTime()) / 86_400_000);
      if (![7, 3, 1].includes(daysLeft)) continue;

      const planConfig = BILLING_PLANS[sub.plan as keyof typeof BILLING_PLANS];
      await this.notifySilent(() =>
        this.notifService!.notifySubscriptionExpiring(
          sub.user.id,
          daysLeft,
          planConfig?.name ?? sub.plan,
        ),
      );

      this.logger.log(
        `[NOTIFICATION_SENT] SUBSCRIPTION_EXPIRING — user=${sub.user.id} daysLeft=${daysLeft}`,
      );
    }
  }

  // ─── Cancel expired pending (cron hourly) ────────────────────────────────

  @Cron(CronExpression.EVERY_HOUR)
  async cancelExpiredPending(): Promise<void> {
    const now     = new Date();
    const expired = await this.prisma.payment.findMany({
      where:  { status: 'PENDING', expiresAt: { lt: now } },
      select: { id: true, subscriptionId: true, papiReference: true, userId: true },
    });

    if (!expired.length) return;

    this.logger.log(
      `[PAYMENT_EXPIRE_CRON] Cancelling ${expired.length} expired pending`,
    );

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

    for (const p of expired) {
      this.logger.log(
        `[PAYMENT_EXPIRED] id=${p.id} ref="${p.papiReference}" → FAILED/CANCELLED`,
      );
    }
  }
}
