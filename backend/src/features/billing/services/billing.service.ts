/**
 * @file features/billing/services/billing.service.ts
 *
 * FIXES
 * ─────
 * 1. handlePapiNotification() — la vérification passait payload.paymentReference
 *    comme expectedReference au lieu de payment.papiReference (valeur DB).
 *    Résultat : comparaison tautologique → webhook toujours "vérifié" même si
 *    le token était null → activation silencieusement bloquée.
 *
 * 2. Logs structurés à chaque étape du flux paiement.
 *
 * 3. Récupération du papiReference depuis la DB pour la vérification
 *    (payment.papiReference, pas payload.paymentReference).
 *
 * 4. Gestion explicite du statut PENDING Papi (log, pas d'erreur silencieuse).
 *
 * 5. Retry guard : si le webhook arrive avant que le lien soit complètement
 *    sauvegardé (race condition), on attend 2s et on retente une fois.
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
        `Le plan "${planConfig.name}" est gratuit, aucun paiement requis`,
      );
    }
    if (dto.plan === 'CUSTOM') {
      throw new BadRequestException('Le plan Custom nécessite un contact commercial');
    }

    this.logger.log(
      `[PAYMENT_INITIATE] user=${userId} plan=${dto.plan} ` +
      `amount=${planConfig.priceAriary}MGA provider=${dto.provider}`,
    );

    // Réutiliser un paiement PENDING non expiré si existant
    const existing = await this.prisma.payment.findFirst({
      where: {
        userId,
        status:       'PENDING',
        expiresAt:    { gt: new Date() },
        subscription: { plan: dto.plan as any },
      },
      select: { id: true, papiPaymentLink: true, expiresAt: true },
    });

    if (existing?.papiPaymentLink) {
      this.logger.log(
        `[PAYMENT_INITIATE] Reusing existing pending payment=${existing.id} ` +
        `for user=${userId} plan=${dto.plan}`,
      );
      return {
        paymentId:   existing.id,
        paymentLink: existing.papiPaymentLink,
        amount:      planConfig.priceAriary,
        expiresAt:   existing.expiresAt!,
        plan:        dto.plan,
        provider:    dto.provider,
      };
    }

    const user = await this.prisma.user.findUnique({
      where:  { id: userId },
      select: { username: true, email: true },
    });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');

    // 1. Créer l'abonnement PENDING
    const subscriptionId = await this.subService.createPendingSubscription(
      userId,
      dto.plan,
    );
    this.logger.log(
      `[PAYMENT_INITIATE] Subscription PENDING created — ` +
      `subscriptionId=${subscriptionId} user=${userId} plan=${dto.plan}`,
    );

    // 2. Construire la référence unique
    const reference = `${PAPI_REFERENCE_PREFIX}-${subscriptionId.slice(0, 8).toUpperCase()}`;
    const expiresAt = new Date(
      Date.now() + PAPI_LINK_VALIDITY_MINUTES * 60 * 1000,
    );

    // 3. Créer le paiement PENDING en DB avant l'appel Papi
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

    // 4. Appeler Papi
    try {
      const papiData = await this.papiClient.createPaymentLink(
        reference,
        planConfig.priceAriary,
        dto.provider,
        dto.payerName,
        dto.payerPhone,
        planConfig.name,
      );

      // 5. Sauvegarder le lien ET le token de notification
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
      // Annuler proprement si Papi échoue
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
      `payloadRef="${payload.paymentReference}" ` +
      `status="${paymentStatus}" amount=${amount}MGA ` +
      `method="${payload.paymentMethod}"`,
    );

    // ── 1. Retrouver le paiement par merchantPaymentReference ─────────────
    // Papi utilise paymentReference comme sa propre référence interne.
    // Notre référence (VENDEO-XXXXXXXX) est dans merchantPaymentReference.
    // On cherche d'abord par merchantPaymentReference, puis par paymentReference
    // en fallback (certaines versions de l'API Papi inversent les deux).

    let payment = await this.prisma.payment.findFirst({
      where: {
        OR: [
          { papiReference: payload.merchantPaymentReference },
          { papiReference: payload.paymentReference },
        ],
      },
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

    if (!payment) {
      this.logger.error(
        `[WEBHOOK_ERROR] Payment not found — ` +
        `merchantRef="${payload.merchantPaymentReference}" ` +
        `payloadRef="${payload.paymentReference}" ` +
        `Tous les paiements PENDING: vérifier la table payments`,
      );
      return;
    }

    this.logger.log(
      `[WEBHOOK_RECEIVED] Payment found — ` +
      `paymentId=${payment.id} storedRef="${payment.papiReference}" ` +
      `currentStatus="${payment.status}"`,
    );

    // ── 2. Idempotence : déjà traité ──────────────────────────────────────
    if (payment.status === 'SUCCESS') {
      this.logger.log(
        `[WEBHOOK_SKIP] Already processed — paymentId=${payment.id} ` +
        `ref="${payment.papiReference}"`,
      );
      return;
    }

    // ── 3. Race condition guard : token pas encore sauvegardé ─────────────
    // Si le webhook arrive avant que createPaymentLink() ait fini de sauvegarder
    // le notificationToken, on attend 2s et on recharge.
    if (!payment.papiNotificationToken) {
      this.logger.warn(
        `[WEBHOOK_RETRY] notificationToken not yet saved for paymentId=${payment.id}. ` +
        `Waiting 2s before retry (race condition guard)…`,
      );
      await new Promise((r) => setTimeout(r, 2000));

      payment = await this.prisma.payment.findUnique({
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
      }) ?? payment;

      if (!payment.papiNotificationToken) {
        this.logger.error(
          `[WEBHOOK_ERROR] notificationToken still null after retry — ` +
          `paymentId=${payment.id}. Cannot verify webhook authenticity. ` +
          `Check that initiatePayment() saved the token correctly.`,
        );
        return;
      }
    }

    // ── 4. Vérifier l'authenticité (FIX : storedReference depuis DB) ──────
    const isValid = this.papiClient.verifyNotification(
      payload,
      payment.papiReference!,            // FIX: référence stockée en DB
      payment.papiNotificationToken,     // token stocké en DB
    );

    if (!isValid) {
      this.logger.error(
        `[WEBHOOK_REJECTED] Invalid notification — ` +
        `paymentId=${payment.id} storedRef="${payment.papiReference}" ` +
        `payloadRef="${payload.paymentReference}" ` +
        `Aborting — potential spoofed webhook`,
      );
      return;
    }

    // ── 5. Traiter selon le statut ─────────────────────────────────────────

    if (paymentStatus === 'SUCCESS') {
      await this.handlePaymentSuccess(payment, payload);
    } else if (paymentStatus === 'FAILED') {
      await this.handlePaymentFailed(payment, payload);
    } else {
      // PENDING ou autre statut intermédiaire
      this.logger.log(
        `[WEBHOOK_PENDING] Papi intermediate status="${paymentStatus}" — ` +
        `paymentId=${payment.id} ref="${payment.papiReference}". No action taken.`,
      );
    }
  }

  // ─── Private: handle SUCCESS ──────────────────────────────────────────────

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
      // 5a. Marquer le paiement comme SUCCESS
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status:             'SUCCESS',
          paidAt:             new Date(),
          papiTransactionRef: payload.merchantPaymentReference,
        },
      });

      this.logger.log(
        `[PAYMENT_SUCCESS] Payment marked SUCCESS — ` +
        `paymentId=${payment.id} transactionRef="${payload.merchantPaymentReference}"`,
      );

      // 5b. Activer l'abonnement + attribuer les crédits
      await this.subService.activateSubscription(payment.subscriptionId);

      this.logger.log(
        `[SUBSCRIPTION_ACTIVATED] Subscription active — ` +
        `subscriptionId=${payment.subscriptionId} user=${payment.userId}`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[PAYMENT_SUCCESS_ERROR] Failed to activate after payment — ` +
        `paymentId=${payment.id} subscriptionId=${payment.subscriptionId} ` +
        `err="${msg}". Manual intervention may be required.`,
      );
      throw err; // Relancer pour que le webhook controller retourne 500 (Papi retentera)
    }
  }

  // ─── Private: handle FAILED ───────────────────────────────────────────────

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
      `[PAYMENT_FAILED] Payment and subscription cancelled — ` +
      `paymentId=${payment.id} subscriptionId=${payment.subscriptionId}`,
    );
  }

  // ─── Payment history ──────────────────────────────────────────────────────

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
