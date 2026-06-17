/**
 * @file features/posts-events/posts-event-emitter.ts
 *
 * Standalone Node.js EventEmitter for real-time post/comment events.
 *
 * DESIGN
 * ──────
 * Intentionally has ZERO imports from other feature modules so it can be
 * imported by both FacebookModule (webhook emission) and FacebookPostsModule
 * (SSE controller + scheduler) without creating a circular dependency.
 *
 * Channel naming: `posts:{userId}`
 * Each SSE connection subscribes to its own user channel.
 *
 * USAGE
 * ──────
 *   // In any service:
 *   this.postsEmitter.commentAdded(userId, postId, commentData);
 *
 *   // In SSE controller (via subscribe):
 *   return this.postsEmitter.subscribe(userId);
 *
 * CHANGE — commentAiSkipped()
 * ─────────────────────────────
 * New event emitted when PostCommentAiService evaluates a comment and
 * deliberately does NOT reply (spam-filtered, autoReply off, no credits…).
 * Without this, the frontend had no way to distinguish "AI hasn't gotten to
 * this comment yet" from "AI looked at this and chose not to reply" —
 * users thought the feature was simply broken. The frontend now shows a
 * small "IA: pas de réponse (ressemble à du spam)" badge with a manual
 * "Forcer la réponse IA" action.
 */

import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';
import { Observable } from 'rxjs';
import type { MessageEvent } from '@nestjs/common';

// ─── Event payload shapes ─────────────────────────────────────────────────────

export type PostsEventType =
  | 'comment:new'
  | 'comment:replied'
  | 'comment:ai_skipped'
  | 'post:updated'
  | 'sync:completed'
  | 'heartbeat';

export interface PostsEvent {
  type:    PostsEventType;
  postId?: string;
  data:    Record<string, unknown>;
}

// ─── Emitter ──────────────────────────────────────────────────────────────────

@Injectable()
export class PostsEventEmitter extends EventEmitter {
  constructor() {
    super();
    // Allow many concurrent SSE connections per instance
    this.setMaxListeners(200);
  }

  // ─── Typed emit helpers ───────────────────────────────────────────────────

  /** Emit when a new comment is created (via webhook or scheduler sync). */
  commentAdded(
    userId:  string,
    postId:  string,
    comment: Record<string, unknown>,
  ): void {
    this.emit(this.key(userId), {
      type:   'comment:new',
      postId,
      data:   { comment },
    } satisfies PostsEvent);
  }

  /** Emit when a comment receives an AI or manual reply. */
  commentReplied(
    userId:    string,
    postId:    string,
    commentId: string,
    reply:     { content: string; repliedByAi: boolean },
  ): void {
    this.emit(this.key(userId), {
      type:   'comment:replied',
      postId,
      data:   { commentId, reply },
    } satisfies PostsEvent);
  }

  /**
   * Emit when PostCommentAiService evaluated a comment and chose NOT to
   * reply (spam-filtered, autoReply disabled, no credits, etc.).
   * `reason` is one of ProcessCommentSkipReason; `spamScore` is included
   * when the skip was due to the spam filter.
   */
  commentAiSkipped(
    userId:    string,
    postId:    string,
    commentId: string,
    info:      { reason: string; spamScore?: number; message?: string },
  ): void {
    this.emit(this.key(userId), {
      type:   'comment:ai_skipped',
      postId,
      data:   { commentId, ...info },
    } satisfies PostsEvent);
  }

  /** Emit when a post's metadata changes (commentsCount, reactionsCount…). */
  postUpdated(
    userId:  string,
    postId:  string,
    updates: Record<string, unknown>,
  ): void {
    this.emit(this.key(userId), {
      type:   'post:updated',
      postId,
      data:   updates,
    } satisfies PostsEvent);
  }

  /**
   * Emit after a scheduled sync cycle completes.
   * Frontend uses this as a signal to reload comments for the active post.
   */
  syncCompleted(userId: string): void {
    this.emit(this.key(userId), {
      type: 'sync:completed',
      data: { ts: Date.now() },
    } satisfies PostsEvent);
  }

  // ─── SSE subscription ─────────────────────────────────────────────────────

  /**
   * Returns an Observable that emits NestJS MessageEvents for each posts event.
   * Automatically cleans up the EventEmitter listener on unsubscription
   * (i.e. when the SSE client disconnects).
   */
  subscribe(userId: string): Observable<MessageEvent> {
    const channel = this.key(userId);

    return new Observable<MessageEvent>((observer) => {
      const handler = (payload: PostsEvent) => {
        try {
          observer.next({ data: JSON.stringify(payload) } as MessageEvent);
        } catch {
          // Client closed the connection mid-send — safe to ignore
        }
      };

      this.on(channel, handler);

      // Teardown: called when client disconnects or Observable is unsubscribed
      return () => {
        this.off(channel, handler);
      };
    });
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private key(userId: string): string {
    return `posts:${userId}`;
  }
}
