/**
 * @file features/posts-events/posts-events.module.ts
 *
 * Lightweight standalone module that only provides PostsEventEmitter.
 * No imports from other feature modules → no circular dependency risk.
 *
 * Import this in:
 *   - FacebookModule       → WebhookService emits comment:new on webhook arrival
 *   - FacebookPostsModule  → SSE controller + scheduler emit all event types
 */

import { Module } from '@nestjs/common';
import { PostsEventEmitter } from './posts-event-emitter.js';

@Module({
  providers: [PostsEventEmitter],
  exports:   [PostsEventEmitter],
})
export class PostsEventsModule {}
