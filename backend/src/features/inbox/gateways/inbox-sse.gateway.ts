/**
 * @file features/inbox/gateways/inbox-sse.gateway.ts
 *
 * Server-Sent Events (SSE) gateway for the inbox.
 *
 * Why SSE instead of WebSocket?
 *   - SSE is one-directional (server → client), which is exactly what we need
 *   - Works through HTTP/2 multiplexing, no special infrastructure needed
 *   - Automatic reconnection built into the browser EventSource API
 *   - NestJS `@Sse` + `Observable` gives us a clean push model
 *
 * Architecture:
 *   - InboxSseGateway exposes a single endpoint: GET /inbox/events?userId=...
 *   - InboxEventEmitter is an injectable event bus used by sync / webhook services
 *     to push events into all active SSE streams for the target user
 *
 * Event types:
 *   new_message          → a new message arrived (from Facebook webhook or manual sync)
 *   conversation_updated → metadata changed (handover, unread count, last message)
 *   sync_complete        → background sync finished
 *   ping                 → keepalive every 25s (prevents proxy timeouts)
 */

import { Controller, Injectable, Logger, Res, Sse, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Observable, Subject, filter, map, merge, timer } from 'rxjs';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.types.js';
import type {
  ConversationUpdatedEvent,
  NewMessageEvent,
  SseEvent,
  SseEventType,
  SyncCompleteEvent,
} from '../dto/inbox.dto.js';

// ─── Event emitter (singleton injectable) ────────────────────────────────────

/**
 * Injectable event bus.
 * Other services (WebhookService, InboxSyncService) inject this to push events.
 */
@Injectable()
export class InboxEventEmitter {
  private readonly subject = new Subject<{ userId: string; event: SseEvent }>();

  /** Push an event to all SSE streams subscribed for this userId */
  emit<T>(userId: string, type: SseEventType, data: T): void {
    const event: SseEvent<T> = { type, data, at: new Date().toISOString() };
    this.subject.next({ userId, event });
  }

  /** Observable filtered to a specific user */
  forUser(userId: string): Observable<SseEvent> {
    return this.subject.pipe(
      filter((e) => e.userId === userId),
      map((e) => e.event),
    );
  }

  // Convenience methods

  newMessage(userId: string, payload: NewMessageEvent): void {
    this.emit(userId, 'new_message', payload);
  }

  conversationUpdated(userId: string, payload: ConversationUpdatedEvent): void {
    this.emit(userId, 'conversation_updated', payload);
  }

  syncComplete(userId: string, payload: SyncCompleteEvent): void {
    this.emit(userId, 'sync_complete', payload);
  }
}

// ─── SSE controller endpoint ──────────────────────────────────────────────────

@Controller('inbox')
export class InboxSseController {
  private readonly logger = new Logger(InboxSseController.name);

  constructor(private readonly emitter: InboxEventEmitter) {}

  /**
   * GET /inbox/events
   *
   * Opens a persistent SSE stream for the authenticated user.
   * The frontend connects with cookies:
   *   new EventSource(`${API_URL}/inbox/events`, { withCredentials: true })
   */
  @Sse('events')
  @UseGuards(JwtAuthGuard)
  stream(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Observable<MessageEvent> {
    const userId = user.sub;
    this.logger.log(`SSE stream opened for user ${userId}`);

    // Keepalive ping every 25 seconds to prevent proxy/load-balancer timeouts
    const ping$ = timer(0, 25_000).pipe(
      map(() => ({
        type:  'ping' as SseEventType,
        data:  null,
        at:    new Date().toISOString(),
      })),
    );

    const events$ = this.emitter.forUser(userId);

    return merge(ping$, events$).pipe(
      map((event) => {
        const msg = new MessageEvent('message', {
          data: JSON.stringify(event),
        });
        return msg;
      }),
    );
  }
}
