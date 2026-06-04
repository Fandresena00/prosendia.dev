/**
 * @file features/billing/services/credit.service.ts
 *
 * Gestion des crédits IA.
 * 1 crédit = 100 tokens OpenRouter.
 *
 * Alertes :
 *   - < 20 % restants → log warn + flag creditAlertSent
 *   - < 100 crédits   → alerte critique
 *   - 0 crédits       → downgrade FREE automatique
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import {
  BILLING_PLANS,
  CREDIT_ALERT_THRESHOLD_PCT,
  CREDIT_CRITICAL_THRESHOLD,
  tokensToCredits,
} from '../billing.constants.js';
import type { CreditStatusDto } from '../dto/billing.dto.js';

@Injectable()
export class CreditService {
  private readonly logger = new Logger(CreditService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Check ────────────────────────────────────────────────────────────────

  async hasCredits(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where:  { id: userId },
      select: { creditBalance: true },
    });
    return (user?.creditBalance ?? 0) > 0;
  }

  // ─── Consume ──────────────────────────────────────────────────────────────

  async consumeCredits(
    userId:          string,
    tokensUsed:      number,
    type:            'AI_REPLY_CONSUME' | 'COMMENT_AI_CONSUME',
    modelId:         string,
    conversationId?: string,
    commentId?:      string,
  ): Promise<{ creditsDeducted: number; newBalance: number }> {
    const creditsToDeduct = tokensToCredits(tokensUsed);
    if (creditsToDeduct === 0) {
      return { creditsDeducted: 0, newBalance: await this.getBalance(userId) };
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where:  { id: userId },
        select: { creditBalance: true },
      });
      if (!user) throw new Error(`User ${userId} not found`);

      const actual     = Math.min(creditsToDeduct, user.creditBalance);
      const newBalance = user.creditBalance - actual;

      await tx.user.update({
        where: { id: userId },
        data:  { creditBalance: newBalance },
      });

      const activeSub = await tx.subscription.findFirst({
        where:   { userId, status: 'ACTIVE' },
        select:  { id: true },
        orderBy: { createdAt: 'desc' },
      });

      await tx.creditLedger.create({
        data: {
          userId,
          subscriptionId: activeSub?.id ?? null,
          type,
          amount:         -actual,
          tokensUsed,
          modelId,
          conversationId: conversationId ?? null,
          commentId:      commentId ?? null,
          description:    type === 'AI_REPLY_CONSUME'
            ? `Réponse IA Messenger (${tokensUsed} tokens)`
            : `Réponse IA commentaire (${tokensUsed} tokens)`,
        },
      });

      return { creditsDeducted: actual, newBalance };
    });

    await this.checkAndAlert(userId, result.newBalance);

    this.logger.debug(
      `Credits consumed: user=${userId} -${result.creditsDeducted} tokens=${tokensUsed} balance=${result.newBalance}`,
    );

    return result;
  }

  // ─── Grant ────────────────────────────────────────────────────────────────

  async grantCredits(
    userId:         string,
    subscriptionId: string,
    credits:        number,
    planName:       string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data:  { creditBalance: credits, creditAlertSent: false },
      });
      await tx.creditLedger.create({
        data: {
          userId,
          subscriptionId,
          type:        'SUBSCRIPTION_GRANT',
          amount:      credits,
          description: `Attribution abonnement ${planName} — ${credits} crédits`,
        },
      });
    });

    this.logger.log(`Credits granted: user=${userId} credits=${credits} plan=${planName}`);
  }

  // ─── Status ───────────────────────────────────────────────────────────────

  async getCreditStatus(userId: string): Promise<CreditStatusDto> {
    const user = await this.prisma.user.findUnique({
      where:  { id: userId },
      select: { creditBalance: true, activePlan: true },
    });
    if (!user) throw new Error(`User ${userId} not found`);

    const activeSub = await this.prisma.subscription.findFirst({
      where:   { userId, status: 'ACTIVE' },
      select:  { creditsGranted: true, periodEnd: true },
      orderBy: { createdAt: 'desc' },
    });

    const planConfig      = BILLING_PLANS[user.activePlan as keyof typeof BILLING_PLANS];
    const creditsGranted  = activeSub?.creditsGranted ?? planConfig?.credits ?? null;
    const creditBalance   = user.creditBalance;

    const usagePercent    = creditsGranted
      ? Math.round(((creditsGranted - creditBalance) / creditsGranted) * 100)
      : 0;
    const remainingPercent = 100 - usagePercent;

    const now            = new Date();
    const periodEnd      = activeSub?.periodEnd ?? null;
    const isExpired      = periodEnd ? periodEnd < now : false;
    const daysRemaining  = periodEnd
      ? Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / 86_400_000))
      : null;

    const isLow      = creditsGranted
      ? remainingPercent <= CREDIT_ALERT_THRESHOLD_PCT
      : false;
    const isCritical = creditBalance < CREDIT_CRITICAL_THRESHOLD && creditBalance > 0;
    const isDepleted = creditBalance <= 0;

    return {
      plan:              user.activePlan,
      planName:          planConfig?.name ?? user.activePlan,
      creditBalance,
      creditsGranted,
      usagePercent,
      remainingPercent,
      isExpired,
      isLow,
      isCritical,
      isDepleted,
      periodEnd,
      daysRemaining,
      maxPages:           planConfig?.maxPages ?? null,
      maxManagedPosts:    planConfig?.maxManagedPosts ?? null,
      maxReferenceImages: planConfig?.maxReferenceImages ?? null,
    };
  }

  async getBalance(userId: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where:  { id: userId },
      select: { creditBalance: true },
    });
    return user?.creditBalance ?? 0;
  }

  // ─── Ledger ───────────────────────────────────────────────────────────────

  async getLedgerHistory(userId: string, page = 1, pageSize = 20) {
    const [entries, total] = await Promise.all([
      this.prisma.creditLedger.findMany({
        where:   { userId },
        orderBy: { createdAt: 'desc' },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
        select: {
          id: true, type: true, amount: true,
          tokensUsed: true, modelId: true,
          description: true, createdAt: true,
        },
      }),
      this.prisma.creditLedger.count({ where: { userId } }),
    ]);
    return {
      data: entries,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  // ─── Downgrade ────────────────────────────────────────────────────────────

  async downgradeToFreeOnDepletion(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where:  { id: userId },
      select: { creditBalance: true, activePlan: true },
    });
    if (!user || user.creditBalance > 0 || user.activePlan === 'FREE') return;

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data:  { activePlan: 'FREE', creditBalance: BILLING_PLANS.FREE.credits },
      });
      await tx.subscription.updateMany({
        where: { userId, status: 'ACTIVE' },
        data:  { status: 'EXPIRED' },
      });
      await tx.creditLedger.create({
        data: {
          userId,
          type:        'SUBSCRIPTION_GRANT',
          amount:      BILLING_PLANS.FREE.credits,
          description: 'Retour automatique plan Gratuit (crédits épuisés)',
        },
      });
    });

    this.logger.warn(`User ${userId} downgraded to FREE (credits depleted)`);
  }

  // ─── Alerts ───────────────────────────────────────────────────────────────

  private async checkAndAlert(userId: string, balance: number): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where:  { id: userId },
      select: { creditAlertSent: true, activePlan: true },
    });
    if (!user) return;

    const planConfig     = BILLING_PLANS[user.activePlan as keyof typeof BILLING_PLANS];
    const creditsGranted = planConfig?.credits ?? null;

    if (
      creditsGranted &&
      !user.creditAlertSent &&
      (balance / creditsGranted) * 100 <= CREDIT_ALERT_THRESHOLD_PCT
    ) {
      await this.prisma.user.update({
        where: { id: userId },
        data:  { creditAlertSent: true },
      });
      this.logger.warn(
        `CREDIT ALERT 20%: user=${userId} balance=${balance}/${creditsGranted}`,
      );
    }

    if (balance <= 0) {
      await this.downgradeToFreeOnDepletion(userId);
    }
  }
}
