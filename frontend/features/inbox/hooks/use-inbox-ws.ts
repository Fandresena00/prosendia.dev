"use client";
/**
 * @file features/inbox/hooks/use-inbox-ws.ts
 *
 * WebSocket hook for the inbox — replaces use-inbox-sse.ts.
 *
 * Socket.io's client handles reconnection natively (no hand-rolled backoff
 * loop needed like the old EventSource-based hook): reconnectionDelay /
 * reconnectionDelayMax below reproduce the same 2s → 30s bounds the SSE hook
 * used, just via the library's built-in mechanism.
 *
 * Also exposes requestAiSuggestion(conversationId) — emits
 * 'request_ai_suggestion' and the streamed response chunks are delivered via
 * the onAiSuggestion* callbacks.
 */

import { useEffect, useRef, useCallback } from "react";
import { io, type Socket } from "socket.io-client";
import { env } from "@/lib/env";
import type {
  AiSuggestionChunkPayload,
  AiSuggestionDonePayload,
  AiSuggestionErrorPayload,
  AiTypingSsePayload,
  ConversationUpdatedSsePayload,
  NewMessageSsePayload,
  SyncCompleteSsePayload,
} from "../types/inbox.types";

interface InboxWsCallbacks {
  onConnect?:             () => void;
  onError?:               () => void;
  onNewMessage?:          (p: NewMessageSsePayload) => void;
  onConversationUpdated?: (p: ConversationUpdatedSsePayload) => void;
  onSyncComplete?:        (p: SyncCompleteSsePayload) => void;
  onAiTypingStart?:       (p: AiTypingSsePayload) => void;
  onAiTypingStop?:        (p: AiTypingSsePayload) => void;
  onAiSuggestionChunk?:   (p: AiSuggestionChunkPayload) => void;
  onAiSuggestionDone?:    (p: AiSuggestionDonePayload) => void;
  onAiSuggestionError?:   (p: AiSuggestionErrorPayload) => void;
}

interface InboxWsControls {
  /** Ask the AI to draft a reply suggestion for this conversation. Streamed back via onAiSuggestion*. */
  requestAiSuggestion: (conversationId: string) => void;
}

const BACKEND_API_BASE_URL = env.API_URL;

export function useInboxWs(callbacks: InboxWsCallbacks): InboxWsControls {
  const cbRef = useRef(callbacks);
  useEffect(() => { cbRef.current = callbacks; }, [callbacks]);

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(`${BACKEND_API_BASE_URL}/inbox`, {
      withCredentials:      true,
      transports:            ["websocket"],
      reconnection:           true,
      reconnectionDelay:      2_000,
      reconnectionDelayMax:   30_000,
    });
    socketRef.current = socket;

    socket.on("connect", () => cbRef.current.onConnect?.());
    socket.on("connect_error", () => cbRef.current.onError?.());
    socket.on("disconnect", (reason) => {
      // "io server disconnect" / transport-level drops — socket.io reconnects
      // automatically for everything except an explicit client-side close.
      if (reason !== "io client disconnect") cbRef.current.onError?.();
    });

    socket.on("new_message", (p: NewMessageSsePayload) => cbRef.current.onNewMessage?.(p));
    socket.on("conversation_updated", (p: ConversationUpdatedSsePayload) => cbRef.current.onConversationUpdated?.(p));
    socket.on("sync_complete", (p: SyncCompleteSsePayload) => cbRef.current.onSyncComplete?.(p));
    socket.on("ai_typing_start", (p: AiTypingSsePayload) => cbRef.current.onAiTypingStart?.(p));
    socket.on("ai_typing_stop", (p: AiTypingSsePayload) => cbRef.current.onAiTypingStop?.(p));
    socket.on("ai_suggestion_chunk", (p: AiSuggestionChunkPayload) => cbRef.current.onAiSuggestionChunk?.(p));
    socket.on("ai_suggestion_done", (p: AiSuggestionDonePayload) => cbRef.current.onAiSuggestionDone?.(p));
    socket.on("ai_suggestion_error", (p: AiSuggestionErrorPayload) => cbRef.current.onAiSuggestionError?.(p));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const requestAiSuggestion = useCallback((conversationId: string) => {
    socketRef.current?.emit("request_ai_suggestion", { conversationId });
  }, []);

  return { requestAiSuggestion };
}
