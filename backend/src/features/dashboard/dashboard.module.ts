/**
 * @file features/dashboard/dashboard.module.ts
 *
 * CHANGE: Fournit NotificationService avec le token NOTIFICATION_SERVICE_TOKEN
 * pour injection dans SubscriptionService (BillingModule).
 *
 * Le forwardRef() sur BillingModule est nécessaire car :
 *   DashboardModule → BillingModule (CreditService)
 *   BillingModule   → DashboardModule (NotificationService)
 */

import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module.js';
import { BillingModule } from '../billing/billing.module.js';
import { InboxEventsModule } from '../inbox/inbox-events.module.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardStatsService } from './services/dashboard-stats.service.js';
import { NotificationService } from './services/notification.service.js';
import { NOTIFICATION_SERVICE_TOKEN } from '../billing/services/subscription.service.js';

@Module({
  imports: [
    PrismaModule,
    InboxEventsModule,
    forwardRef(() => BillingModule), // ← CreditService
  ],
  controllers: [DashboardController],
  providers: [
    DashboardStatsService,
    NotificationService,
    // Alias pour injection dans BillingModule via token
    {
      provide:  NOTIFICATION_SERVICE_TOKEN,
      useExisting: NotificationService,
    },
  ],
  exports: [
    NotificationService,
    DashboardStatsService,
    // Exporter le token aussi
    {
      provide:  NOTIFICATION_SERVICE_TOKEN,
      useExisting: NotificationService,
    },
  ],
})
export class DashboardModule {}
