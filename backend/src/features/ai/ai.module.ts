/**
 * @file features/ai/ai.module.ts
 *
 * CHANGE: Added BillingModule import so CreditService is available
 * in ReplyAiService, AiReplyWorker and AiSummaryWorker.
 *
 * CHANGE (realtime upgrade): Added AiSuggestionService — powers the inbox
 * "Suggestion IA" button (streamed reply drafts for a human agent). It's
 * exported so InboxModule can inject it into InboxWsGateway without
 * duplicating the OpenRouter/PromptBuilder/CreditService wiring.
 */

import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module.js';
import { BillingModule } from '../billing/billing.module.js';
import { FacebookModule } from '../facebook/facebook.module.js';
import { InboxEventsModule } from '../inbox/inbox-events.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { OpenRouterClient } from './clients/openrouter.client.js';
import { AiController } from './controllers/ai.controller.js';
import { AiConfigService } from './services/ai-config.service.js';
import { AiSuggestionService } from './services/ai-suggestion.service.js';
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
    BillingModule,                   // ← pour CreditService dans ReplyAiService / AiSuggestionService
    forwardRef(() => FacebookModule),
  ],
  controllers: [AiController],
  providers: [
    OpenRouterClient,
    PromptBuilderService,
    DataAiService,
    ReplyAiService,
    AiConfigService,
    AiSuggestionService,             // ← NEW
    AiReplyWorker,
    AiSummaryWorker,
  ],
  exports: [
    ReplyAiService,
    DataAiService,
    AiSuggestionService,             // ← NEW: consommé par InboxWsGateway
  ],
})
export class AiModule {}
