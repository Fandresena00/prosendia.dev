/**
 * @file features/billing/services/billing.service.ts
 *
 * FIXES (batch courant)
 * ─────────────────────
 * 1. initiatePayment() — suppression du bloc "reuse existing PENDING payment".
 *    Ce mécanisme de réutilisation empêchait le rachat de la même offre :
 *    si un user avait initié un paiement PRO (même expiré ou annulé dans les 60min),
 *    le système réutilisait l'ancien lien au lieu d'en créer un nouveau.
 *    Désormais chaque appel crée une nouvelle subscription PENDING + un nouveau
 *    lien Papi. L'ancien paiement PENDING sera annulé par le cron horaire si
 *    non payé dans les 60 minutes.
 *
 * 2. Wording "offre" au lieu d'"abonnement" dans les logs user-facing.
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
  PAPI_LINK_VALIDITY_MINUTES,
  PAPI_REFERENCE_PREFIX,
} from '../billing.constants.js';
import {
  PapiClient,
  type PapiNotificationPayload,
} from '../clients/papi.client.js';
import type {
  CreditStatusDto,
  InitiatePaymentDto,
  InitiatePaymentResponseDto,
  PaymentHistoryItemDto,
  PlanFeatureDto,
} from '../dto/billing.dto.js';
import { CreditService } from './credit.service.js';
import { SubscriptionService } from './subscription.service.js';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma:        PrismaService,
    private readonly papiClient:    PapiClient,
    private readonly creditService: CreditService,
    private readonly subService:    SubscriptionService,
  ) {}

  // ─── Plans catalogue ──────────────────────────────────────────────────────

  getPlans(): PlanFeatureDto[] {
    return Object.values(BILLING_PLANS).map((p) => ({
      id:                 p.id,
      name:               p.name,
      priceAriary:        p.priceAriary ?? null,
      durationDays:       p.durationDays,
      credits:            p.credits ?? null,
      maxPages:           p.maxPages ?? null,
      maxManagedPosts:    p.maxManagedPosts ?? null,
      maxReferenceImages: p.maxReferenceImages ?? null,
      popular:            'popular' in p ? (p as any).popular : undefined,
      supportPriority:    p.supportPriority,
      advancedStats:      p.advancedStats,
      features:           [...p.features],
    }));
  }

  // ─── Initiate payment ─────────────────────────────────────────────────────

  /**
   * Initie un paiement Papi pour une offre donnée.
   *
   * FIX : Le mécanisme de réutilisation d'un paiement PENDING existant a été
   * supprimé. Il empêchait le rachat de la même offre (ex: PRO → PRO).
   *
   * Chaque appel crée une nouvelle subscription PENDING + un nouveau lien Papi.
   * Les anciens paiements PENDING non payés sont nettoyés par le cron horaire
   * `cancelExpiredPending()` (SubscriptionService).
   */
  async initiatePayment(
    userId: string,
    dto:    InitiatePaymentDto,
  ): Promise<InitiatePaymentResponseDto> {
    const planConfig = BILLING_PLANS[dto.plan as keyof typeof BILLING_PLANS];

    if (!planConfig) {
      throw new BadRequestException(`Plan "${dto.plan}" inconnu`);
    }
    if (!planConfig.priceAriary) {
      throw new BadRequestException(
        `L'offre "${planConfig.name}" est gratuite, aucun paiement requis`,
      );
    }
    if (dto.plan === 'CUSTOM') {
      throw new BadRequestException("L'offre Custom nécessite un contact commercial");
    }

    this.logger.log(
      `[PAYMENT_INITIATE] user=${userId} plan=${dto.plan} ` +
      `amount=${planConfig.priceAriary}MGA provider=${dto.provider}`,
    );

    const user = await this.prisma.user.findUnique({
      where:  { id: userId },
      select: { username: true, email: true },
    });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');

    const subscriptionId = await this.subService.createPendingSubscription(
      userId,
      dto.plan,
    );
    this.logger.log(
      `[PAYMENT_INITIATE] Subscription PENDING created — ` +
      `subscriptionId=${subscriptionId} user=${userId} plan=${dto.plan}`,
    );

    const reference = `${PAPI_REFERENCE_PREFIX}-${subscriptionId.slice(0, 8).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + PAPI_LINK_VALIDITY_MINUTES * 60 * 1000);

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        subscriptionId,
        amount:         planConfig.priceAriary,
        currency:       'MGA',
        status:         'PENDING',
        provider:       dto.provider as any,
        papiReference:  reference,
        papiPayerPhone: dto.payerPhone,
        papiPayerName:  dto.payerName,
        expiresAt,
      },
      select: { id: true },
    });

    this.logger.log(
      `[PAYMENT_INITIATE] Payment record created — ` +
      `paymentId=${payment.id} ref=${reference} user=${userId}`,
    );

    try {
      const papiData = await this.papiClient.createPaymentLink(
        reference,
        planConfig.priceAriary,
        dto.provider,
        dto.payerName,
        dto.payerPhone,
        planConfig.name,
      );

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          papiPaymentLink:       papiData.paymentLink,
          papiNotificationToken: papiData.notificationToken,
        },
      });

      this.logger.log(
        `[PAYMENT_CREATED] Payment ready — paymentId=${payment.id} ` +
        `ref=${reference} notificationToken saved=true`,
      );

      return {
        paymentId:   payment.id,
        paymentLink: papiData.paymentLink,
        amount:      planConfig.priceAriary,
        expiresAt,
        plan:        dto.plan,
        provider:    dto.provider,
      };
    } catch (err) {
      this.logger.error(
        `[PAYMENT_FAILED] Papi call failed — paymentId=${payment.id} ` +
        `ref=${reference} err=${String(err)}`,
      );
      await this.prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data:  { status: 'FAILED', failureReason: String(err) },
        });
        await tx.subscription.update({
          where: { id: subscriptionId },
          data:  { status: 'CANCELLED' },
        });
      });
      throw err;
    }
  }

  // ─── Handle Papi webhook notification ─────────────────────────────────────

  async handlePapiNotification(payload: PapiNotificationPayload): Promise<void> {
    const { paymentStatus, amount } = payload;

    this.logger.log(
      `[WEBHOOK_RECEIVED] Papi notification — ` +
      `paymentReference="${payload.paymentReference}" ` +
      `merchantPaymentReference="${payload.merchantPaymentReference}" ` +
      `status="${paymentStatus}" amount=${amount}MGA ` +
      `method="${payload.paymentMethod}"`,
    );

    // ── 1. Lookup par notre référence ────────────────────────────────────
    let payment = await this.prisma.payment.findFirst({
      where: { papiReference: payload.paymentReference },
      select: {
        id:                    true,
        userId:                true,
        subscriptionId:        true,
        amount:                true,
        status:                true,
        papiReference:         true,
        papiNotificationToken: true,
        papiTransactionRef:    true,
      },
    });

    // Fallback : certaines implémentations Papi peuvent inverser les champs
    if (!payment) {
      this.logger.warn(
        `[WEBHOOK_LOOKUP] paymentReference="${payload.paymentReference}" not found. ` +
        `Trying merchantPaymentReference="${payload.merchantPaymentReference}" as fallback…`,
      );
      payment = await this.prisma.payment.findFirst({
        where: { papiReference: payload.merchantPaymentReference },
        select: {
          id:                    true,
          userId:                true,
          subscriptionId:        true,
          amount:                true,
          status:                true,
          papiReference:         true,
          papiNotificationToken: true,
          papiTransactionRef:    true,
        },
      });
    }

    if (!payment) {
      const pendingPayments = await this.prisma.payment.findMany({
        where:   { status: 'PENDING' },
        select:  { id: true, papiReference: true, userId: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take:    10,
      });

      this.logger.error(
        `[WEBHOOK_ERROR] Payment not found for ` +
        `paymentReference="${payload.paymentReference}" ` +
        `merchantRef="${payload.merchantPaymentReference}". ` +
        `Last 10 PENDING payments: ${JSON.stringify(pendingPayments.map((p) => ({
          id: p.id.slice(0, 8),
          ref: p.papiReference,
          userId: p.userId.slice(0, 8),
        })))}`,
      );
      return;
    }

    this.logger.log(
      `[WEBHOOK_FOUND] Payment found — ` +
      `paymentId=${payment.id} storedRef="${payment.papiReference}" ` +
      `currentStatus="${payment.status}"`,
    );

    // ── 2. Idempotence ────────────────────────────────────────────────────
    if (payment.status === 'SUCCESS') {
      this.logger.log(
        `[WEBHOOK_SKIP] Already processed — paymentId=${payment.id}`,
      );
      return;
    }

    // ── 3. Race condition guard ───────────────────────────────────────────
    if (!payment.papiNotificationToken) {
      this.logger.warn(
        `[WEBHOOK_RETRY] notificationToken not yet saved for paymentId=${payment.id}. ` +
        `Waiting 2s (race condition guard)…`,
      );
      await new Promise((r) => setTimeout(r, 2000));

      const refreshed = await this.prisma.payment.findUnique({
        where:  { id: payment.id },
        select: {
          id:                    true,
          userId:                true,
          subscriptionId:        true,
          amount:                true,
          status:                true,
          papiReference:         true,
          papiNotificationToken: true,
          papiTransactionRef:    true,
        },
      });

      if (refreshed) payment = refreshed;

      if (!payment.papiNotificationToken) {
        this.logger.error(
          `[WEBHOOK_ERROR] notificationToken still null after retry — ` +
          `paymentId=${payment.id}. Cannot verify webhook. ` +
          `Check that initiatePayment() saved the token.`,
        );
        return;
      }
    }

    // ── 4. Vérification authenticité ─────────────────────────────────────
    const isValid = this.papiClient.verifyNotification(
      payload,
      payment.papiReference!,
      payment.papiNotificationToken,
    );

    if (!isValid) {
      this.logger.error(
        `[WEBHOOK_REJECTED] Invalid notification — ` +
        `paymentId=${payment.id} storedRef="${payment.papiReference}"`,
      );
      return;
    }

    // ── 5. Traitement ─────────────────────────────────────────────────────
    if (paymentStatus === 'SUCCESS') {
      await this.handlePaymentSuccess(payment, payload);
    } else if (paymentStatus === 'FAILED') {
      await this.handlePaymentFailed(payment, payload);
    } else {
      this.logger.log(
        `[WEBHOOK_PENDING] Intermediate status="${paymentStatus}" — ` +
        `paymentId=${payment.id}. No action taken.`,
      );
    }
  }

  // ─── Private: success ─────────────────────────────────────────────────────

  private async handlePaymentSuccess(
    payment: {
      id:             string;
      userId:         string;
      subscriptionId: string;
      amount:         number;
      papiReference:  string | null;
    },
    payload: PapiNotificationPayload,
  ): Promise<void> {
    this.logger.log(
      `[PAYMENT_SUCCESS] Processing — paymentId=${payment.id} ` +
      `ref="${payment.papiReference}" amount=${payment.amount}MGA`,
    );

    try {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status:             'SUCCESS',
          paidAt:             new Date(),
          papiTransactionRef: payload.merchantPaymentReference,
        },
      });

      this.logger.log(
        `[PAYMENT_SUCCESS] DB updated — paymentId=${payment.id} ` +
        `transactionRef="${payload.merchantPaymentReference}"`,
      );

      await this.subService.activateSubscription(payment.subscriptionId);

      this.logger.log(
        `[SUBSCRIPTION_ACTIVATED] Complete — ` +
        `subscriptionId=${payment.subscriptionId} user=${payment.userId}`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[PAYMENT_SUCCESS_ERROR] Failed to activate after payment — ` +
        `paymentId=${payment.id} subscriptionId=${payment.subscriptionId} ` +
        `err="${msg}". Webhook controller will return 500 for Papi retry.`,
      );
      throw err;
    }
  }

  // ─── Private: failed ──────────────────────────────────────────────────────

  private async handlePaymentFailed(
    payment: {
      id:             string;
      userId:         string;
      subscriptionId: string;
      papiReference:  string | null;
    },
    payload: PapiNotificationPayload,
  ): Promise<void> {
    this.logger.warn(
      `[PAYMENT_FAILED] Papi reported failure — ` +
      `paymentId=${payment.id} ref="${payment.papiReference}" ` +
      `reason="${payload.message}"`,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data:  { status: 'FAILED', failureReason: payload.message },
      });
      await tx.subscription.update({
        where: { id: payment.subscriptionId },
        data:  { status: 'CANCELLED' },
      });
    });

    this.logger.warn(
      `[PAYMENT_FAILED] Cancelled — ` +
      `paymentId=${payment.id} subscriptionId=${payment.subscriptionId}`,
    );
  }

  // ─── History ──────────────────────────────────────────────────────────────

  async getPaymentHistory(userId: string, page = 1, pageSize = 20) {
    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where:   { userId },
        orderBy: { createdAt: 'desc' },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
        include: { subscription: { select: { plan: true } } },
      }),
      this.prisma.payment.count({ where: { userId } }),
    ]);

    const nameMap = Object.fromEntries(
      Object.values(BILLING_PLANS).map((p) => [p.id, p.name]),
    );

    return {
      data: payments.map((p): PaymentHistoryItemDto => ({
        id:       p.id,
        date:     p.createdAt,
        plan:     nameMap[p.subscription.plan] ?? p.subscription.plan,
        amount:   p.amount,
        provider: p.provider,
        status:   p.status,
        papiRef:  p.papiReference,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  // ─── Credit status ────────────────────────────────────────────────────────

  getCreditStatus(userId: string): Promise<CreditStatusDto> {
    return this.creditService.getCreditStatus(userId);
  }
}
