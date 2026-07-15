/**
 * @file features/inbox/gateways/inbox-ws.gateway.ts
 *
 * WebSocket gateway for the inbox — replaces the SSE stream
 * (InboxSseController, now unregistered/deprecated) as the primary realtime
 * channel: lower latency, native reconnection handling on the client, and a
 * bidirectional channel needed for the AI reply-suggestion feature below.
 *
 * Namespace: /inbox   (client connects to `${WS_URL}/inbox`)
 *
 * Auth: same as the REST API — HttpOnly JWT cookie, read from the Socket.io
 * handshake headers. Confirmed against JwtStrategy (features/auth/strategies/jwt.strategy.ts):
 *   - Cookie name  → ACCESS_TOKEN_COOKIE, imported from auth.constants.ts
 *     (not hardcoded here, so it can never drift from the REST strategy).
 *   - Secret       → config key `jwtSecret` (same as JwtStrategy's `secretOrKey`).
 *   - Payload shape → JwtStrategy.validate() returns the decoded payload as-is
 *     (AuthenticatedUser, with `.sub`), same as what jwt.verify() below yields.
 * There's no NestJS Passport AuthGuard hook for Socket.io's handleConnection,
 * so this decodes the cookie manually with the same secret/cookie the REST
 * 'jwt' strategy uses — functionally equivalent, just applied at the
 * transport layer Passport doesn't cover.
 *
 * Events relayed 1:1 from InboxEventEmitter (payload unchanged):
 *   new_message | conversation_updated | sync_complete
 *   ai_typing_start | ai_typing_stop
 *
 * Client → server:
 *   request_ai_suggestion { conversationId } → streamed response:
 *     ai_suggestion_chunk  { conversationId, requestId, textChunk }  (n times)
 *     ai_suggestion_done   { conversationId, requestId, fullText, tokensUsed }
 *     ai_suggestion_error  { conversationId, requestId, message }
 *
 *   A per-socket cooldown (SUGGESTION_COOLDOWN_MS) guards against a client
 *   spam-clicking the suggestion button — each request burns AI credits via
 *   CreditService, so this is a cheap, useful backstop alongside it.
 */

import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { parseCookie } from 'cookie';
import type { Server, Socket } from 'socket.io';
import type { Subscription } from 'rxjs';
import { ACCESS_TOKEN_COOKIE } from '../../auth/auth.constants.js';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.types.js';
import { AiSuggestionService } from '../../ai/services/ai-suggestion.service.js';
import { InboxEventEmitter } from './inbox-sse.gateway.js';

/** Minimum delay between two request_ai_suggestion calls from the same socket. */
const SUGGESTION_COOLDOWN_MS = 4_000;

@WebSocketGateway({
  namespace: '/inbox',
  cors: { credentials: true },
})
export class InboxWsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(InboxWsGateway.name);
  /** One InboxEventEmitter subscription per connected socket — cleaned up on disconnect. */
  private readonly relaySubscriptions = new Map<string, Subscription>();
  /** Last request_ai_suggestion timestamp per socket — simple spam/credit-drain guard. */
  private readonly lastSuggestionRequestAt = new Map<string, number>();

  constructor(
    private readonly emitter:     InboxEventEmitter,
    private readonly jwt:         JwtService,
    private readonly config:      ConfigService,
    private readonly suggestions: AiSuggestionService,
  ) {}

  // ─── Connection lifecycle ───────────────────────────────────────────────────

  handleConnection(client: Socket): void {
    const userId = this.authenticate(client);
    if (!userId) {
      this.logger.warn(`WS connection rejected — no valid JWT (socket=${client.id})`);
      client.disconnect(true);
      return;
    }

    client.data.userId = userId;
    void client.join(userId); // room = userId, so REST-side emitter.emit(userId, ...) reaches this socket

    const subscription = this.emitter.forUser(userId).subscribe((event) => {
      // 'ping'/'typing' are legacy SSE-only concerns — Socket.io has its own
      // transport-level heartbeat, so we simply don't forward 'ping'.
      if (event.type === 'ping') return;
      client.emit(event.type, event.data);
    });
    this.relaySubscriptions.set(client.id, subscription);

    this.logger.debug(`WS connected — user=${userId} socket=${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.relaySubscriptions.get(client.id)?.unsubscribe();
    this.relaySubscriptions.delete(client.id);
    this.lastSuggestionRequestAt.delete(client.id);
  }

  // ─── AI reply suggestion (streamed) ─────────────────────────────────────────

  @SubscribeMessage('request_ai_suggestion')
  async onRequestAiSuggestion(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId?: string },
  ): Promise<void> {
    const userId = client.data.userId as string | undefined;
    const conversationId = body?.conversationId;
    const requestId = randomUUID();

    if (!userId || !conversationId || typeof conversationId !== 'string') {
      client.emit('ai_suggestion_error', {
        conversationId: conversationId ?? '',
        requestId,
        message: 'Requête de suggestion invalide.',
      });
      return;
    }

    const now = Date.now();
    const lastRequestAt = this.lastSuggestionRequestAt.get(client.id) ?? 0;
    if (now - lastRequestAt < SUGGESTION_COOLDOWN_MS) {
      client.emit('ai_suggestion_error', {
        conversationId,
        requestId,
        message: 'Merci de patienter quelques secondes avant de redemander une suggestion.',
      });
      return;
    }
    this.lastSuggestionRequestAt.set(client.id, now);

    try {
      const result = await this.suggestions.generateSuggestion(
        conversationId,
        userId,
        (textChunk) => {
          client.emit('ai_suggestion_chunk', { conversationId, requestId, textChunk });
        },
      );

      client.emit('ai_suggestion_done', {
        conversationId,
        requestId,
        fullText:   result.fullText,
        tokensUsed: result.tokensUsed,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la génération de la suggestion.';
      this.logger.warn(`AI suggestion failed conv=${conversationId} user=${userId}: ${message}`);
      client.emit('ai_suggestion_error', { conversationId, requestId, message });
    }
  }

  // ─── Auth ───────────────────────────────────────────────────────────────────

  /**
   * Mirrors JwtStrategy exactly: same cookie (ACCESS_TOKEN_COOKIE), same
   * secret (`jwtSecret`), same payload shape (AuthenticatedUser, via `.sub`).
   */
  private authenticate(client: Socket): string | null {
    try {
      const rawCookie = client.handshake.headers.cookie;
      const parsed = rawCookie ? parseCookie(rawCookie) : {};
      // Falls back to `auth: { token }` for non-browser clients (mobile app, tests).
      const token = parsed[ACCESS_TOKEN_COOKIE] ?? (client.handshake.auth?.token as string | undefined);
      if (!token) return null;

      const secret = this.config.getOrThrow<string>('jwtSecret');
      const payload = this.jwt.verify<AuthenticatedUser>(token, { secret });
      return payload?.sub ?? null;
    } catch {
      return null;
    }
  }
}
