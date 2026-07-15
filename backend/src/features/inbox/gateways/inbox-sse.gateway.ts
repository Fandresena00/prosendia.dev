/**
 * @file features/inbox/gateways/inbox-sse.gateway.ts
 *
 * InboxEventEmitter — the injectable event bus used by sync/webhook/AI
 * services to push realtime events to a given user.
 *
 * CHANGES (realtime upgrade):
 *   - Added aiTypingStart() / aiTypingStop() convenience methods for the
 *     "VendeoAI est en train d'écrire…" bubble.
 *   - The delivery mechanism has moved from SSE to WebSocket:
 *     InboxWsGateway (gateways/inbox-ws.gateway.ts) is now the primary
 *     consumer of forUser() and is registered in inbox.module.ts instead of
 *     InboxSseController below.
 *   - InboxSseController / the `stream()` endpoint are KEPT in this file,
 *     unregistered from the module, purely as a rollback path — delete once
 *     the WebSocket gateway has been running reliably in production.
 *
 * InboxEventEmitter itself is unchanged in shape (still exported from this
 * file) so InboxEventsModule and every existing consumer (FacebookModule's
 * webhook service, AiModule) keep working without any import changes.
 */

import { Controller, Injectable, Logger, Res, Sse, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Observable, Subject, filter, map, merge, timer } from 'rxjs';
import type {
  AiTypingEvent,
  ConversationUpdatedEvent,
  InboxEventType,
  NewMessageEvent,
  SseEvent,
  SyncCompleteEvent,
} from '../dto/inbox.dto.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.types.js';

// ─── Event emitter (singleton injectable) ────────────────────────────────────

/**
 * Injectable event bus.
 * Other services (WebhookService, InboxSyncService, InboxSyncSchedulerService,
 * the AI reply worker) inject this to push events. InboxWsGateway is the
 * (single) subscriber that fans events out to connected WebSocket clients.
 */
@Injectable()
export class InboxEventEmitter {
  private readonly subject = new Subject<{ userId: string; event: SseEvent }>();

  /** Push an event to all realtime streams subscribed for this userId */
  emit<T>(userId: string, type: InboxEventType, data: T): void {
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

  /**
   * The AI is composing a reply for this conversation — the chat UI shows a
   * "VendeoAI est en train d'écrire…" bubble. Call this right before invoking
   * the model (OpenRouter), from wherever the AI reply job is processed.
   */
  aiTypingStart(userId: string, payload: AiTypingEvent): void {
    this.emit(userId, 'ai_typing_start', payload);
  }

  /**
   * Call once the AI reply has been sent OR the attempt has failed/escalated,
   * so the typing bubble disappears. If your AI reply worker isn't covered by
   * the files in this change set, add a call to this method there — the
   * frontend also self-clears the bubble on the next new_message for that
   * conversation and after a ~20s safety timeout, so a missed call is not
   * catastrophic, just slightly less crisp.
   */
  aiTypingStop(userId: string, payload: AiTypingEvent): void {
    this.emit(userId, 'ai_typing_stop', payload);
  }
}

// ─── SSE controller endpoint (deprecated — see file header) ──────────────────

/** @deprecated superseded by InboxWsGateway. Not registered in InboxModule. */
@Controller('inbox')
export class InboxSseController {
  private readonly logger = new Logger(InboxSseController.name);

  constructor(private readonly emitter: InboxEventEmitter) {}

  /**
   * GET /inbox/events
   *
   * Opens a persistent SSE stream for the authenticated user.
   * The frontend connects with: new EventSource('/api/inbox/events', { withCredentials: true })
   *
   * Note: In production, userId comes from the JWT guard via @CurrentUser().
   */
  @UseGuards(JwtAuthGuard)
  @Sse('events')
  stream(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Observable<MessageEvent> {
    const userId = user.sub;
    this.logger.log(`SSE stream opened for user ${userId}`);

    // Keepalive ping every 25 seconds to prevent proxy/load-balancer timeouts
    const ping$ = timer(0, 25_000).pipe(
      map(() => ({
        type:  'ping' as InboxEventType,
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
