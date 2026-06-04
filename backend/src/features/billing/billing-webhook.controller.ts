/**
 * @file features/billing/billing-webhook.controller.ts
 *
 * Endpoint de notification Papi — sans JwtAuthGuard.
 * Authenticité vérifiée par paymentReference + notificationToken.
 * Toujours retourner HTTP 200 même en cas d'erreur (évite les retries Papi).
 */

import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common';
import type { PapiNotificationPayload } from './clients/papi.client.js';
import { BillingService } from './services/billing.service.js';

@Controller('billing')
export class BillingWebhookController {
  private readonly logger = new Logger(BillingWebhookController.name);

  constructor(private readonly billingService: BillingService) {}

  @Post('webhook/papi')
  @HttpCode(HttpStatus.OK)
  async handlePapiNotification(
    @Body() payload: PapiNotificationPayload,
  ): Promise<{ received: true }> {
    this.logger.debug(
      `Papi webhook: ref=${payload.paymentReference} status=${payload.paymentStatus}`,
    );
    try {
      await this.billingService.handlePapiNotification(payload);
    } catch (err: unknown) {
      this.logger.error(
        `Webhook processing error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    return { received: true };
  }
}
