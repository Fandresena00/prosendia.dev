/**
 * @file features/billing/services/credit.service.ts
 *
 * FIXES (batch courant)
 * ─────────────────────
 * 1. grantCredits() — SET intentionnel du solde (reset complet à l'activation
 *    d'une nouvelle offre). C'est le comportement correct : quand l'user souscrit
 *    à une offre, il repart avec son quota complet, qu'il lui reste des crédits
 *    ou non. Le ledger enregistre le montant réel accordé.
 *
 * 2. initializeFreeUser() — La garde idempotente `creditBalance > 0` bloquait
 *    le rachat de la même offre (FREE → FREE) ou tout achat après avoir épuisé
 *    ses crédits. Supprimée : la méthode vérifie désormais l'existence d'une
 *    subscription FREE ACTIVE récente plutôt que le solde.
 *
 * 3. Tous les wording "abonnement" → "offre" dans les descriptions ledger
 *    et les logs user-facing.
 *
 * 4. downgradeToFreeOnDepletion() — n'appelle plus initializeFreeUser() mais
 *    grantCredits() directement pour éviter la garde idempotente.
 */
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import {
  BILLING_PLANS,
  CREDIT_ALERT_THRESHOLD_PCT,
  CREDIT_CRITICAL_THRESHOLD,
  resolveCustomBillingPlan,
  tokensToCredits,
} from '../billing.constants.js';
import type { CreditStatusDto } from '../dto/billing.dto.js';

@Injectable()
export class CreditService {
  private readonly logger = new Logger(CreditService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Admin: ajustement manuel du solde ─────────────────────────────────────

  /**
   * Ajuste manuellement le solde d'un utilisateur (action admin).
   * INCRÉMENTE/DÉCRÉMENTE le solde existant — différent de grantCredits() qui SET.
   *
   * @param amount  Positif = créditer, négatif = débiter.
   *                Le solde ne descend jamais sous 0.
   */
  async adminAdjustCredits(
    userId: string,
    amount: number,
    reason: string,
  ): Promise<{ previousBalance: number; newBalance: number; applied: number }> {
    if (amount === 0) {
      throw new BadRequestException('Le montant ajusté ne peut pas être 0.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { creditBalance: true },
      });
      if (!user) throw new NotFoundException(`User ${userId} not found`);

      const previousBalance = user.creditBalance;
      const newBalance = Math.max(0, previousBalance + amount);
      const applied = newBalance - previousBalance;

      await tx.user.update({
        where: { id: userId },
        data: { creditBalance: newBalance },
      });

      const activeSub = await tx.subscription.findFirst({
        where: { userId, status: 'ACTIVE' },
        select: { id: true },
        orderBy: { createdAt: 'desc' },
      });
      await tx.creditLedger.create({
        data: {
          userId,
          subscriptionId: activeSub?.id ?? null,
          type: 'ADMIN_ADJUST',
          amount: applied,
          description: `[Admin] ${reason}`,
        },
      });

      return { previousBalance, newBalance, applied };
    });

    this.logger.log(
      `[CREDITS_ADMIN_ADJUSTED] user=${userId} amount=${amount} applied=${result.applied} ` +
        `${result.previousBalance} → ${result.newBalance} — reason="${reason}"`,
    );

    await this.checkAndAlert(userId, result.newBalance);

    return result;
  }

  // ─── Initialize FREE user (appelé à l'inscription) ────────────────────────

  /**
   * Initialise les crédits d'un nouvel utilisateur FREE.
   *
   * FIX : L'ancienne garde `creditBalance > 0` bloquait le rachat de la même
   * offre FREE ou tout re-achat après épuisement des crédits. On vérifie
   * maintenant l'existence d'une subscription FREE ACTIVE créée dans les
   * dernières 60 secondes (bootstrap de compte) pour rester idempotent
   * uniquement au démarrage, pas sur les re-souscriptions.
   *
   * Cette méthode est réservée à l'inscription initiale.
   * Pour les re-souscriptions FREE, passer par SubscriptionService.
   */
  async initializeFreeUser(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        creditBalance: true,
        activePlan: true,
        customPlanConfig: true,
      },
    });

    if (!user) {
      this.logger.error(
        `[CREDITS_INIT_ERROR] User ${userId} not found during initialization`,
      );
      return;
    }

    // Idempotent uniquement au bootstrap : vérifier si une sub FREE vient d'être créée
    // (dans les 60 dernières secondes) pour éviter la double-initialisation à l'inscription
    const recentFreeSub = await this.prisma.subscription.findFirst({
      where: {
        userId,
        plan: 'FREE',
        status: 'ACTIVE',
        createdAt: { gte: new Date(Date.now() - 60_000) },
      },
      select: { id: true },
    });

    if (recentFreeSub) {
      this.logger.debug(
        `[CREDITS_INIT_SKIP] User ${userId} free subscription just created (id=${recentFreeSub.id}), skipping`,
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

    const sub = await this.prisma.subscription.create({
      data: {
        userId,
        plan: 'FREE',
        status: 'ACTIVE',
        creditsGranted: BILLING_PLANS.FREE.credits,
        periodStart: now,
        periodEnd: end,
      },
      select: { id: true },
    });

    this.logger.log(
      `[SUBSCRIPTION_CREATED] FREE ACTIVE — ` +
        `subscriptionId=${sub.id} user=${userId} ` +
        `periodEnd=${end.toISOString()}`,
    );

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
      where: { id: userId },
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
    userId: string,
    tokensUsed: number,
    type: 'AI_REPLY_CONSUME' | 'COMMENT_AI_CONSUME' | 'AI_SUGGESTION_CONSUME',
    modelId: string,
    conversationId?: string,
    commentId?: string,
  ): Promise<{ creditsDeducted: number; newBalance: number }> {
    const creditsToDeduct = tokensToCredits(tokensUsed);

    if (creditsToDeduct === 0) {
      return { creditsDeducted: 0, newBalance: await this.getBalance(userId) };
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { creditBalance: true },
      });
      if (!user) throw new Error(`User ${userId} not found`);

      const actual = Math.min(creditsToDeduct, user.creditBalance);
      const newBalance = user.creditBalance - actual;

      await tx.user.update({
        where: { id: userId },
        data: { creditBalance: newBalance },
      });

      const activeSub = await tx.subscription.findFirst({
        where: { userId, status: 'ACTIVE' },
        select: { id: true },
        orderBy: { createdAt: 'desc' },
      });

      await tx.creditLedger.create({
        data: {
          userId,
          subscriptionId: activeSub?.id ?? null,
          type,
          amount: -actual,
          tokensUsed,
          modelId,
          conversationId: conversationId ?? null,
          commentId: commentId ?? null,
          description:
            type === 'AI_REPLY_CONSUME'
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

  /**
   * Attribue les crédits d'une offre à un utilisateur.
   *
   * COMPORTEMENT : SET intentionnel du solde (reset complet).
   * Quand un user active une nouvelle offre, son quota repart de zéro,
   * indépendamment du solde restant. Le ledger enregistre le montant accordé
   * (positif) pour l'audit — pas le delta.
   *
   * Ce comportement est voulu pour :
   *   - Changement d'offre (FREE → PRO, PRO → STARTER, etc.)
   *   - Renouvellement de la même offre
   *   - Attribution après expiration
   *
   * Le creditAlertSent est remis à false pour permettre les nouvelles alertes.
   */
  async grantCredits(
    userId: string,
    subscriptionId: string,
    credits: number,
    planName: string,
  ): Promise<void> {
    if (credits <= 0) {
      this.logger.warn(
        `[CREDITS_GRANT_SKIP] Attempted to grant ${credits} credits to user=${userId}. Skipped.`,
      );
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      // SET intentionnel : reset complet du quota à l'activation d'une offre
      await tx.user.update({
        where: { id: userId },
        data: { creditBalance: credits, creditAlertSent: false },
      });
      await tx.creditLedger.create({
        data: {
          userId,
          subscriptionId,
          type: 'SUBSCRIPTION_GRANT',
          amount: credits,
          description: `Attribution offre ${planName} — ${credits} crédits`,
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
   */
  async repairBalance(
    userId: string,
  ): Promise<{ before: number; after: number; ledgerSum: number }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { creditBalance: true },
    });
    if (!user) throw new Error(`User ${userId} not found`);

    const ledgerEntries = await this.prisma.creditLedger.findMany({
      where: { userId },
      select: { amount: true },
    });

    const ledgerSum = ledgerEntries.reduce((sum, e) => sum + e.amount, 0);
    const before = user.creditBalance;

    if (ledgerSum !== before) {
      this.logger.warn(
        `[CREDITS_REPAIR] Inconsistency detected for user=${userId} — ` +
          `user.creditBalance=${before} ledgerSum=${ledgerSum}. Repairing…`,
      );

      await this.prisma.user.update({
        where: { id: userId },
        data: { creditBalance: Math.max(0, ledgerSum) },
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
      where: { id: userId },
      select: {
        creditBalance: true,
        activePlan: true,
        customPlanConfig: true,
      },
    });
    if (!user) throw new Error(`User ${userId} not found`);

    const activeSub = await this.prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE' },
      select: { creditsGranted: true, periodEnd: true },
      orderBy: { createdAt: 'desc' },
    });

    const planConfig =
      user.activePlan === 'CUSTOM' && user.customPlanConfig
        ? resolveCustomBillingPlan(user.customPlanConfig)
        : BILLING_PLANS[user.activePlan as keyof typeof BILLING_PLANS];
    const creditsGranted =
      activeSub?.creditsGranted ?? planConfig?.credits ?? null;
    const creditBalance = user.creditBalance;

    const usagePercent = creditsGranted
      ? Math.round(((creditsGranted - creditBalance) / creditsGranted) * 100)
      : 0;
    const remainingPercent = Math.max(0, 100 - usagePercent);

    const now = new Date();
    const periodEnd = activeSub?.periodEnd ?? null;
    const isExpired = periodEnd ? periodEnd < now : false;
    const daysRemaining = periodEnd
      ? Math.max(
          0,
          Math.ceil((periodEnd.getTime() - now.getTime()) / 86_400_000),
        )
      : null;

    const isLow = creditsGranted
      ? remainingPercent <= CREDIT_ALERT_THRESHOLD_PCT
      : false;
    const isCritical =
      creditBalance < CREDIT_CRITICAL_THRESHOLD && creditBalance > 0;
    const isDepleted = creditBalance <= 0;

    return {
      plan: user.activePlan,
      planName: planConfig?.name ?? user.activePlan,
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
      maxPages: planConfig?.maxPages ?? null,
      maxManagedPosts: planConfig?.maxManagedPosts ?? null,
      maxReferenceImages: planConfig?.maxReferenceImages ?? null,
    };
  }

  async getBalance(userId: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { creditBalance: true },
    });
    return user?.creditBalance ?? 0;
  }

  async getLedgerHistory(userId: string, page = 1, pageSize = 20) {
    const [entries, total] = await Promise.all([
      this.prisma.creditLedger.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          type: true,
          amount: true,
          tokensUsed: true,
          modelId: true,
          description: true,
          createdAt: true,
        },
      }),
      this.prisma.creditLedger.count({ where: { userId } }),
    ]);
    return {
      data: entries,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async downgradeToFreeOnDepletion(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { creditBalance: true, activePlan: true },
    });
    if (!user || user.creditBalance > 0 || user.activePlan === 'FREE') return;

    this.logger.warn(
      `[CREDITS_DEPLETED] user=${userId} balance=0 plan=${user.activePlan} → downgrade FREE`,
    );

    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + BILLING_PLANS.FREE.durationDays);

    // Transaction : expirer les subs actives + créer FREE + mettre à jour activePlan
    const freeSub = await this.prisma.$transaction(async (tx) => {
      await tx.subscription.updateMany({
        where: { userId, status: 'ACTIVE' },
        data: { status: 'EXPIRED' },
      });
      await tx.user.update({
        where: { id: userId },
        data: { activePlan: 'FREE' },
      });
      return tx.subscription.create({
        data: {
          userId,
          plan: 'FREE',
          status: 'ACTIVE',
          creditsGranted: BILLING_PLANS.FREE.credits,
          periodStart: now,
          periodEnd: end,
        },
        select: { id: true },
      });
    });

    // grantCredits() directement — pas initializeFreeUser() pour éviter la garde idempotente
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
      where: { id: userId },
      select: {
        creditAlertSent: true,
        activePlan: true,
        customPlanConfig: true,
      },
    });
    if (!user) return;

    const planConfig =
      user.activePlan === 'CUSTOM' && user.customPlanConfig
        ? resolveCustomBillingPlan(user.customPlanConfig)
        : BILLING_PLANS[user.activePlan as keyof typeof BILLING_PLANS];
    const creditsGranted = planConfig?.credits ?? null;

    if (
      creditsGranted &&
      !user.creditAlertSent &&
      (balance / creditsGranted) * 100 <= CREDIT_ALERT_THRESHOLD_PCT
    ) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { creditAlertSent: true },
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
