/**
 * @file features/facebook-posts/facebook-posts.module.ts
 *
 * Standalone feature module for managed Facebook posts, comments, and AI replies.
 *
 * NEW ADDITIONS
 * ─────────────
 *   PostsEventsModule        → provides PostsEventEmitter (zero-dep, no circular risk)
 *   PostsSseController       → GET /facebook/posts/events (dedicated SSE stream)
 *   CommentPromptBuilderService → separated prompt logic for comments only
 *   PostsSyncSchedulerService   → 5-min pg-boss fallback sync
 *
 * DEPENDENCY GRAPH
 * ────────────────
 *   PostsEventsModule        (no deps — safe to import anywhere)
 *   FacebookPostsModule  →   PostsEventsModule
 *                        →   forwardRef(FacebookModule)   [GraphClient, TokenEncryption]
 *                        →   forwardRef(AiModule)         [OpenRouterClient]
 *                        →   QueueModule                  [PG_BOSS_TOKEN for scheduler]
 *                        →   PrismaModule
 */

import { Module, forwardRef } from '@nestjs/common';

import { PrismaModule } from '../../../database/prisma.module.js';
import { AiModule } from '../../ai/ai.module.js';
import { QueueModule } from '../../queue/queue.module.js';
import { FacebookModule } from '../facebook.module.js';
import { FacebookPostsController } from './controllers/facebook-posts.controller.js';
import { PostsSseController } from './gateways/posts-sse.controller.js';
import { PostsEventsModule } from './posts-events/posts-events.module.js';
import { CommentPromptBuilderService } from './services/comment-prompt-builder.service.js';
import { FacebookPostsService } from './services/facebook-posts.service.js';
import { PostCommentAiService } from './services/post-comment-ai.service.js';
import { PostsSyncSchedulerService } from './services/posts-sync-scheduler.service.js';

@Module({
  imports: [
    PrismaModule,
    QueueModule, // PG_BOSS_TOKEN for PostsSyncSchedulerService
    PostsEventsModule, // PostsEventEmitter
    forwardRef(() => FacebookModule), // FacebookGraphClient + TokenEncryptionService
    forwardRef(() => AiModule), // OpenRouterClient
  ],
  controllers: [
    FacebookPostsController,
    PostsSseController, // NEW: GET /facebook/posts/events
  ],
  providers: [
    CommentPromptBuilderService, // NEW: separated comment prompts
    FacebookPostsService,
    PostCommentAiService,
    PostsSyncSchedulerService, // NEW: 5-min fallback scheduler
  ],
  exports: [
    FacebookPostsService,
    PostCommentAiService,
    CommentPromptBuilderService,
  ],
})
export class FacebookPostsModule {}
