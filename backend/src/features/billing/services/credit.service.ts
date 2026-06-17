/**
 * @file features/billing/services/credit.service.ts
 *
 * FIXES + AMÉLIORATIONS
 * ─────────────────────
 * 1. Source unique de vérité : user.creditBalance est LA source.
 *    Le CreditLedger est un registre d'audit, pas le calcul principal.
 *    Toute modification du solde passe par cette classe.
 *
 * 2. grantCredits() — log structuré [CREDITS_GRANTED] à chaque attribution.
 *
 * 3. consumeCredits() — log [CREDITS_CONSUMED] + [CREDITS_INSUFFICIENT] si 0.
 *
 * 4. initializeFreeUser() — méthode publique appelée lors de la création d'un
 *    utilisateur pour garantir 500 crédits FREE dès l'inscription.
 *    BUG FIX : l'ancienne version ne créait pas de subscription ni de ledger
 *    pour les users FREE → creditBalance restait à 0.
 *
 * 5. repairBalance() — méthode admin qui recalcule le solde depuis le ledger
 *    et corrige les incohérences.
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

  // ─── Initialize FREE user (appelé à l'inscription) ────────────────────────

  /**
   * Initialise les crédits d'un nouvel utilisateur FREE.
   *
   * BUG FIX : Sans cet appel lors de la création du compte, user.creditBalance
   * reste à 0 (valeur par défaut Prisma) et l'IA est bloquée dès le départ.
   *
   * À appeler dans UsersService.createUser() ou AuthService.register().
   *
   * Ce que fait cette méthode :
   *   1. Vérifie que le solde est bien à 0 (idempotent)
   *   2. Crée un abonnement FREE ACTIVE avec période de 30 jours
   *   3. Attribue 500 crédits via grantCredits()
   *   4. Log [CREDITS_INITIALIZED]
   */
  async initializeFreeUser(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where:  { id: userId },
      select: { creditBalance: true, activePlan: true },
    });

    if (!user) {
      this.logger.error(
        `[CREDITS_INIT_ERROR] User ${userId} not found during initialization`,
      );
      return;
    }

    // Idempotent : ne pas re-initialiser si déjà fait
    if (user.creditBalance > 0) {
      this.logger.debug(
        `[CREDITS_INIT_SKIP] User ${userId} already has ${user.creditBalance} credits`,
      );
      return;
    }

    this.logger.log(
      `[CREDITS_INITIALIZING] New user ${userId} — plan=FREE ` +
      `credits=${BILLING_PLANS.FREE.credits}`,
    );

    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + BILLING_PLANS.FREE.durationDays);

    // Créer l'abonnement FREE ACTIVE
    const sub = await this.prisma.subscription.create({
      data: {
        userId,
        plan:           'FREE',
        status:         'ACTIVE',
        creditsGranted: BILLING_PLANS.FREE.credits,
        periodStart:    now,
        periodEnd:      end,
      },
      select: { id: true },
    });

    this.logger.log(
      `[SUBSCRIPTION_CREATED] FREE ACTIVE — ` +
      `subscriptionId=${sub.id} user=${userId} ` +
      `periodEnd=${end.toISOString()}`,
    );

    // Attribuer les crédits
    await this.grantCredits(
      userId,
      sub.id,
      BILLING_PLANS.FREE.credits,
      'Gratuit (inscription)',
    );

    this.logger.log(
      `[CREDITS_INITIALIZED] user=${userId} credits=${BILLING_PLANS.FREE.credits} ` +
      `subscriptionId=${sub.id}`,
    );
  }

  // ─── Check credits ─────────────────────────────────────────────────────────

  async hasCredits(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where:  { id: userId },
      select: { creditBalance: true },
    });
    const has = (user?.creditBalance ?? 0) > 0;

    if (!has) {
      this.logger.warn(
        `[CREDITS_INSUFFICIENT] user=${userId} balance=0 — AI calls blocked`,
      );
    }

    return has;
  }

  // ─── Consume credits ───────────────────────────────────────────────────────

  async consumeCredits(
    userId:          string,
    tokensUsed:      number,
    type:            'AI_REPLY_CONSUME' | 'COMMENT_AI_CONSUME' | 'AI_SUGGESTION_CONSUME',
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
            : type === 'COMMENT_AI_CONSUME'
              ? `Réponse IA commentaire (${tokensUsed} tokens)`
              : `Suggestion IA configuration (${tokensUsed} tokens)`,
        },
      });

      return { creditsDeducted: actual, newBalance };
    });

    this.logger.debug(
      `[CREDITS_CONSUMED] user=${userId} -${result.creditsDeducted} credits ` +
      `tokens=${tokensUsed} model=${modelId} balance=${result.newBalance}`,
    );

    await this.checkAndAlert(userId, result.newBalance);

    return result;
  }

  // ─── Grant credits ─────────────────────────────────────────────────────────

  async grantCredits(
    userId:         string,
    subscriptionId: string,
    credits:        number,
    planName:       string,
  ): Promise<void> {
    if (credits <= 0) {
      this.logger.warn(
        `[CREDITS_GRANT_SKIP] Attempted to grant ${credits} credits to user=${userId}. Skipped.`,
      );
      return;
    }

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

    this.logger.log(
      `[CREDITS_GRANTED] user=${userId} credits=${credits} ` +
      `plan="${planName}" subscriptionId=${subscriptionId}`,
    );
  }

  // ─── Admin: repair balance ─────────────────────────────────────────────────

  /**
   * Recalcule le solde depuis le ledger et corrige user.creditBalance.
   * Utile pour détecter et réparer les incohérences.
   * À appeler manuellement ou depuis un endpoint admin.
   */
  async repairBalance(userId: string): Promise<{ before: number; after: number; ledgerSum: number }> {
    const user = await this.prisma.user.findUnique({
      where:  { id: userId },
      select: { creditBalance: true },
    });
    if (!user) throw new Error(`User ${userId} not found`);

    const ledgerEntries = await this.prisma.creditLedger.findMany({
      where:  { userId },
      select: { amount: true },
    });

    const ledgerSum = ledgerEntries.reduce((sum, e) => sum + e.amount, 0);
    const before    = user.creditBalance;

    if (ledgerSum !== before) {
      this.logger.warn(
        `[CREDITS_REPAIR] Inconsistency detected for user=${userId} — ` +
        `user.creditBalance=${before} ledgerSum=${ledgerSum}. Repairing…`,
      );

      await this.prisma.user.update({
        where: { id: userId },
        data:  { creditBalance: Math.max(0, ledgerSum) },
      });

      this.logger.log(
        `[CREDITS_REPAIRED] user=${userId} balance: ${before} → ${Math.max(0, ledgerSum)}`,
      );
    } else {
      this.logger.debug(
        `[CREDITS_OK] user=${userId} balance=${before} consistent with ledger`,
      );
    }

    return { before, after: Math.max(0, ledgerSum), ledgerSum };
  }

  // ─── Status ────────────────────────────────────────────────────────────────

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
    const remainingPercent = Math.max(0, 100 - usagePercent);

    const now           = new Date();
    const periodEnd     = activeSub?.periodEnd ?? null;
    const isExpired     = periodEnd ? periodEnd < now : false;
    const daysRemaining = periodEnd
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

  async downgradeToFreeOnDepletion(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where:  { id: userId },
      select: { creditBalance: true, activePlan: true },
    });
    if (!user || user.creditBalance > 0 || user.activePlan === 'FREE') return;

    this.logger.warn(
      `[CREDITS_DEPLETED] user=${userId} balance=0 plan=${user.activePlan} → downgrade FREE`,
    );

    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + BILLING_PLANS.FREE.durationDays);

    const freeSub = await this.prisma.subscription.create({
      data: {
        userId,
        plan:           'FREE',
        status:         'ACTIVE',
        creditsGranted: BILLING_PLANS.FREE.credits,
        periodStart:    now,
        periodEnd:      end,
      },
      select: { id: true },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data:  { activePlan: 'FREE' },
      });
      await tx.subscription.updateMany({
        where: { userId, status: 'ACTIVE', id: { not: freeSub.id } },
        data:  { status: 'EXPIRED' },
      });
    });

    await this.grantCredits(
      userId,
      freeSub.id,
      BILLING_PLANS.FREE.credits,
      'Gratuit (crédits épuisés)',
    );

    this.logger.warn(
      `[SUBSCRIPTION_RENEWED_FREE] user=${userId} downgraded to FREE ` +
      `credits=${BILLING_PLANS.FREE.credits}`,
    );
  }

  // ─── Private: alerts ───────────────────────────────────────────────────────

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
        `[CREDITS_ALERT_20PCT] user=${userId} balance=${balance}/${creditsGranted} ` +
        `(${Math.round((balance / creditsGranted) * 100)}%)`,
      );
    }

    if (balance < CREDIT_CRITICAL_THRESHOLD && balance > 0) {
      this.logger.warn(
        `[CREDITS_ALERT_CRITICAL] user=${userId} balance=${balance} < ${CREDIT_CRITICAL_THRESHOLD}`,
      );
    }

    if (balance <= 0) {
      await this.downgradeToFreeOnDepletion(userId);
    }
  }
}
