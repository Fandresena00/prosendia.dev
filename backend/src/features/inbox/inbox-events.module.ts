/**
 * @file features/inbox/inbox-events.module.ts
 *
 * Thin shared module that exposes only InboxEventEmitter.
 *
 * Why a separate module?
 *   InboxEventEmitter is needed by three modules:
 *     - InboxModule         (owns it)
 *     - FacebookModule      (webhook service emits new_message events)
 *     - AiModule            (emits escalation / conversation_updated events)
 *
 *   To avoid a circular dependency between InboxModule ↔ FacebookModule ↔ AiModule,
 *   we extract InboxEventEmitter into this lean shared module.
 *   All three modules import InboxEventsModule instead of InboxModule.
 */

import { Module } from '@nestjs/common';
import { InboxEventEmitter } from './gateways/inbox-sse.gateway.js';

@Module({
  providers: [InboxEventEmitter],
  exports:   [InboxEventEmitter],
})
export class InboxEventsModule {}
