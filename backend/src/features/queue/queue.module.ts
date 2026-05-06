/**
 * @file features/queue/queue.module.ts
 *
 * Infrastructure-only module — registers PgBoss and producers.
 * Workers are registered in their FEATURE modules, not here.
 *
 * WHY workers are NOT in QueueModule:
 *   Workers depend on domain services (ReplyAiService, DataAiService, etc.).
 *   If QueueModule imported AiModule, and AiModule imported QueueModule
 *   for AiQueueProducer, that creates a circular dep that crashes at boot.
 *
 *   Solution:
 *     QueueModule   → exports producers only (no feature module imports)
 *     AiModule      → imports QueueModule + registers AiReplyWorker, AiSummaryWorker
 *     FacebookModule → imports QueueModule + registers FacebookSyncWorker, TokenValidateWorker
 *
 * Module import order in AppModule:
 *   1. QueueModule (PgBoss starts here)
 *   2. AiModule    (workers register here)
 *   3. FacebookModule (workers register here)
 */

import { Module } from '@nestjs/common';
import { PgBossProvider, pgBossFactory } from './providers/pg-boss.provider.js';
import { AiQueueProducer } from './producers/ai-queue.producer.js';
import { FacebookQueueProducer } from './producers/facebook-queue.producer.js';
import { QueueMonitorService } from './queue-monitor.service.js';
import { QueueController } from './queue.controller.js';

@Module({
  controllers: [QueueController],
  providers: [
    // Core pg-boss
    PgBossProvider,
    pgBossFactory,
    // Producers (enqueuers)
    AiQueueProducer,
    FacebookQueueProducer,
    // Monitoring
    QueueMonitorService,
  ],
  exports: [
    // Re-export PG_BOSS_TOKEN so workers in feature modules can inject PgBoss
    pgBossFactory,
    PgBossProvider,
    // Producers exported for use in feature services
    AiQueueProducer,
    FacebookQueueProducer,
  ],
})
export class QueueModule {}
