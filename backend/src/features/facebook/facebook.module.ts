/**
 * @file features/facebook/facebook.module.ts
 *
 * Dependency graph (no cycles):
 *   QueueModule      → (no feature modules)
 *   InboxEventsModule → (no deps)
 *   FacebookModule   → QueueModule, InboxEventsModule, forwardRef(InboxSyncModule)
 *   InboxSyncModule  → forwardRef(FacebookModule), PrismaModule, InboxEventsModule
 *   AiModule         → QueueModule, InboxEventsModule
 */

import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module.js';
import { InboxEventsModule } from '../inbox/inbox-events.module.js';
import { InboxSyncModule } from '../inbox/inbox-sync.module.js';
import { MediaDownloadService } from '../inbox/services/media-download.service.js';
import { QueueModule } from '../queue/queue.module.js';
import { FacebookGraphClient } from './clients/facebook-graph.client.js';
import { FacebookController } from './facebook.controller.js';
import { TokenEncryptionService } from './security/token-encryption.service.js';
import { WebhookSignatureGuard } from './security/webhook-signature.guard.js';
import { FacebookAccountService } from './services/facebook-account.service.js';
import { FacebookAuthService } from './services/facebook-auth.service.js';
import { FacebookMessagingService } from './services/facebook-messaging.service.js';
import { FacebookSyncService } from './services/facebook-sync.service.js';
import { TokenService } from './services/token.service.js';
import { WebhookService } from './services/webhook.service.js';
import {
  FacebookSyncWorker,
  TokenValidateWorker,
} from './workers/facebook.worker.js';

@Module({
  imports: [
    PrismaModule,
    QueueModule,
    InboxEventsModule,
    forwardRef(() => InboxSyncModule),
  ],
  controllers: [FacebookController],
  providers: [
    FacebookGraphClient,
    TokenEncryptionService,
    WebhookSignatureGuard,
    TokenService,
    FacebookAccountService,
    FacebookAuthService,
    FacebookSyncService,
    FacebookMessagingService,
    WebhookService,
    FacebookSyncWorker,
    TokenValidateWorker,
    MediaDownloadService,
  ],
  exports: [
    FacebookAccountService,
    FacebookGraphClient,
    FacebookMessagingService,
    TokenService,
  ],
})
export class FacebookModule {}
