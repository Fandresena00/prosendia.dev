/**
 * @file features/inbox/hooks/use-inbox-sse.ts
 *
 * Connects to the SSE endpoint and dispatches typed events to callbacks.
 * Handles automatic reconnection (EventSource does this natively).
 *
 * Usage:
 *   useInboxSse(userId, {
 *     onNewMessage: (payload) => { ... },
 *     onConversationUpdated: (payload) => { ... },
 *     onSyncComplete: (payload) => { ... },
 *   });
 */

'use client';

import { useEffect, useRef } from 'react';
import { env } from '@/lib/env';
import type {
  ConversationUpdatedSsePayload,
  NewMessageSsePayload,
  SseEvent,
  SyncCompleteSsePayload,
} from '../types/inbox.types';

interface InboxSseCallbacks {
  onNewMessage?:         (payload: NewMessageSsePayload) => void;
  onConversationUpdated?: (payload: ConversationUpdatedSsePayload) => void;
  onSyncComplete?:       (payload: SyncCompleteSsePayload) => void;
}

export function useInboxSse(
  callbacks: InboxSseCallbacks,
): void {
  // Keep a stable ref so the effect doesn't re-run when callbacks change
  const cbRef = useRef(callbacks);

  useEffect(() => {
    cbRef.current = callbacks;
  }, [callbacks]);

  useEffect(() => {
    const url = `${env.API_URL}/inbox/events`;
    const source = new EventSource(url, { withCredentials: true });

    source.onmessage = (event: MessageEvent<string>) => {
      try {
        const parsed: SseEvent = JSON.parse(event.data);

        switch (parsed.type) {
          case 'new_message':
            cbRef.current.onNewMessage?.(parsed.data as NewMessageSsePayload);
            break;
          case 'conversation_updated':
            cbRef.current.onConversationUpdated?.(parsed.data as ConversationUpdatedSsePayload);
            break;
          case 'sync_complete':
            cbRef.current.onSyncComplete?.(parsed.data as SyncCompleteSsePayload);
            break;
          case 'ping':
            // Keepalive — no action needed
            break;
        }
      } catch {
        // Malformed event — ignore
      }
    };

    source.onerror = () => {
      // EventSource reconnects automatically after error
      // Log is noisy in dev so intentionally omitted
    };

    return () => {
      source.close();
    };
  }, []);
}
