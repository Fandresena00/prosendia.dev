"use client";
/**
 * @file features/inbox/hooks/use-inbox-sse.ts
 *
 * SSE hook for the inbox. Reconnects automatically with exponential backoff.
 *
 * EventSource stops retrying on some error types (e.g. 401, CORS failures).
 * This hook closes the connection on error and reopens it after a delay,
 * so the stream stays alive permanently even after transient auth refresh
 * or network interruptions.
 *
 * Backoff: 2s → 4s → 8s → 16s → 30s (capped).
 */

import { useEffect, useRef } from "react";
import { env } from "@/lib/env";
import type {
  ConversationUpdatedSsePayload,
  NewMessageSsePayload,
  SseEvent,
  SyncCompleteSsePayload,
} from "../types/inbox.types";

interface InboxSseCallbacks {
  onConnect?:             () => void;
  onError?:               () => void;
  onNewMessage?:          (p: NewMessageSsePayload) => void;
  onConversationUpdated?: (p: ConversationUpdatedSsePayload) => void;
  onSyncComplete?:        (p: SyncCompleteSsePayload) => void;
}

const BACKEND_API_BASE_URL = env.API_URL;

export function useInboxSse(callbacks: InboxSseCallbacks): void {
  const cbRef = useRef(callbacks);
  useEffect(() => { cbRef.current = callbacks; }, [callbacks]);

  useEffect(() => {
    let es:         EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryCount = 0;
    let stopped    = false;

    const connect = () => {
      if (stopped) return;

      es = new EventSource(
        `${BACKEND_API_BASE_URL}/inbox/events`,
        { withCredentials: true },
      );

      es.onopen = () => {
        retryCount = 0; // Reset backoff on successful connection
        cbRef.current.onConnect?.();
      };

      es.onerror = () => {
        cbRef.current.onError?.();
        es?.close();
        es = null;

        if (stopped) return;

        // Exponential backoff: 2s, 4s, 8s, 16s, 30s max
        const delayMs = Math.min(2_000 * 2 ** retryCount, 30_000);
        retryCount    = Math.min(retryCount + 1, 5);

        retryTimer = setTimeout(connect, delayMs);
      };

      es.onmessage = (e: MessageEvent<string>) => {
        try {
          const p: SseEvent = JSON.parse(e.data);

          switch (p.type) {
            case "new_message":
              cbRef.current.onNewMessage?.(p.data as NewMessageSsePayload);
              break;
            case "conversation_updated":
              cbRef.current.onConversationUpdated?.(
                p.data as ConversationUpdatedSsePayload,
              );
              break;
            case "sync_complete":
              cbRef.current.onSyncComplete?.(
                p.data as SyncCompleteSsePayload,
              );
              break;
            default:
              break;
          }
        } catch {
          // Malformed event — ignore, stay connected
        }
      };
    };

    connect();

    return () => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
    };
  }, []);
}
