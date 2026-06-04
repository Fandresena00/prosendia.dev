/**
 * @file features/billing/services/billing.service.ts
 *
 * FIX TS2367: suppression du check redondant `=== 0`.
 * `!planConfig.priceAriary` couvre déjà null, undefined et 0.
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
  type PapiNotificationPayload,
  PapiClient,
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
    private readonly prisma: PrismaService,
    private readonly papiClient: PapiClient,
    private readonly creditService: CreditService,
    private readonly subService: SubscriptionService,
  ) {}

  // ─── Plans catalogue ──────────────────────────────────────────────────────

  getPlans(): PlanFeatureDto[] {
    return Object.values(BILLING_PLANS).map((p) => ({
      id: p.id,
      name: p.name,
      priceAriary: p.priceAriary ?? null,
      durationDays: p.durationDays,
      credits: p.credits ?? null,
      maxPages: p.maxPages ?? null,
      maxManagedPosts: p.maxManagedPosts ?? null,
      maxReferenceImages: p.maxReferenceImages ?? null,
      popular: 'popular' in p ? (p as any).popular : undefined,
      supportPriority: p.supportPriority,
      advancedStats: p.advancedStats,
      features: [...p.features],
    }));
  }

  // ─── Initiate payment ─────────────────────────────────────────────────────

  async initiatePayment(
    userId: string,
    dto: InitiatePaymentDto,
  ): Promise<InitiatePaymentResponseDto> {
    const planConfig = BILLING_PLANS[dto.plan as keyof typeof BILLING_PLANS];

    if (!planConfig) {
      throw new BadRequestException(`Plan "${dto.plan}" inconnu`);
    }

    // FIX: un seul check suffit — !priceAriary couvre null ET 0
    if (!planConfig.priceAriary) {
      throw new BadRequestException(
        `Le plan "${planConfig.name}" est gratuit, aucun paiement requis`,
      );
    }

    if (dto.plan === 'CUSTOM') {
      throw new BadRequestException(
        'Le plan Custom nécessite un contact commercial',
      );
    }

    // Réutiliser un paiement PENDING non expiré si existant
    const existing = await this.prisma.payment.findFirst({
      where: {
        userId,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
        subscription: { plan: dto.plan as any },
      },
      select: { id: true, papiPaymentLink: true, expiresAt: true },
    });

    if (existing?.papiPaymentLink) {
      return {
        paymentId: existing.id,
        paymentLink: existing.papiPaymentLink,
        amount: planConfig.priceAriary,
        expiresAt: existing.expiresAt!,
        plan: dto.plan,
        provider: dto.provider,
      };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, email: true },
    });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');

    const subscriptionId = await this.subService.createPendingSubscription(
      userId,
      dto.plan,
    );
    const reference = `${PAPI_REFERENCE_PREFIX}-${subscriptionId.slice(0, 8).toUpperCase()}`;
    const expiresAt = new Date(
      Date.now() + PAPI_LINK_VALIDITY_MINUTES * 60 * 1000,
    );

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        subscriptionId,
        amount: planConfig.priceAriary,
        currency: 'MGA',
        status: 'PENDING',
        provider: dto.provider as any,
        papiReference: reference,
        papiPayerPhone: dto.payerPhone,
        papiPayerName: dto.payerName,
        expiresAt,
      },
      select: { id: true },
    });

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
          papiPaymentLink: papiData.paymentLink,
          papiNotificationToken: papiData.notificationToken,
        },
      });

      this.logger.log(
        `Payment initiated: user=${userId} plan=${dto.plan} amount=${planConfig.priceAriary}MGA ref=${reference}`,
      );

      return {
        paymentId: payment.id,
        paymentLink: papiData.paymentLink,
        amount: planConfig.priceAriary,
        expiresAt,
        plan: dto.plan,
        provider: dto.provider,
      };
    } catch (err) {
      await this.prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: 'FAILED', failureReason: String(err) },
        });
        await tx.subscription.update({
          where: { id: subscriptionId },
          data: { status: 'CANCELLED' },
        });
      });
      throw err;
    }
  }

  // ─── Papi webhook ─────────────────────────────────────────────────────────

  async handlePapiNotification(
    payload: PapiNotificationPayload,
  ): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { papiReference: payload.paymentReference },
      select: {
        id: true,
        userId: true,
        subscriptionId: true,
        status: true,
        papiNotificationToken: true,
      },
    });

    if (!payment) {
      this.logger.warn(
        `Unknown paymentReference="${payload.paymentReference}"`,
      );
      return;
    }

    if (payment.status === 'SUCCESS') {
      this.logger.debug(`Already processed: ${payload.paymentReference}`);
      return;
    }

    const isValid = this.papiClient.verifyNotification(
      payload,
      payload.paymentReference,
      payment.papiNotificationToken ?? '',
    );

    if (!isValid) {
      this.logger.error(
        `Rejected notification: ref=${payload.paymentReference}`,
      );
      return;
    }

    if (payload.paymentStatus === 'SUCCESS') {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'SUCCESS',
          paidAt: new Date(),
          papiTransactionRef: payload.merchantPaymentReference,
        },
      });
      await this.subService.activateSubscription(payment.subscriptionId);
      this.logger.log(
        `Payment SUCCESS: ref=${payload.paymentReference} user=${payment.userId}`,
      );
    } else if (payload.paymentStatus === 'FAILED') {
      await this.prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: 'FAILED', failureReason: payload.message },
        });
        await tx.subscription.update({
          where: { id: payment.subscriptionId },
          data: { status: 'CANCELLED' },
        });
      });
      this.logger.warn(`Payment FAILED: ref=${payload.paymentReference}`);
    } else {
      this.logger.debug(`Papi PENDING for ref=${payload.paymentReference}`);
    }
  }

  // ─── Payment history ──────────────────────────────────────────────────────

  async getPaymentHistory(userId: string, page = 1, pageSize = 20) {
    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { subscription: { select: { plan: true } } },
      }),
      this.prisma.payment.count({ where: { userId } }),
    ]);

    const nameMap = Object.fromEntries(
      Object.values(BILLING_PLANS).map((p) => [p.id, p.name]),
    );

    return {
      data: payments.map(
        (p): PaymentHistoryItemDto => ({
          id: p.id,
          date: p.createdAt,
          plan: nameMap[p.subscription.plan] ?? p.subscription.plan,
          amount: p.amount,
          provider: p.provider,
          status: p.status,
          papiRef: p.papiReference,
        }),
      ),
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
