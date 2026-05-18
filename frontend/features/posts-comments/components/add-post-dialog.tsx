"use client";
/**
 * @file features/posts-comments/components/add-post-dialog.tsx
 * Dialog to add a post from the live Facebook feed.
 * Fetches real feed from the backend — no mock data.
 */

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  IconBrandFacebook,
  IconCheck,
  IconMessage,
  IconSearch,
  IconThumbUp,
} from "@tabler/icons-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import Image from "next/image";
import { useState } from "react";
import type { FacebookPage, FbFeedPost } from "../types/posts-comments.types";

interface AddPostDialogProps {
  open: boolean;
  feedPosts: FbFeedPost[];
  feedLoading: boolean;
  adding: boolean;
  activePage: FacebookPage | null;
  onClose: () => void;
  onAdd: (post: FbFeedPost) => void;
}

export function AddPostDialog({
  open,
  feedPosts,
  feedLoading,
  adding,
  activePage,
  onClose,
  onAdd,
}: AddPostDialogProps) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<FbFeedPost | null>(null);

  const filtered = feedPosts.filter((p) => {
    if (!search.trim()) return true;
    return (p.message ?? "").toLowerCase().includes(search.toLowerCase());
  });

  const handleClose = () => {
    setSearch("");
    setSelected(null);
    onClose();
  };

  const handleAdd = () => {
    if (!selected || selected.alreadyAdded) return;
    onAdd(selected);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent
        className="max-w-lg"
        style={{ maxHeight: "88vh", display: "flex", flexDirection: "column" }}
      >
        {/* Header */}
        <AlertDialogHeader className="shrink-0">
          <AlertDialogTitle className="flex items-center gap-2 text-sm font-semibold">
            <div className="h-7 w-7 rounded-full bg-[#1877F2]/10 flex items-center justify-center">
              <IconBrandFacebook className="h-4 w-4 text-[#1877F2]" />
            </div>
            Ajouter un post à gérer
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs">
            {activePage
              ? `Posts récents de "${activePage.name}". Sélectionnez un post pour activer la gestion IA des commentaires.`
              : "Chargement…"}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Body */}
        <div className="flex flex-col gap-3 flex-1 min-h-0 overflow-hidden">
          {/* Search */}
          <div className="relative shrink-0">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher dans les posts…"
              className="pl-9 h-9 text-sm"
            />
          </div>

          {/* Feed list */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-2 pr-2">
              {feedLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))
              ) : filtered.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">
                  {feedPosts.length === 0
                    ? "Aucun post trouvé sur cette page Facebook."
                    : "Aucun résultat pour cette recherche."}
                </p>
              ) : (
                filtered.map((post) => {
                  const isActive = selected?.externalId === post.externalId;
                  return (
                    <button
                      key={post.externalId}
                      disabled={post.alreadyAdded}
                      onClick={() => !post.alreadyAdded && setSelected(post)}
                      className={`w-full text-left rounded-xl border p-3 transition-all ${
                        post.alreadyAdded
                          ? "border-border/30 bg-secondary/20 opacity-60 cursor-not-allowed"
                          : isActive
                            ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                            : "border-border/50 hover:border-border bg-card cursor-pointer"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        {/* Thumbnail */}
                        {post.imageUrl && (
                          <div className="shrink-0 h-12 w-12 rounded-lg overflow-hidden bg-secondary/40">
                            <Image
                              src={post.imageUrl}
                              alt=""
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                (
                                  e.currentTarget as HTMLImageElement
                                ).style.display = "none";
                              }}
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium line-clamp-2 leading-snug">
                            {post.message ?? (
                              <span className="italic text-muted-foreground">
                                Pas de légende
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {formatDistanceToNow(new Date(post.publishedAt), {
                              addSuffix: true,
                              locale: fr,
                            })}
                          </p>
                        </div>
                        {/* State indicator */}
                        {post.alreadyAdded ? (
                          <Badge
                            variant="secondary"
                            className="text-[9px] h-4 px-1.5 shrink-0 bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                          >
                            Ajouté
                          </Badge>
                        ) : isActive ? (
                          <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                            <IconCheck className="h-3 w-3 text-primary-foreground" />
                          </div>
                        ) : null}
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <IconThumbUp className="h-3 w-3" />
                          {post.reactionsCount}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <IconMessage className="h-3 w-3" />
                          {post.commentsCount}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>

          {/* Actions */}
          <div className="flex gap-2 shrink-0">
            <AlertDialogCancel className="flex-1 h-9 text-sm">
              Annuler
            </AlertDialogCancel>
            <Button
              className="flex-1 h-9 text-sm gap-2"
              disabled={!selected || selected.alreadyAdded || adding}
              onClick={handleAdd}
            >
              {adding ? (
                <>
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-transparent border-t-current animate-spin" />
                  Ajout…
                </>
              ) : (
                "Ajouter le post"
              )}
            </Button>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
