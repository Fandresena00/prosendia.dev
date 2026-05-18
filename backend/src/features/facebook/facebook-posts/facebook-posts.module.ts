/**
 * @file features/facebook-posts/facebook-posts.module.ts
 *
 * Standalone feature module for Facebook posts, comments, and AI comment handling.
 *
 * Dependency graph:
 *   FacebookPostsModule → PrismaModule
 *   FacebookPostsModule → forwardRef(FacebookModule)   ← FacebookGraphClient, TokenEncryptionService
 *   FacebookPostsModule → forwardRef(AiModule)         ← OpenRouterClient, PromptBuilderService
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
    forwardRef(() => FacebookModule),
    forwardRef(() => AiModule),
  ],
  controllers: [FacebookPostsController],
  providers: [FacebookPostsService, PostCommentAiService],
  exports: [FacebookPostsService, PostCommentAiService],
})
export class FacebookPostsModule {}
