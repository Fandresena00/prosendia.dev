/**
 * @file features/inbox/hooks/use-inbox-sse.ts
 *
 * Opens a Server-Sent Events connection to the NestJS backend inbox stream
 * and dispatches typed events to caller-provided callbacks.
 *
 * EventSource reconnects automatically on network errors (browser behaviour).
 *
 * CHANGES:
 *   - SSE URL now uses NEXT_PUBLIC_API_URL environment variable instead of a
 *     relative path. A relative `/api/...` path hits Next.js API routes, not
 *     the NestJS backend. The full backend URL is required for SSE.
 *   - Variable names made more explicit.
 *
 * Required env var:
 *   NEXT_PUBLIC_API_URL=https://api.vendeoai.com/api   (production)
 *   NEXT_PUBLIC_API_URL=http://localhost:5000/api       (development)
 */

"use client";

import { useEffect, useRef } from "react";
import type {
  ConversationUpdatedSsePayload,
  NewMessageSsePayload,
  SseEvent,
  SyncCompleteSsePayload,
} from "../types/inbox.types";

interface InboxSseCallbacks {
  onNewMessage?:          (payload: NewMessageSsePayload)          => void;
  onConversationUpdated?: (payload: ConversationUpdatedSsePayload) => void;
  onSyncComplete?:        (payload: SyncCompleteSsePayload)        => void;
}

/**
 * The NestJS backend URL for SSE.
 * NEXT_PUBLIC_API_URL must include the /api prefix.
 * Example: http://localhost:5000/api
 */
const BACKEND_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api';

export function useInboxSse(callbacks: InboxSseCallbacks): void {
  // Stable ref so the effect doesn't re-run when callbacks change identity
  const callbacksRef = useRef(callbacks);
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  useEffect(() => {
    const sseUrl = `${BACKEND_API_BASE_URL}/inbox/events`;
    const eventSource = new EventSource(sseUrl, { withCredentials: true });

    eventSource.onmessage = (rawEvent: MessageEvent<string>) => {
      try {
        const parsedEvent: SseEvent = JSON.parse(rawEvent.data);

        switch (parsedEvent.type) {
          case 'new_message':
            callbacksRef.current.onNewMessage?.(
              parsedEvent.data as NewMessageSsePayload,
            );
            break;

          case 'conversation_updated':
            callbacksRef.current.onConversationUpdated?.(
              parsedEvent.data as ConversationUpdatedSsePayload,
            );
            break;

          case 'sync_complete':
            callbacksRef.current.onSyncComplete?.(
              parsedEvent.data as SyncCompleteSsePayload,
            );
            break;

          case 'ping':
            // Server keepalive — no action needed
            break;
        }
      } catch {
        // Malformed JSON event — ignore silently
      }
    };

    eventSource.onerror = () => {
      // EventSource will automatically attempt to reconnect — no manual action needed
    };

    return () => {
      eventSource.close();
    };
  }, []); // Empty deps — connect once, callbacks accessed via ref
}
