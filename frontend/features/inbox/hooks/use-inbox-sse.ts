"use client";
/**
 * @file features/inbox/hooks/use-inbox-sse.ts
 * CHANGES: Added onConnect/onError for SSE status. URL uses NEXT_PUBLIC_API_URL.
 */
import { useEffect, useRef } from "react";
import type {
  ConversationUpdatedSsePayload, NewMessageSsePayload,
  SseEvent, SyncCompleteSsePayload,
} from "../types/inbox.types";

interface InboxSseCallbacks {
  onConnect?:             () => void;
  onError?:               () => void;
  onNewMessage?:          (p: NewMessageSsePayload) => void;
  onConversationUpdated?: (p: ConversationUpdatedSsePayload) => void;
  onSyncComplete?:        (p: SyncCompleteSsePayload) => void;
}

const BACKEND_API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api";

export function useInboxSse(callbacks: InboxSseCallbacks): void {
  const cbRef = useRef(callbacks);
  useEffect(() => { cbRef.current = callbacks; }, [callbacks]);

  useEffect(() => {
    const source = new EventSource(`${BACKEND_API_BASE_URL}/inbox/events`, { withCredentials: true });
    source.onopen    = () => cbRef.current.onConnect?.();
    source.onerror   = () => cbRef.current.onError?.();
    source.onmessage = (e: MessageEvent<string>) => {
      try {
        const p: SseEvent = JSON.parse(e.data);
        if (p.type === "new_message")          cbRef.current.onNewMessage?.(p.data as NewMessageSsePayload);
        else if (p.type === "conversation_updated") cbRef.current.onConversationUpdated?.(p.data as ConversationUpdatedSsePayload);
        else if (p.type === "sync_complete")   cbRef.current.onSyncComplete?.(p.data as SyncCompleteSsePayload);
      } catch { /* ignore */ }
    };
    return () => source.close();
  }, []);
}
