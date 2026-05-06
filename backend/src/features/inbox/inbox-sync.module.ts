/**
 * @file features/inbox/inbox-sync.module.ts
 *
 * Provides InboxSyncService for use by FacebookSyncWorker.
 *
 * Does NOT import FacebookModule to avoid circular dependency:
 *   FacebookModule → InboxSyncModule → FacebookModule
 *
 * InboxSyncService receives FacebookAccountService and FacebookGraphClient
 * via NestJS DI — they are exported by FacebookModule which is imported
 * by AppModule before InboxSyncModule is resolved.
 *
 * Concretely: FacebookSyncWorker lives in FacebookModule which already has
 * FacebookAccountService and FacebookGraphClient in scope, so InboxSyncService
 * can be provided directly there without a separate module.
 */

import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module.js';
import { InboxEventsModule } from './inbox-events.module.js';
import { FacebookModule } from '../facebook/facebook.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { InboxSyncService } from './services/inbox-sync.service.js';

@Module({
  imports: [
    PrismaModule,
    InboxEventsModule,
    QueueModule,
    forwardRef(() => FacebookModule),
  ],
  providers: [InboxSyncService],
  exports:   [InboxSyncService],
})
export class InboxSyncModule {}
