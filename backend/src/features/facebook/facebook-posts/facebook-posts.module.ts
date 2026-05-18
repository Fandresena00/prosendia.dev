/**
 * @file features/facebook-posts/facebook-posts.module.ts
 *
 * Standalone feature module for Facebook posts, comments, and AI comment handling.
 * Extracted from FacebookModule to keep each module focused on a single domain:
 *
 *   FacebookModule      → OAuth, connections, messaging (DMs), webhook, token management
 *   FacebookPostsModule → Posts feed sync, comment sync, comment replies, comment AI
 *
 * Dependency graph:
 *   FacebookPostsModule → PrismaModule
 *   FacebookPostsModule → forwardRef(FacebookModule)   ← FacebookGraphClient, TokenEncryptionService
 *   FacebookPostsModule → forwardRef(AiModule)         ← OpenRouterClient, PromptBuilderService
 *
 * Both forwardRef() are required because:
 *   - FacebookModule  imports InboxSyncModule which has no relation to posts
 *   - AiModule        imports forwardRef(FacebookModule) for AI reply workers
 *   Neither creates a new circular dep — the refs already existed in the old design.
 *
 * AppModule import order:
 *   1. QueueModule
 *   2. AiModule
 *   3. FacebookModule
 *   4. FacebookPostsModule  ← NEW, after FacebookModule is fully initialized
 *   5. InboxSyncModule
 */

import { Module, forwardRef } from '@nestjs/common';

import { PrismaModule } from '../../../database/prisma.module.js';
import { AiModule } from '../../ai/ai.module.js';
import { FacebookModule } from '../facebook.module.js';
import { FacebookPostsController } from './controllers/facebook-posts.controller.js';
import { FacebookPostsService } from './services/facebook-posts.service.js';
import { PostCommentAiService } from './services/post-comment-ai.service.js';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => FacebookModule), // provides FacebookGraphClient + TokenEncryptionService
    forwardRef(() => AiModule), // provides OpenRouterClient + PromptBuilderService
  ],
  controllers: [FacebookPostsController],
  providers: [FacebookPostsService, PostCommentAiService],
  exports: [FacebookPostsService, PostCommentAiService],
})
export class FacebookPostsModule {}
