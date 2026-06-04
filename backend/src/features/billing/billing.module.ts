/**
 * @file features/billing/billing.module.ts
 *
 * Exporte CreditService et CreditGuard pour AiModule et FacebookPostsModule.
 */

import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module.js';
import { BillingWebhookController } from './billing-webhook.controller.js';
import { BillingController } from './billing.controller.js';
import { PapiClient } from './clients/papi.client.js';
import { CreditGuard } from './guards/credit.guard.js';
import { BillingCleanupService } from './services/billing-cleanup.service.js';
import { BillingService } from './services/billing.service.js';
import { CreditService } from './services/credit.service.js';
import { SubscriptionService } from './services/subscription.service.js';

@Module({
  imports:     [PrismaModule],
  controllers: [BillingController, BillingWebhookController],
  providers: [
    PapiClient,
    CreditService,
    SubscriptionService,
    BillingService,
    BillingCleanupService,
    CreditGuard,
  ],
  exports: [CreditService, BillingService, CreditGuard],
})
export class BillingModule {}
