/**
 * @file features/dashboard/dashboard.module.ts
 *
 * Exporte NotificationService pour usage dans :
 *   - BillingModule   → notifyPaymentConfirmed, notifyCreditsLow…
 *   - FacebookModule  → notifyFacebookTokenExpired, notifySyncFailed
 *   - AiModule / WebhookService → analyzeInboundMessage
 */

import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module.js';
import { BillingModule } from '../billing/billing.module.js';
import { InboxEventsModule } from '../inbox/inbox-events.module.js';
import { DashboardController } from './controllers/dashboard.controller.js';
import { DashboardStatsService } from './services/dashboard-stats.service.js';
import { NotificationService } from './services/notification.service.js';

@Module({
  imports: [PrismaModule, InboxEventsModule, BillingModule],
  controllers: [DashboardController],
  providers: [DashboardStatsService, NotificationService],
  exports: [NotificationService, DashboardStatsService],
})
export class DashboardModule {}
