import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module.js';
import { InboxEventsModule } from '../inbox/inbox-events.module.js';
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

@Module({
  imports: [PrismaModule, InboxEventsModule],
  controllers: [FacebookController],
  providers: [
    // Infrastructure
    FacebookGraphClient,
    TokenEncryptionService,
    WebhookSignatureGuard,
    // Services
    TokenService,
    FacebookAccountService,
    FacebookAuthService,
    FacebookSyncService,
    FacebookMessagingService,
    WebhookService,
  ],
  exports: [
    // Exported for use by other modules (e.g. AI reply automation, analytics)
    FacebookAccountService,
    FacebookGraphClient,
    FacebookMessagingService,
    TokenService,
  ],
})
export class FacebookModule {}
