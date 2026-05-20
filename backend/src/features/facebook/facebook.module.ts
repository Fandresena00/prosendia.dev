/**
 * @file features/facebook/facebook.module.ts
 *
 * Core Facebook integration module — OAuth, connections, messaging, webhook, sync, tokens.
 *
 * ADDITION: PostsEventsModule is now imported so WebhookService can inject
 * PostsEventEmitter and emit comment:new in real-time when a webhook arrives.
 * PostsEventsModule has zero deps → no circular dependency risk.
 */

import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module.js';
import { InboxEventsModule } from '../inbox/inbox-events.module.js';
import { InboxSyncModule } from '../inbox/inbox-sync.module.js';
import { QueueModule } from '../queue/queue.module.js';

import { MediaDownloadService } from '../inbox/services/media-download.service.js';
import { FacebookGraphClient } from './clients/facebook-graph.client.js';
import { PostsEventsModule } from './facebook-posts/posts-events/posts-events.module.js';
import { FacebookController } from './facebook.controller.js';
import { TokenEncryptionService } from './security/token-encryption.service.js';
import { FacebookAccountService } from './services/facebook-account.service.js';
import { FacebookAuthService } from './services/facebook-auth.service.js';
import { FacebookMessagingService } from './services/facebook-messaging.service.js';
import { FacebookSyncService } from './services/facebook-sync.service.js';
import { TokenService } from './services/token.service.js';
import { WebhookService } from './services/webhook.service.js';

@Module({
  imports: [
    PrismaModule,
    QueueModule,
    InboxEventsModule,
    PostsEventsModule, // NEW: for WebhookService → PostsEventEmitter
    forwardRef(() => InboxSyncModule),
  ],
  controllers: [FacebookController],
  providers: [
    FacebookGraphClient,
    TokenEncryptionService,
    FacebookAuthService,
    FacebookAccountService,
    TokenService,
    FacebookMessagingService,
    WebhookService,
    FacebookSyncService,
    MediaDownloadService,
  ],
  exports: [
    FacebookGraphClient,
    TokenEncryptionService,
    FacebookAccountService,
    FacebookAuthService,
    FacebookMessagingService,
    FacebookSyncService,
    TokenService,
  ],
})
export class FacebookModule {}
