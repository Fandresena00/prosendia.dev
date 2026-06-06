/**
 * @file features/billing/billing.module.ts
 *
 * CHANGES:
 *   - Added BillingAdminController
 *   - forwardRef() on UsersModule import removed (UsersModule imports BillingModule,
 *     not the reverse — no circular dep from this side)
 *   - CreditService exported for injection in UsersService
 */

import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module.js';

import { BillingAdminController } from './billing-admin.controller.js';
import { BillingWebhookController } from './billing-webhook.controller.js';
import { BillingController } from './billing.controller.js';
import { PapiClient } from './clients/papi.client.js';
import { CreditGuard } from './guards/credit.guard.js';
import { BillingCleanupService } from './services/billing-cleanup.service.js';
import { BillingService } from './services/billing.service.js';
import { CreditService } from './services/credit.service.js';
import { SubscriptionService } from './services/subscription.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [
    BillingController,
    BillingWebhookController,
    BillingAdminController,
  ],
  providers: [
    PapiClient,
    CreditService,
    SubscriptionService,
    BillingService,
    BillingCleanupService,
    CreditGuard,
  ],
  exports: [
    CreditService, // ← UsersService en a besoin pour initializeFreeUser()
    BillingService,
    CreditGuard,
  ],
})
export class BillingModule {}
