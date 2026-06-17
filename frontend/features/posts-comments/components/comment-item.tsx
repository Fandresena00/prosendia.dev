"use client";
/**
 * @file features/posts-comments/components/comment-item.tsx
 *
 * Single comment with:
 *   - AI typing indicator (spinner) when AI reply is in progress
 *   - Correct Facebook profile link (profile.php?id= for numeric IDs)
 *   - authorProfileUrl from API when available, fallback computed client-side
 *   - Reply mode toggle (public / private DM)
 */

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  IconAlertTriangle,
  IconBrandFacebook,
  IconCheck,
  IconMessageForward,
  IconRobot,
  IconSend,
  IconUser,
} from "@tabler/icons-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import type { ApiComment, ApiCommentReply } from "../types/posts-comments.types";

function buildProfileUrl(authorId: string | null, authorProfileUrl?: string | null): string | undefined {
  if (authorProfileUrl) return authorProfileUrl;
  if (!authorId || authorId === "unknown") return undefined;
  return `https://www.facebook.com/profile.php?id=${authorId}`;
}

interface CommentItemProps {
  comment:        ApiComment;
  pageName?:      string | null;
  isReplyingTo:   boolean;
  replyText:      string;
  replyMode:      "public" | "private";
  replySending:   boolean;
  aiTyping?:      boolean; // true while AI is generating a reply for this comment
  onStartReply:   () => void;
  onCancelReply:  () => void;
  onChangeText:   (text: string) => void;
  onChangeMode:   (mode: "public" | "private") => void;
  onSubmitReply:  () => void;
  onAiReply:      () => void;
}

export function CommentItem({
  comment,
  pageName,
  isReplyingTo,
  replyText,
  replyMode,
  replySending,
  aiTyping = false,
  onStartReply,
  onCancelReply,
  onChangeText,
  onChangeMode,
  onSubmitReply,
  onAiReply,
}: CommentItemProps) {
  const timeAgo = formatDistanceToNow(new Date(comment.commentedAt), {
    addSuffix: true,
    locale: fr,
  });

  // Build the correct Facebook profile URL
  const profileUrl = buildProfileUrl(
    comment.authorId,
    comment.authorProfileUrl,
  );

  const replies: ApiCommentReply[] =
    comment.replies?.length
      ? comment.replies
      : comment.replyContent
        ? [
            {
              id:              `stored-${comment.id}`,
              externalId:      `stored-${comment.externalId}`,
              authorId:        "page",
              authorName:      pageName?.trim() || "Votre page",
              authorAvatarUrl: null,
              message:         comment.replyContent,
              commentedAt:     comment.repliedAt ?? new Date().toISOString(),
              isPageReply:     true,
              repliedByAi:     comment.repliedByAi,
            },
          ]
        : [];

  return (
    <div className="group">
      <div className="flex gap-2.5">
        {/* Avatar */}
        <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5 border border-border/30">
          <IconUser className="h-4 w-4 text-muted-foreground/50" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Bubble */}
          <div className="inline-block max-w-full">
            <div
              className={`rounded-2xl rounded-tl-sm px-3.5 py-2.5 ${
                comment.repliedByAi
                  ? "bg-emerald-500/8 border border-emerald-500/15"
                  : "bg-secondary/60 border border-border/30"
              }`}
            >
              {/* Author link — uses real Facebook profile URL */}
              <a
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`text-[11px] font-semibold text-foreground flex items-center gap-1 ${
                  profileUrl ? "hover:underline" : "cursor-default"
                }`}
                onClick={profileUrl ? undefined : (e) => e.preventDefault()}
              >
                {comment.authorName}
                <IconBrandFacebook className="h-2.5 w-2.5 text-[#1877F2] shrink-0" />
              </a>
              <p className="text-[13px] text-foreground leading-snug mt-0.5">
                {comment.message}
              </p>
            </div>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-3 mt-1 px-1">
            <span className="text-[10px] text-muted-foreground">{timeAgo}</span>

            {comment.isReplied && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                <IconCheck className="h-3 w-3" />
                {comment.repliedByAi ? "Répondu par IA" : "Répondu"}
              </span>
            )}

            {/* AI typing indicator */}
            {aiTyping && !comment.isReplied && (
              <span className="flex items-center gap-1 text-[10px] text-violet-500 font-medium animate-pulse">
                <Loader2 className="h-3 w-3 animate-spin" />
                IA en train de répondre…
              </span>
            )}

            {/* NEW: AI deliberately skipped this comment (e.g. looks like spam).
                Without this, users can't tell "not processed yet" from
                "AI looked and chose not to reply" — the feature looked broken. */}
            {!aiTyping && !comment.isReplied && comment.aiSkipped && (
              <span
                className="flex items-center gap-1 text-[10px] text-amber-600 font-medium"
                title={
                  typeof comment.aiSpamScore === "number"
                    ? `Score de pertinence: ${comment.aiSpamScore}/100`
                    : undefined
                }
              >
                <IconAlertTriangle className="h-3 w-3" />
                IA : pas de réponse (ressemble à du spam)
              </span>
            )}

            {!aiTyping && (
              <button
                onClick={onStartReply}
                className="text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors"
              >
                {comment.isReplied ? "Répondre à nouveau" : "Répondre"}
              </button>
            )}

            {!comment.isReplied && !aiTyping && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onAiReply}
                    className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[10px] text-muted-foreground hover:text-violet-600"
                  >
                    <IconRobot className="h-3 w-3" />
                    {comment.aiSkipped ? "Forcer l'IA" : "IA"}
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-xs">
                  {comment.aiSkipped
                    ? "Forcer une réponse IA malgré le filtre anti-spam"
                    : "Déclencher une réponse IA"}
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Replies */}
          {replies.length > 0 && (
            <div className="mt-2 ml-4 space-y-2 border-l border-border/60 pl-3">
              {replies.map((reply) => (
                <CommentReplyItem key={reply.id} reply={reply} />
              ))}
            </div>
          )}

          {/* Reply input */}
          {isReplyingTo && (
            <div className="mt-2.5 ml-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <ModeBtn
                  active={replyMode === "public"}
                  onClick={() => onChangeMode("public")}
                  icon={<IconMessageBubble className="h-2.5 w-2.5" />}
                  label="Réponse publique"
                  activeClass="bg-primary/10 border-primary/30 text-primary"
                />
                <ModeBtn
                  active={replyMode === "private"}
                  onClick={() => onChangeMode("private")}
                  icon={<IconMessageForward className="h-2.5 w-2.5" />}
                  label="Message privé"
                  activeClass="bg-[#1877F2]/10 border-[#1877F2]/30 text-[#1877F2]"
                />
              </div>

              {replyMode === "private" && (
                <p className="text-[10px] text-muted-foreground bg-[#1877F2]/5 border border-[#1877F2]/15 rounded-lg px-2.5 py-1.5">
                  Sera envoyé en message privé via Messenger.
                </p>
              )}

              <div className="flex gap-2">
                <Textarea
                  value={replyText}
                  onChange={(e) => onChangeText(e.target.value)}
                  placeholder={replyMode === "private" ? "Message privé…" : "Répondre publiquement…"}
                  rows={2}
                  className="text-xs resize-none bg-secondary/20 flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSubmitReply(); }
                  }}
                />
                <div className="flex flex-col gap-1.5">
                  <Button
                    size="icon" className="h-8 w-8"
                    disabled={!replyText.trim() || replySending}
                    onClick={onSubmitReply}
                  >
                    {replySending
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <IconSend className="h-3.5 w-3.5" />
                    }
                  </Button>
                  <Button
                    size="icon" variant="ghost"
                    className="h-8 w-8 text-muted-foreground"
                    onClick={onCancelReply}
                  >
                    ✕
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Reply item ────────────────────────────────────────────────────────────────

function CommentReplyItem({ reply }: { reply: ApiCommentReply }) {
  const timeAgo = formatDistanceToNow(new Date(reply.commentedAt), {
    addSuffix: true, locale: fr,
  });
  const profileUrl = buildProfileUrl(reply.authorId);

  return (
    <div className="flex gap-2 group/reply">
      <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 border ${
        reply.isPageReply ? "bg-primary/10 border-primary/20" : "bg-secondary border-border/30"
      }`}>
        {reply.repliedByAi
          ? <IconRobot className="h-3.5 w-3.5 text-primary" />
          : <IconUser  className="h-3.5 w-3.5 text-muted-foreground/60" />
        }
      </div>

      <div className="min-w-0 flex-1">
        <div className={`inline-block max-w-full rounded-2xl rounded-tl-sm px-3 py-2 ${
          reply.isPageReply
            ? "bg-primary/6 border border-primary/15"
            : "bg-secondary/45 border border-border/25"
        }`}>
          <a
            href={profileUrl}
            target="_blank" rel="noopener noreferrer"
            className={`text-[11px] font-semibold flex items-center gap-1 ${
              reply.isPageReply ? "text-primary" : "text-foreground"
            } ${profileUrl ? "hover:underline" : "cursor-default"}`}
            onClick={profileUrl ? undefined : (e) => e.preventDefault()}
          >
            {reply.repliedByAi && <IconRobot className="h-3 w-3" />}
            {reply.authorName}
            <IconBrandFacebook className="h-2.5 w-2.5 text-[#1877F2] shrink-0" />
          </a>
          <p className="text-[12px] text-foreground leading-snug mt-0.5">{reply.message}</p>
        </div>
        <div className="mt-1 px-1 text-[10px] text-muted-foreground">{timeAgo}</div>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function ModeBtn({
  active, onClick, icon, label, activeClass,
}: {
  active:      boolean;
  onClick:     () => void;
  icon:        React.ReactNode;
  label:       string;
  activeClass: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border transition-all ${
        active
          ? `${activeClass} font-semibold`
          : "border-border/40 text-muted-foreground hover:border-border"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function IconMessageBubble({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
