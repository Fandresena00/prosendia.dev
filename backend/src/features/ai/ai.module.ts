/**
 * @file features/ai/ai.module.ts
 *
 * Dependency graph (no circular deps):
 *   QueueModule      → (no feature modules)
 *   InboxEventsModule → (no deps)
 *   FacebookModule   → QueueModule, InboxEventsModule, forwardRef(InboxSyncModule)
 *   InboxSyncModule  → forwardRef(FacebookModule), PrismaModule, InboxEventsModule
 *   AiModule         → QueueModule, InboxEventsModule, forwardRef(FacebookModule)
 *
 * forwardRef is needed on both AiModule → FacebookModule sides because:
 *   FacebookModule exports FacebookMessagingService (needed by ReplyAiService)
 *   AiModule exports ReplyAiService (NOT needed by FacebookModule now — uses queue)
 *   So only ONE direction needs forwardRef — AiModule → FacebookModule.
 */

import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module.js';
import { FacebookModule } from '../facebook/facebook.module.js';
import { InboxEventsModule } from '../inbox/inbox-events.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { OpenRouterClient } from './clients/openrouter.client.js';
import { AiController } from './controllers/ai.controller.js';
import { AiConfigService } from './services/ai-config.service.js';
import { DataAiService } from './services/data-ai.service.js';
import { PromptBuilderService } from './services/prompt-builder.service.js';
import { ReplyAiService } from './services/reply-ai.service.js';
import { AiReplyWorker } from './workers/ai-reply.worker.js';
import { AiSummaryWorker } from './workers/ai-summary.worker.js';

@Module({
  imports: [
    PrismaModule,
    QueueModule,
    InboxEventsModule,
    forwardRef(() => FacebookModule), // ReplyAiService needs FacebookMessagingService
  ],
  controllers: [AiController],
  providers: [
    OpenRouterClient,
    PromptBuilderService,
    DataAiService,
    ReplyAiService,
    AiConfigService,
    AiReplyWorker,
    AiSummaryWorker,
  ],
  exports: [
    ReplyAiService,
    DataAiService,
  ],
})
export class AiModule {}
