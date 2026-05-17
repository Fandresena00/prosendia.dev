/**
 * @file features/facebook/facebook.module.ts
 *
 * CHANGES:
 *   - Added FacebookPostsService    → posts/comments sync and reply
 *   - Added PostCommentAiService    → AI-powered comment handling + spam filter
 *   - Added FacebookPostsController → REST endpoints for posts/comments/config
 *
 * Dependency graph (unchanged, no new circular deps):
 *   QueueModule      → (no feature modules)
 *   InboxEventsModule → (no deps)
 *   FacebookModule   → QueueModule, InboxEventsModule, forwardRef(InboxSyncModule)
 *   InboxSyncModule  → forwardRef(FacebookModule), PrismaModule, InboxEventsModule
 *   AiModule         → QueueModule, InboxEventsModule, forwardRef(FacebookModule)
 *
 * PostCommentAiService uses OpenRouterClient and PromptBuilderService from AiModule.
 * AiModule already exports these; FacebookModule imports AiModule via forwardRef.
 */

import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module.js';
import { AiModule } from '../ai/ai.module.js';
import { InboxEventsModule } from '../inbox/inbox-events.module.js';
import { InboxSyncModule } from '../inbox/inbox-sync.module.js';
import { QueueModule } from '../queue/queue.module.js';

// ── Existing providers ────────────────────────────────────────────────────────
import { FacebookGraphClient } from './clients/facebook-graph.client.js';
import { TokenEncryptionService } from './security/token-encryption.service.js';
import { FacebookAccountService } from './services/facebook-account.service.js';
import { FacebookAuthService } from './services/facebook-auth.service.js';
import { FacebookMessagingService } from './services/facebook-messaging.service.js';
import { FacebookSyncService } from './services/facebook-sync.service.js';
import { TokenService } from './services/token.service.js';
import { WebhookService } from './services/webhook.service.js';

// ── New providers ─────────────────────────────────────────────────────────────
import { FacebookPostsController } from './controllers/facebook-posts.controller.js';
import { FacebookController } from './facebook.controller.js';
import { FacebookPostsService } from './services/facebook-posts.service.js';
import { PostCommentAiService } from './services/post-comment-ai.service.js';

@Module({
  imports: [
    PrismaModule,
    QueueModule,
    InboxEventsModule,
    forwardRef(() => InboxSyncModule),
    forwardRef(() => AiModule), // PostCommentAiService needs OpenRouterClient + PromptBuilderService
  ],
  controllers: [
    FacebookController,
    FacebookPostsController, // NEW: posts/comments/ai-config endpoints
  ],
  providers: [
    // Infrastructure
    FacebookGraphClient,
    TokenEncryptionService,

    // Auth & account
    FacebookAuthService,
    FacebookAccountService,
    TokenService,

    // Messaging & webhooks
    FacebookMessagingService,
    WebhookService,

    // Sync
    FacebookSyncService,

    // NEW: Posts, comments, and comment AI
    FacebookPostsService,
    PostCommentAiService,
  ],
  exports: [
    FacebookGraphClient,
    FacebookAccountService,
    FacebookAuthService,
    FacebookMessagingService,
    FacebookSyncService,
    FacebookPostsService, // exported so other modules can use if needed
    PostCommentAiService,
    TokenService,
    TokenEncryptionService,
  ],
})
export class FacebookModule {}
