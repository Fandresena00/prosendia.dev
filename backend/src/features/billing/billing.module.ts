/**
 * @file features/billing/billing.module.ts
 *
 * CHANGE: Import AdminModule (forwardRef) pour accéder à AdminCustomPlanTemplateService
 * dans BillingController (endpoint GET /billing/custom-plans).
 *
 * Dépendances circulaires gérées :
 *   BillingModule → forwardRef(DashboardModule)  [déjà existant]
 *   BillingModule → forwardRef(AdminModule)       [NOUVEAU — AdminModule exporte AdminCustomPlanTemplateService]
 *   AdminModule   → BillingModule                 [déjà existant — CreditService]
 */

import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module.js';
import { BillingAdminController } from './billing-admin.controller.js';
import { BillingWebhookController } from './billing-webhook.controller.js';
import { BillingController } from './billing.controller.js';
import { PapiClient } from './clients/papi.client.js';
import { CreditGuard } from './guards/credit.guard.js';
import { BillingCleanupService } from './services/billing-cleanup.service.js';
import { BillingService } from './services/billing.service.js';
import { CreditService } from './services/credit.service.js';
import {
  NOTIFICATION_SERVICE_TOKEN,
  SubscriptionService,
} from './services/subscription.service.js';

import { DashboardModule } from '../dashboard/dashboard.module.js';
import { AdminModule } from '../admin/admin.module.js'; // ← NOUVEAU

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => DashboardModule),
    forwardRef(() => AdminModule), // ← pour AdminCustomPlanTemplateService
  ],
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
    CreditService,
    BillingService,
    CreditGuard,
    SubscriptionService,
  ],
})
export class BillingModule {}
