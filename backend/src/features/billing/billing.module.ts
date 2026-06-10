/**
 * @file features/billing/billing.module.ts
 *
 * CHANGE: Import DashboardModule pour injecter NotificationService
 * dans SubscriptionService via le token NOTIFICATION_SERVICE_TOKEN.
 *
 * Le forwardRef() est nécessaire car :
 *   BillingModule  → DashboardModule → BillingModule (via CreditService)
 *
 * Architecture du token :
 *   DashboardModule fournit NotificationService avec le token
 *   NOTIFICATION_SERVICE_TOKEN pour que BillingModule puisse l'injecter
 *   sans import circulaire direct.
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

// Import conditionnel pour éviter la circularité
// DashboardModule exporte NotificationService sous le token NOTIFICATION_SERVICE_TOKEN
import { DashboardModule } from '../dashboard/dashboard.module.js';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => DashboardModule), // ← pour NotificationService
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
