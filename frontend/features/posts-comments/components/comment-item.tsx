"use client";
/**
 * @file features/posts-comments/components/comment-item.tsx
 * Single comment with Facebook-style bubble, reply actions, AI trigger.
 */

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  IconBrandFacebook,
  IconCheck,
  IconMessageForward,
  IconRobot,
  IconSend,
  IconUser,
} from "@tabler/icons-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import type { ApiComment } from "../types/posts-comments.types";

// Inline MessageBubble icon (avoids importing from tabler which has naming conflicts)
function IconMessageBubble({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

interface CommentItemProps {
  comment: ApiComment;
  isReplyingTo: boolean;
  replyText: string;
  replyMode: "public" | "private";
  replySending: boolean;
  onStartReply: () => void;
  onCancelReply: () => void;
  onChangeText: (text: string) => void;
  onChangeMode: (mode: "public" | "private") => void;
  onSubmitReply: () => void;
  onAiReply: () => void;
}

export function CommentItem({
  comment,
  isReplyingTo,
  replyText,
  replyMode,
  replySending,
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
              <a
                href={`https://www.facebook.com/${comment.authorId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-semibold text-foreground hover:underline flex items-center gap-1"
              >
                {comment.authorName}
                <IconBrandFacebook className="h-2.5 w-2.5 text-[#1877F2] shrink-0" />
              </a>
              <p className="text-[13px] text-foreground leading-snug mt-0.5">
                {comment.message}
              </p>
            </div>
          </div>

          {/* Meta */}
          <div className="flex items-center gap-3 mt-1 px-1">
            <span className="text-[10px] text-muted-foreground">{timeAgo}</span>

            {comment.isReplied ? (
              <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                <IconCheck className="h-3 w-3" />
                {comment.repliedByAi ? "Répondu par IA" : "Répondu"}
              </span>
            ) : (
              <button
                onClick={onStartReply}
                className="text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors"
              >
                Répondre
              </button>
            )}

            {!comment.isReplied && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onAiReply}
                    className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[10px] text-muted-foreground hover:text-emerald-600"
                  >
                    <IconRobot className="h-3 w-3" />
                    IA
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-xs">
                  Déclencher une réponse IA
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Previous reply */}
          {comment.isReplied && comment.replyContent && (
            <div className="mt-2 ml-3 flex gap-2">
              <div className="w-0.5 bg-border/60 rounded-full shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="rounded-2xl rounded-tl-sm bg-primary/6 border border-primary/15 px-3 py-2">
                  <p className="text-[11px] font-semibold text-primary mb-0.5 flex items-center gap-1">
                    {comment.repliedByAi && <IconRobot className="h-3 w-3" />}
                    Votre page
                  </p>
                  <p className="text-[12px] text-foreground leading-snug">
                    {comment.replyContent}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Reply input */}
          {isReplyingTo && (
            <div className="mt-2.5 ml-3 space-y-2">
              {/* Mode switcher */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onChangeMode("public")}
                  className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border transition-all ${
                    replyMode === "public"
                      ? "bg-primary/10 border-primary/30 text-primary font-semibold"
                      : "border-border/40 text-muted-foreground hover:border-border"
                  }`}
                >
                  <IconMessageBubble className="h-2.5 w-2.5" />
                  Réponse publique
                </button>
                <button
                  onClick={() => onChangeMode("private")}
                  className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border transition-all ${
                    replyMode === "private"
                      ? "bg-[#1877F2]/10 border-[#1877F2]/30 text-[#1877F2] font-semibold"
                      : "border-border/40 text-muted-foreground hover:border-border"
                  }`}
                >
                  <IconMessageForward className="h-2.5 w-2.5" />
                  Message privé
                </button>
              </div>

              {replyMode === "private" && (
                <p className="text-[10px] text-muted-foreground bg-[#1877F2]/5 border border-[#1877F2]/15 rounded-lg px-2.5 py-1.5">
                  Le message sera envoyé en privé via Facebook Messenger.
                </p>
              )}

              <div className="flex gap-2">
                <Textarea
                  value={replyText}
                  onChange={(e) => onChangeText(e.target.value)}
                  placeholder={
                    replyMode === "private"
                      ? "Message privé…"
                      : "Répondre publiquement…"
                  }
                  rows={2}
                  className="text-xs resize-none bg-secondary/20 flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      onSubmitReply();
                    }
                  }}
                />
                <div className="flex flex-col gap-1.5">
                  <Button
                    size="icon"
                    className="h-8 w-8"
                    disabled={!replyText.trim() || replySending}
                    onClick={onSubmitReply}
                  >
                    {replySending ? (
                      <div className="h-3.5 w-3.5 rounded-full border-2 border-transparent border-t-current animate-spin" />
                    ) : (
                      <IconSend className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
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
