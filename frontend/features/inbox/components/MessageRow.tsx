"use client";

/**
 * @file features/inbox/components/MessageRow.tsx
 *
 * Renders a single message bubble with the correct media player based on kind:
 *   text   → text bubble
 *   photos → photo grid
 *   video  → HTML5 <video> player
 *   audio  → HTML5 <audio> player (voice messages)
 *   file   → downloadable file chip
 *
 * CHANGES:
 *   - Added VideoPlayer component for video attachments.
 *   - Added AudioPlayer component for voice messages.
 *   - Image/photo display unchanged (PhotoGrid).
 *   - All media players styled to match Facebook Messenger's visual language.
 */

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { IconAlertCircle, IconCheck, IconChecks } from "@tabler/icons-react";
import { Bot, Download, ExternalLink, User } from "lucide-react";
import { useRef, useState } from "react";
import type { Msg } from "../types/inbox.types";
import { getBubbleRadius } from "../utils/inbox.utils";
import { FileBubble } from "./FileBubble";
import { PhotoGrid } from "./PhotoGrid";

interface MessageRowProps {
  msg:             Msg;
  prevMsg?:        Msg;
  nextMsg?:        Msg;
  clientInitials:  string;
  clientAvatarUrl?: string | null;
  /** True for messages that just arrived in realtime — plays a one-shot entrance animation. History does not animate. */
  isNew?:          boolean;
}

function formatInboxText(text: string): string {
  if (!text) return "";

  let formatted = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();

  // If bullet markers are sent on one line (" - item"), split them visually.
  // This mirrors Facebook-like message wrapping for list answers from AI.
  formatted = formatted.replace(/\s-\s+/g, "\n- ");

  // Keep spacing clean while preserving paragraph breaks.
  formatted = formatted.replace(/\n{3,}/g, "\n\n");

  return formatted;
}

function parseCommentReplyNotice(text: string): { url: string } | null {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized.startsWith("Vous répondez au commentaire")) return null;

  const match = normalized.match(/Voir le commentaire\((https?:\/\/[^)]+)\)/);
  if (!match?.[1]) return null;

  return { url: match[1] };
}

export function MessageRow({
  msg,
  prevMsg,
  nextMsg,
  clientInitials,
  clientAvatarUrl,
  isNew = false,
}: MessageRowProps) {
  const isClient = msg.sender === "client";
  const isAI     = msg.sender === "ai";
  const prevSame = prevMsg?.sender === msg.sender;
  const nextSame = nextMsg?.sender === msg.sender;
  const commentReplyNotice =
    msg.kind === "text" ? parseCommentReplyNotice(msg.content ?? "") : null;

  if (commentReplyNotice) {
    return <CommentReplyNotice url={commentReplyNotice.url} time={msg.time} />;
  }

  // No bubble radius for media messages — they have their own shape
  const br =
    msg.kind === "photos" || msg.kind === "video" || msg.kind === "audio"
      ? ""
      : getBubbleRadius(isClient, prevSame, nextSame);

  return (
    <div
      className={`flex items-end gap-2 ${
        isClient ? "justify-start" : "justify-end"
      } ${prevSame ? "mt-0.5" : "mt-3"} ${
        isNew ? "animate-in fade-in slide-in-from-bottom-2 duration-300" : ""
      }`}
    >
      {/* Client avatar */}
      {isClient && !prevSame ? (
        <Avatar className="h-8 w-8 mb-1 shrink-0">
          <AvatarImage src={clientAvatarUrl ?? undefined} alt="Client" />
          <AvatarFallback className="text-xs font-bold">{clientInitials}</AvatarFallback>
        </Avatar>
      ) : isClient ? (
        <div className="w-8 shrink-0" />
      ) : null}

      <div className={`flex flex-col ${isClient ? "items-start" : "items-end"} max-w-[75%]`}>
        {/* Sender label (first in run only) */}
        {!prevSame && !isClient && (
          <p className="text-[11px] text-muted-foreground mb-1 px-1 flex items-center gap-1">
            {isAI ? (
              <><Bot className="h-3 w-3" /> prosendia</>
            ) : (
              <><User className="h-3 w-3" /> Vous</>
            )}
          </p>
        )}

        {/* ── Text bubble ───────────────────────────────────────────────── */}
        {msg.kind === "text" && (
          <div
            className={`px-4 py-2.5 text-[14.5px] leading-relaxed ${br} ${
              msg.failed
                ? "bg-destructive/10 text-destructive border border-destructive/20"
                : isClient
                  ? "bg-[#F0F2F5] dark:bg-[#3A3B3C] text-foreground"
                  : isAI
                    ? "bg-primary text-primary-foreground"
                    : "bg-[#0084FF] text-white"
            } ${msg.pending ? "opacity-60" : ""}`}
          >
            <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
              {formatInboxText(msg.content ?? "")}
            </p>
          </div>
        )}

        {/* ── Photos ────────────────────────────────────────────────────── */}
        {msg.kind === "photos" && msg.photos && (
          <div className={msg.pending ? "opacity-60" : ""}>
            <PhotoGrid photos={msg.photos} />
          </div>
        )}

        {/* ── Video player ──────────────────────────────────────────────── */}
        {msg.kind === "video" && msg.video && (
          <div className={msg.pending ? "opacity-60" : ""}>
            <VideoPlayer
              url={msg.video.url}
              thumbnailUrl={msg.video.thumbnailUrl}
              isClient={isClient}
            />
          </div>
        )}

        {/* ── Audio / voice message player ──────────────────────────────── */}
        {msg.kind === "audio" && msg.audio && (
          <div className={msg.pending ? "opacity-60" : ""}>
            <AudioPlayer url={msg.audio.url} isClient={isClient} />
          </div>
        )}

        {/* ── File chip ─────────────────────────────────────────────────── */}
        {msg.kind === "file" && msg.file && (
          <div className={msg.pending ? "opacity-60" : ""}>
            <FileBubble file={msg.file} isClient={isClient} />
          </div>
        )}

        {/* Reactions */}
        {msg.reactions && msg.reactions.length > 0 && (
          <div className={`flex gap-0.5 -mt-1 ${isClient ? "ml-2" : "mr-2"}`}>
            <div className="flex items-center gap-0.5 bg-card border border-border/50 rounded-full px-1.5 py-0.5 shadow-sm">
              {msg.reactions.map((r, i) => (
                <span key={i} className="text-xs">{r}</span>
              ))}
            </div>
          </div>
        )}

        {/* Timestamp + delivery status */}
        {!nextSame && (
          <div className={`flex items-center gap-1 mt-1 px-0.5 ${isClient ? "" : "flex-row-reverse"}`}>
            <span className="text-[11px] text-muted-foreground">{msg.time}</span>
            {msg.failed && <IconAlertCircle className="h-3 w-3 text-destructive" />}
            {!isClient && !msg.failed && (
              msg.pending
                ? <IconCheck className="h-3 w-3 text-muted-foreground" />
                : <IconChecks className="h-3.5 w-3.5 text-primary" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CommentReplyNotice({ url, time }: { url: string; time: string }) {
  return (
    <div className="my-4 flex w-full justify-center px-3">
      <div className="flex max-w-[min(92vw,460px)] flex-col items-center gap-1 text-center">
        <div className="rounded-full bg-[#F0F2F5] px-3.5 py-1.5 text-[12px] font-medium leading-snug text-[#65676B] dark:bg-[#3A3B3C] dark:text-[#B0B3B8]">
          Vous avez répondu au commentaire d’un utilisateur sur une publication.
        </div>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold text-[#1877F2] hover:bg-[#1877F2]/10"
        >
          Voir le commentaire
          <ExternalLink className="h-3 w-3" />
        </a>
        <span className="text-[11px] text-muted-foreground">{time}</span>
      </div>
    </div>
  );
}

// ─── VideoPlayer ──────────────────────────────────────────────────────────────

/**
 * Facebook-style inline video player.
 * Shows a poster/thumbnail if available, plays inline on click.
 * Max width matches Facebook Messenger's video bubble (280px).
 */
function VideoPlayer({
  url,
  thumbnailUrl,
  isClient,
}: {
  url:           string;
  thumbnailUrl?: string;
  isClient:      boolean;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleClick = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  return (
    <div
      className="relative rounded-2xl overflow-hidden cursor-pointer bg-black"
      style={{ width: 280, maxWidth: "100%" }}
      onClick={handleClick}
    >
      <video
        ref={videoRef}
        src={url}
        poster={thumbnailUrl}
        controls
        preload="metadata"
        className="w-full max-h-[200px] object-contain"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        // Prevent double-firing from the wrapper onClick
        onClick={(e) => e.stopPropagation()}
      />
      {/* Download button — top right */}
      <a
        href={url}
        download
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
        title="Télécharger la vidéo"
      >
        <Download className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

// ─── AudioPlayer ──────────────────────────────────────────────────────────────

/**
 * Facebook-style voice message player.
 * Uses the native <audio> controls styled to match the inbox palette.
 * Width: 220–280px, matching Facebook Messenger's audio bubble.
 */
function AudioPlayer({
  url,
  isClient,
}: {
  url:      string;
  isClient: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-2xl px-3 py-2.5 ${
        isClient
          ? "bg-[#F0F2F5] dark:bg-[#3A3B3C]"
          : "bg-[#0084FF]"
      }`}
      style={{ minWidth: 220, maxWidth: 280 }}
    >
      {/* Microphone icon */}
      <div
        className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
          isClient ? "bg-white/60 dark:bg-black/20" : "bg-white/20"
        }`}
      >
        <svg
          className={`h-4 w-4 ${isClient ? "text-foreground" : "text-white"}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
        </svg>
      </div>

      {/* Native audio controls */}
      <audio
        src={url}
        controls
        preload="metadata"
        className="flex-1 h-8"
        style={{
          // Minimal styling — browsers render the native control differently
          // but it's accessible and works universally
          accentColor: isClient ? "var(--primary)" : "white",
        }}
      />

      {/* Download button */}
      <a
        href={url}
        download
        target="_blank"
        rel="noreferrer"
        className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${
          isClient
            ? "text-muted-foreground hover:text-foreground hover:bg-black/5"
            : "text-white/70 hover:text-white hover:bg-white/10"
        }`}
        title="Télécharger l'audio"
      >
        <Download className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
