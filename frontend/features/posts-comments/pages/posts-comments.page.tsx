"use client";
/**
 * @file features/posts-comments/pages/posts-comments.page.tsx
 *
 * Main page: self-contained via usePostsComments hook.
 * Fetches pages, posts, comments, and config internally.
 *
 * Layout (3 columns):
 *   LEFT  (280px) — page switcher + managed posts list + add/stats buttons
 *   CENTER (flex) — comments list for selected post
 *   RIGHT  (300px) — tabs: Config | Stats
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  IconArmchair,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSettings,
  IconX,
} from "@tabler/icons-react";
import { useState } from "react";
import { AddPostDialog } from "../components/add-post-dialog";
import { CommentItem } from "../components/comment-item";
import { PageSwitcher } from "../components/page-switcher";
import { PostCard } from "../components/post-card";
import { PostConfigPanel } from "../components/post-config-panel";
import { StatsSidebar } from "../components/stats-sidebar";
import { usePostsComments } from "../hooks/use-posts-comments";
import type { ActiveTab } from "../types/posts-comments.types";

export function PostsCommentsPage() {
  const hook = usePostsComments();
  const [rightTab, setRightTab] = useState<ActiveTab>("comments");

  // ── Loading: pages ─────────────────────────────────────────────────────────
  if (hook.pagesLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          <p className="text-sm text-muted-foreground">
            Chargement des pages Facebook…
          </p>
        </div>
      </div>
    );
  }

  // ── Error: no pages ────────────────────────────────────────────────────────
  if (hook.pagesError || hook.pages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2 max-w-xs">
          <p className="text-sm font-semibold text-foreground">
            Aucune page connectée
          </p>
          <p className="text-xs text-muted-foreground">
            {hook.pagesError ??
              "Connectez une page Facebook dans les paramètres pour commencer."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full overflow-hidden">
        {/* ── LEFT PANEL — Posts list ──────────────────────────────────────── */}
        <div className="w-[280px] shrink-0 flex flex-col border-r border-border/40">
          {/* Header */}
          <div className="shrink-0 px-4 pt-4 pb-3 space-y-3">
            <div className="flex items-center justify-between">
              <PageSwitcher
                pages={hook.pages}
                activeKey={hook.activePageKey}
                onSwitch={hook.switchPage}
              />
              <Button
                variant="default"
                size="sm"
                className="h-8 gap-1.5 text-xs px-3"
                onClick={hook.openAddDialog}
                disabled={hook.pagesLoading}
              >
                <IconPlus className="h-3.5 w-3.5" />
                Ajouter
              </Button>
            </div>

            {/* Search */}
            <div className="relative">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={hook.postSearch}
                onChange={(e) => {
                  hook.setPostSearch(e.target.value);
                  void hook.loadPosts();
                }}
                placeholder="Rechercher un post…"
                className="pl-8 h-8 text-xs bg-secondary/20"
              />
            </div>

            {/* Post count + autoReply counter */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">
                {hook.posts.length} post{hook.posts.length !== 1 ? "s" : ""}{" "}
                gérés
              </span>
              <Badge
                variant="secondary"
                className={`text-[9px] h-4 px-1.5 ${
                  hook.autoReplyLimitReached
                    ? "bg-amber-500/10 text-amber-700 border-amber-500/20"
                    : "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                }`}
              >
                IA: {hook.autoReplyCount}/10
              </Badge>
            </div>
          </div>

          <Separator className="bg-border/40" />

          {/* Posts list */}
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-2">
              {hook.postsLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-xl" />
                ))
              ) : hook.posts.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Aucun post ajouté
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={hook.openAddDialog}
                  >
                    <IconPlus className="h-3 w-3" />
                    Ajouter un post
                  </Button>
                </div>
              ) : (
                hook.posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    page={hook.activePage!}
                    active={hook.selectedPostId === post.id}
                    deleting={hook.deletingPostId === post.id}
                    onSelect={() => {
                      hook.setSelectedPostId(post.id);
                      setRightTab("comments");
                    }}
                    onDelete={() => hook.deletePost(post.id)}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* ── CENTER PANEL — Comments ──────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col">
          {hook.selectedPost ? (
            <>
              {/* Comments header */}
              <div className="shrink-0 px-5 py-3 border-b border-border/40 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {hook.selectedPost.message?.slice(0, 60) ??
                      "Post sans légende"}
                    {(hook.selectedPost.message?.length ?? 0) > 60 ? "…" : ""}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {hook.commentTotal} commentaire
                    {hook.commentTotal !== 1 ? "s" : ""}
                  </p>
                </div>

                {/* Filter pills */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {(["all", "pending", "replied"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => hook.setCommentFilter(f)}
                      className={`text-[10px] px-2.5 py-1 rounded-full border transition-all ${
                        hook.commentFilter === f
                          ? "bg-primary/10 border-primary/30 text-primary font-semibold"
                          : "border-border/40 text-muted-foreground hover:border-border"
                      }`}
                    >
                      {f === "all"
                        ? "Tous"
                        : f === "pending"
                          ? "En attente"
                          : "Répondus"}
                    </button>
                  ))}
                </div>

                {/* Sync comments */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  disabled={hook.isSyncingComments}
                  onClick={hook.syncComments}
                >
                  <IconRefresh
                    className={`h-3.5 w-3.5 ${hook.isSyncingComments ? "animate-spin" : ""}`}
                  />
                </Button>

                {/* Search comments */}
                <div className="relative w-36">
                  <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input
                    value={hook.commentSearch}
                    onChange={(e) => hook.setCommentSearch(e.target.value)}
                    placeholder="Rechercher…"
                    className="pl-7 h-8 text-xs bg-secondary/20"
                  />
                  {hook.commentSearch && (
                    <button
                      onClick={() => hook.setCommentSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <IconX className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Comments list */}
              <ScrollArea className="flex-1">
                <div className="p-5 space-y-4">
                  {hook.commentsLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 rounded-xl" />
                    ))
                  ) : hook.comments.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-sm text-muted-foreground">
                        Aucun commentaire
                      </p>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        Cliquez sur le bouton de synchronisation pour charger
                        les commentaires.
                      </p>
                    </div>
                  ) : (
                    hook.comments.map((comment) => (
                      <CommentItem
                        key={comment.id}
                        comment={comment}
                        pageName={hook.activePage?.name ?? null}
                        isReplyingTo={hook.replyingTo === comment.id}
                        replyText={
                          hook.replyingTo === comment.id ? hook.replyText : ""
                        }
                        replyMode={hook.replyMode}
                        replySending={hook.replySending}
                        onStartReply={() => {
                          hook.setReplyingTo(comment.id);
                          hook.setReplyText("");
                        }}
                        onCancelReply={() => {
                          hook.setReplyingTo(null);
                          hook.setReplyText("");
                        }}
                        onChangeText={hook.setReplyText}
                        onChangeMode={hook.setReplyMode}
                        onSubmitReply={hook.submitReply}
                        onAiReply={() => hook.triggerAiReply(comment.id)}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  Sélectionnez un post
                </p>
                <p className="text-xs text-muted-foreground/60">
                  Cliquez sur un post dans la liste pour voir ses commentaires.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL — Config + Stats ─────────────────────────────────── */}
        <div className="w-[300px] shrink-0 flex flex-col border-l border-border/40">
          {/* Tab switcher */}
          <div className="shrink-0 flex border-b border-border/40">
            {(
              [
                {
                  key: "comments" as const,
                  icon: IconSettings,
                  label: "Config IA",
                },
                { key: "config" as const, icon: IconArmchair, label: "Stats" },
              ] as { key: ActiveTab; icon: React.ElementType; label: string }[]
            ).map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setRightTab(key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors border-b-2 ${
                  rightTab === key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {rightTab === "comments" ? (
              hook.selectedPost ? (
                <PostConfigPanel
                  config={hook.postAiConfig}
                  loading={hook.configLoading}
                  saving={hook.configSaving}
                  error={hook.configError}
                  autoReplyCount={hook.autoReplyCount}
                  autoReplyLimitReached={hook.autoReplyLimitReached}
                  onSave={hook.saveConfig}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-xs text-muted-foreground">
                    Sélectionnez un post
                  </p>
                </div>
              )
            ) : (
              <ScrollArea className="h-full">
                <StatsSidebar posts={hook.posts} />
              </ScrollArea>
            )}
          </div>
        </div>
      </div>

      {/* Add post dialog */}
      <AddPostDialog
        open={hook.addDialogOpen}
        feedPosts={hook.feedPosts}
        feedLoading={hook.feedLoading}
        adding={hook.addingPost}
        activePage={hook.activePage}
        onClose={() => hook.setAddDialogOpen(false)}
        onAdd={hook.addPost}
      />
    </TooltipProvider>
  );
}
