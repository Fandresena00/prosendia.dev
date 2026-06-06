/**
 * @file features/billing/billing-webhook.controller.ts
 *
 * FIX: Le controller ne doit PAS toujours retourner 200.
 *
 * Ancienne logique : catch toutes les erreurs → retourner 200 quoi qu'il arrive.
 * Problème : si activateSubscription() échoue, Papi croit que la notification
 * est traitée et ne retente pas. L'abonnement reste PENDING indéfiniment.
 *
 * Nouvelle logique :
 *   - Erreur de vérification (webhook invalide / non trouvé) → 200
 *     (pas de retry utile, Papi enverra le même payload invalide)
 *   - Erreur d'activation (DB, crédits) → 500
 *     (Papi retentera automatiquement → éventuelle récupération)
 *   - Logs détaillés dans tous les cas
 */

import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  HttpException,
  InternalServerErrorException,
} from '@nestjs/common';
import type { PapiNotificationPayload } from './clients/papi.client.js';
import { BillingService } from './services/billing.service.js';

@Controller('billing')
export class BillingWebhookController {
  private readonly logger = new Logger(BillingWebhookController.name);

  constructor(private readonly billingService: BillingService) {}

  /**
   * POST /billing/webhook/papi
   *
   * Retourne :
   *   200 { received: true }  → notification traitée ou ignorée (invalide / déjà traitée)
   *   500                     → erreur d'activation → Papi retentera
   */
  @Post('webhook/papi')
  @HttpCode(HttpStatus.OK)
  async handlePapiNotification(
    @Body() payload: PapiNotificationPayload,
  ): Promise<{ received: true }> {
    this.logger.log(
      `[WEBHOOK_RECEIVED] POST /billing/webhook/papi — ` +
      `payloadRef="${payload.paymentReference}" ` +
      `merchantRef="${payload.merchantPaymentReference}" ` +
      `status="${payload.paymentStatus}" ` +
      `amount=${payload.amount}MGA method="${payload.paymentMethod}"`,
    );

    try {
      await this.billingService.handlePapiNotification(payload);

      this.logger.log(
        `[WEBHOOK_PROCESSED] Notification handled successfully — ` +
        `payloadRef="${payload.paymentReference}" status="${payload.paymentStatus}"`,
      );

      return { received: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);

      // Erreurs métier qui méritent un retry Papi
      const isRetryableError =
        msg.includes('Database') ||
        msg.includes('Prisma') ||
        msg.includes('connect') ||
        msg.includes('timeout') ||
        msg.includes('ECONNREFUSED') ||
        // Si activateSubscription échoue
        msg.includes('Subscription') ||
        msg.includes('Credits');

      if (isRetryableError) {
        this.logger.error(
          `[WEBHOOK_ERROR_RETRYABLE] Critical failure processing notification — ` +
          `payloadRef="${payload.paymentReference}" err="${msg}". ` +
          `Returning 500 so Papi will retry.`,
        );
        // Retourner 500 → Papi retentera selon son schedule de retry
        throw new InternalServerErrorException(
          `Webhook processing failed: ${msg}`,
        );
      }

      // Erreurs non retryables (validation, référence inconnue, etc.)
      this.logger.error(
        `[WEBHOOK_ERROR_FINAL] Non-retryable error — ` +
        `payloadRef="${payload.paymentReference}" err="${msg}". ` +
        `Returning 200 to prevent infinite Papi retries.`,
      );

      // Retourner 200 pour éviter que Papi ne retente indéfiniment
      return { received: true };
    }
  }
}
