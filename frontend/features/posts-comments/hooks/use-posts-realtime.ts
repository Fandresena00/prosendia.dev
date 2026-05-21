"use client";
/**
 * @file features/posts-comments/hooks/use-posts-realtime.ts
 *
 * Dedicated SSE hook for real-time post/comment events.
 * Completely separate from the inbox real-time system.
 *
 * EVENTS HANDLED
 * ──────────────
 *   comment:new      → insert the new comment into the current list
 *   comment:replied  → update the matching comment with its reply
 *   post:updated     → update post metadata (commentsCount, etc.)
 *   sync:completed   → scheduler finished; trigger a full comment reload
 *
 * CONNECTION STRATEGY
 * ───────────────────
 *   1. Opens EventSource when businessProfileId is provided.
 *   2. Retries automatically (browser native EventSource retry logic).
 *   3. Closes cleanly on unmount or when businessProfileId changes.
 *   4. `withCredentials: true` — sends HttpOnly cookie for JWT auth.
 *
 * USAGE
 * ─────
 *   const { connected } = usePostsRealtime(businessProfileId, {
 *     onCommentAdded:  (comment) => { ... },
 *     onCommentReplied: (postId, commentId, reply) => { ... },
 *     onPostUpdated:   (postId, updates) => { ... },
 *     onSyncCompleted: () => { ... },
 *   });
 */

import { useEffect, useRef, useState } from "react";
import type { ApiComment } from "../types/posts-comments.types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReplyData {
  content: string;
  repliedByAi: boolean;
}

export interface PostsRealtimeHandlers {
  onCommentAdded?: (comment: ApiComment) => void;
  onCommentReplied?: (
    postId: string,
    commentId: string,
    reply: ReplyData,
  ) => void;
  onPostUpdated?: (postId: string, updates: Record<string, unknown>) => void;
  onSyncCompleted?: () => void;
}

export interface PostsRealtimeState {
  connected: boolean;
  error: string | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePostsRealtime(
  businessProfileId: string | undefined | null,
  handlers: PostsRealtimeHandlers,
): PostsRealtimeState {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep handlers in a ref so the effect doesn't need to re-run on each render
  const handlersRef = useRef(handlers);
  // eslint-disable-next-line react-hooks/refs
  handlersRef.current = handlers;

  useEffect(() => {
    if (!businessProfileId) {
      setConnected(false);
      return;
    }

    // Build the SSE URL — must use the API base URL directly because
    // EventSource doesn't support custom headers (JWT via cookie instead)
    const apiBase =
      process.env.NEXT_PUBLIC_API_URL ??
      (typeof window !== "undefined" ? "" : "");

    const url = `${apiBase}/facebook/posts/events`;

    const es = new EventSource(url, { withCredentials: true });

    es.onopen = () => {
      setConnected(true);
      setError(null);
    };

    es.onmessage = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as {
          type: string;
          postId?: string;
          data: Record<string, unknown>;
        };

        switch (payload.type) {
          case "comment:new":
            handlersRef.current.onCommentAdded?.(
              payload.data.comment as ApiComment,
            );
            break;

          case "comment:replied":
            if (payload.postId) {
              handlersRef.current.onCommentReplied?.(
                payload.postId,
                payload.data.commentId as string,
                payload.data.reply as ReplyData,
              );
            }
            break;

          case "post:updated":
            if (payload.postId) {
              handlersRef.current.onPostUpdated?.(payload.postId, payload.data);
            }
            break;

          case "sync:completed":
            handlersRef.current.onSyncCompleted?.();
            break;

          default:
            break;
        }
      } catch {
        // Malformed event — ignore and continue
      }
    };

    es.onerror = () => {
      setConnected(false);
      setError("Connexion temps réel interrompue. Reconnexion automatique…");
      // EventSource retries automatically — no manual action needed
    };

    return () => {
      es.close();
      setConnected(false);
    };
  }, [businessProfileId]);

  return { connected, error };
}
