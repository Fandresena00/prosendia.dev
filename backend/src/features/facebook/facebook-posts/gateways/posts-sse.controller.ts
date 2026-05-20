/**
 * @file features/facebook-posts/gateways/posts-sse.controller.ts
 *
 * SSE endpoint dedicated to post/comment real-time updates.
 * Completely separate from the inbox SSE (InboxSseGateway).
 *
 * Endpoint: GET /facebook/posts/events
 *
 * Client connects once per page session. The server pushes:
 *   { type: 'comment:new',    postId, data: { comment } }
 *   { type: 'comment:replied', postId, data: { commentId, reply } }
 *   { type: 'post:updated',   postId, data: { commentsCount, ... } }
 *   { type: 'sync:completed', data: { ts } }
 *
 * The frontend EventSource must set `withCredentials: true` so the
 * HttpOnly JWT cookie is forwarded with the SSE request.
 */

import { Controller, Get, MessageEvent, Sse, UseGuards } from '@nestjs/common';
import { Observable } from 'rxjs';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../../../auth/types/authenticated-user.types.js';
import { PostsEventEmitter } from '../posts-events/posts-event-emitter.js';

@UseGuards(JwtAuthGuard)
@Controller('facebook')
export class PostsSseController {
  constructor(private readonly emitter: PostsEventEmitter) {}

  /**
   * GET /facebook/posts/events
   *
   * Opens a persistent SSE stream for the authenticated user.
   * NestJS automatically sends the `text/event-stream` content-type
   * and handles keep-alive. The Observable teardown (unsubscribe) fires
   * when the client disconnects, removing the EventEmitter listener.
   */
  @Get('posts/events')
  @Sse()
  stream(@CurrentUser() user: AuthenticatedUser): Observable<MessageEvent> {
    return this.emitter.subscribe(user.sub);
  }
}
