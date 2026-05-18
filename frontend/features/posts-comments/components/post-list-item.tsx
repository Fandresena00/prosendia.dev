"use client";
/**
 * @file features/posts-comments/components/post-list-item.tsx
 */

import { IconMessage, IconPhotoFilled, IconThumbUp } from "@tabler/icons-react";
import { Bot } from "lucide-react";
import { PHOTO_GRADIENTS } from "../data/posts-comments.data";
import type { Post } from "../types/posts-comments.types";

interface PostListItemProps {
  post:     Post;
  active:   boolean;
  onSelect: () => void;
}

export function PostListItem({ post, active, onSelect }: PostListItemProps) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-xl border px-4 py-3 transition-all ${
        active
          ? "border-primary/30 bg-primary/5 ring-1 ring-primary/20"
          : "border-border/40 bg-card/60 hover:border-border hover:bg-card/80"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Thumbnail */}
        <div
          className="h-10 w-10 rounded-lg shrink-0 flex items-center justify-center"
          style={{
            background: post.photos.length
              ? PHOTO_GRADIENTS[0]
              : "oklch(0.94 0.01 286 / 60%)",
          }}
        >
          {post.photos.length ? (
            <IconPhotoFilled className="h-4 w-4 opacity-40 text-white" />
          ) : (
            <IconMessage className="h-4 w-4 text-muted-foreground/40" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold leading-snug truncate pr-2">
            {post.name}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
            {post.body}
          </p>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <IconThumbUp className="h-3 w-3" />
              {post.likes}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <IconMessage className="h-3 w-3" />
              {post.comments}
            </span>
            <span className="text-[10px] text-muted-foreground">{post.date}</span>
          </div>
        </div>

        {/* AI indicator */}
        <div
          className={`shrink-0 mt-0.5 flex h-5 w-5 items-center justify-center rounded-full ${
            post.autoReply ? "bg-emerald-500/15" : "bg-secondary/60"
          }`}
        >
          <Bot
            className={`h-3 w-3 ${
              post.autoReply ? "text-emerald-600" : "text-muted-foreground/40"
            }`}
          />
        </div>
      </div>
    </button>
  );
}
