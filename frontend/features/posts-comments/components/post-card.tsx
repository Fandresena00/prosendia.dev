"use client";
/**
 * @file features/posts-comments/components/post-card.tsx
 *
 * next/image usage:
 *   - Page avatar  → `width={28} height={28}` (known fixed size)
 *   - Post image   → `fill` + `sizes="48px"` (unknown FB CDN dimensions)
 *   Both use `unoptimized` to avoid requiring fbcdn.net in next.config.js.
 *   Error state handled via local useState in sub-components.
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { IconBrandFacebook, IconMessage, IconThumbUp, IconTrash } from "@tabler/icons-react";
import { Bot } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import Image from "next/image";
import { useState } from "react";
import type { ApiPost, FacebookPage } from "../types/posts-comments.types";

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Page avatar with initials fallback on image error. */
function PageAvatarImg({
  page,
  size,
}: {
  page: FacebookPage;
  size: number;
}) {
  const [error, setError] = useState(false);

  if (!page.avatarUrl || error) {
    return (
      <div
        className={`rounded-full flex items-center justify-center font-bold ${page.color}`}
        style={{ width: size, height: size, fontSize: size * 0.32 }}
      >
        {page.avatar}
      </div>
    );
  }

  return (
    <Image
      src={page.avatarUrl}
      alt={page.name}
      width={size}
      height={size}
      className="rounded-full object-cover border border-border/30"
      unoptimized
      onError={() => setError(true)}
    />
  );
}

/** Post image thumbnail with fill layout. */
function PostImageThumb({ src }: { src: string }) {
  const [error, setError] = useState(false);
  if (error) return null;
  return (
    <Image
      src={src}
      alt=""
      fill
      sizes="48px"
      className="object-cover"
      unoptimized
      onError={() => setError(true)}
    />
  );
}

// ─── PostCard ─────────────────────────────────────────────────────────────────

interface PostCardProps {
  post:     ApiPost;
  page:     FacebookPage;
  active:   boolean;
  deleting: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

export function PostCard({
  post,
  page,
  active,
  deleting,
  onSelect,
  onDelete,
}: PostCardProps) {
  const timeAgo = formatDistanceToNow(new Date(post.publishedAt), {
    addSuffix: true,
    locale: fr,
  });
  const aiEnabled = post.postAiConfig?.autoReply === true;

  return (
    <div
      className={`group relative w-full text-left rounded-xl border px-3.5 py-3 transition-all cursor-pointer ${
        active
          ? "border-primary/30 bg-primary/5 ring-1 ring-primary/20"
          : "border-border/40 bg-card/60 hover:border-border hover:bg-card/80"
      }`}
      onClick={onSelect}
    >
      {/* Header: avatar + name + time + AI dot */}
      <div className="flex items-center gap-2 mb-2">
        <div className="shrink-0">
          <PageAvatarImg page={page} size={28} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold truncate leading-tight">{page.name}</p>
          <p className="text-[9px] text-muted-foreground flex items-center gap-0.5">
            <IconBrandFacebook className="h-2.5 w-2.5 text-[#1877F2]" />
            {timeAgo}
          </p>
        </div>

        <div
          className={`shrink-0 h-5 w-5 rounded-full flex items-center justify-center ${
            aiEnabled ? "bg-emerald-500/15" : "bg-secondary/60"
          }`}
        >
          <Bot
            className={`h-3 w-3 ${aiEnabled ? "text-emerald-600" : "text-muted-foreground/40"}`}
          />
        </div>
      </div>

      {/* Thumbnail + caption */}
      <div className="flex gap-2.5">
        {post.imageUrl && (
          // `relative` is required for `fill` layout
          <div className="relative shrink-0 h-12 w-12 rounded-lg overflow-hidden bg-secondary/40">
            <PostImageThumb src={post.imageUrl} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-medium leading-snug line-clamp-2 text-foreground">
            {post.message ?? (
              <span className="italic text-muted-foreground">Pas de légende</span>
            )}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 mt-2">
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <IconThumbUp className="h-3 w-3" />
          {post.reactionsCount}
        </span>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <IconMessage className="h-3 w-3" />
          {post._count?.comments ?? post.commentsCount}
        </span>
        {post.postAiConfig && (
          <Badge
            variant="secondary"
            className={`text-[9px] h-4 px-1.5 ml-auto ${
              aiEnabled
                ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            {aiEnabled ? "IA activée" : "IA off"}
          </Badge>
        )}
      </div>

      {/* Delete button on hover */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10"
            disabled={deleting}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(e);
            }}
          >
            {deleting ? (
              <div className="h-3 w-3 rounded-full border-2 border-transparent border-t-destructive animate-spin" />
            ) : (
              <IconTrash className="h-3 w-3" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent className="text-xs">Retirer ce post</TooltipContent>
      </Tooltip>
    </div>
  );
}
