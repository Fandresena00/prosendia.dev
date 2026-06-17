/**
 * @file features/facebook-posts/facebook-posts.module.ts
 *
 * CHANGE: Added BillingModule import so CreditService is available
 * in PostCommentAiService.
 */

import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../../database/prisma.module.js';
import { AiModule } from '../../ai/ai.module.js';
import { OpenRouterClient } from '../../ai/clients/openrouter.client.js';
import { BillingModule } from '../../billing/billing.module.js';
import { QueueModule } from '../../queue/queue.module.js';
import { FacebookModule } from '../facebook.module.js';
import { FacebookPostsController } from './controllers/facebook-posts.controller.js';
import { PostsSseController } from './gateways/posts-sse.controller.js';
import { PostsEventsModule } from './posts-events/posts-events.module.js';
import { CommentPromptBuilderService } from './services/comment-prompt-builder.service.js';
import { FacebookPostsService } from './services/facebook-posts.service.js';
import { PostCommentAiService } from './services/post-comment-ai.service.js';
import { PostsSyncSchedulerService } from './services/posts-sync-scheduler.service.js';
import { CommentAiReplyWorker } from './workers/comment-ai-reply.worker.js';

@Module({
  imports: [
    PrismaModule,
    QueueModule,
    PostsEventsModule,
    BillingModule,                     // ← pour CreditService dans PostCommentAiService
    forwardRef(() => FacebookModule),
    forwardRef(() => AiModule),
  ],
  controllers: [FacebookPostsController, PostsSseController],
  providers: [
    CommentPromptBuilderService,
    FacebookPostsService,
    PostCommentAiService,
    PostsSyncSchedulerService,
    CommentAiReplyWorker,              // ← NEW: real-time + 10-min recheck consumer
    OpenRouterClient,
  ],
  exports: [
    FacebookPostsService,
    PostCommentAiService,
    CommentPromptBuilderService,
  ],
})
export class FacebookPostsModule {}
