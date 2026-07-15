"use client";
/**
 * @file features/posts-comments/pages/posts-comments.page.tsx
 *
 * CHANGES IN THIS REVISION
 * ─────────────────────────────────────────────────────────────────────────
 * MOBILE UX OVERHAUL
 * ──────────────────
 * Previously: left panel hidden on mobile (hidden md:flex), no way to
 * navigate between posts, no way to access config/stats on mobile.
 *
 * Now — bottom navigation bar on mobile (<md):
 *   [Posts] [Commentaires] [Config]
 * Each tab swaps the visible panel. The posts panel gets a "→ Voir les
 * commentaires" CTA once a post is selected. The comments panel gets a
 * "← Posts" back button in the header.
 *
 * Desktop layout is unchanged (3-column, 400px | flex | 400px).
 *
 * OTHER CHANGES
 * ─────────────
 * - AddPostDialog extracted to add-post-dialog.tsx (see that file for
 *   the redesign notes)
 * - Delete confirmation dialog: unchanged
 * - EmptyCenter: unchanged
 * - NoConnectedPageCta: unchanged
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  IconBrandFacebook,
  IconChartBar,
  IconLink,
  IconMessage,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSettings,
  IconTrash,
} from "@tabler/icons-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import Link from "next/link";
import { useState } from "react";
import { AddPostDialog } from "../components/add-post-dialog";
import { CommentItem } from "../components/comment-item";
import { PageSwitcher } from "../components/page-switcher";
import { PostCard } from "../components/post-card";
import { PostConfigPanel } from "../components/post-config-panel";
import { StatsSidebar } from "../components/stats-sidebar";
import { usePostsComments } from "../hooks/use-posts-comments";
import type { CommentFilter } from "../types/posts-comments.types";

// ─── Mobile panel type ─────────────────────────────────────────────────────

type MobilePanel = "posts" | "comments" | "config";

// ─── Root ──────────────────────────────────────────────────────────────────

export function PostsCommentsPage() {
  const pc = usePostsComments();
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("posts");

  if (pc.hasNoConnectedPages) {
    return <NoConnectedPageCta />;
  }

  // When a post is selected on mobile, auto-navigate to comments
  const handleSelectPost = (post: Parameters<typeof pc.selectPost>[0]) => {
    pc.selectPost(post);
    setMobilePanel("comments");
  };

  return (
    <TooltipProvider>
      {/* ── Desktop: 3-column layout ── */}
      <div className="hidden md:flex h-[calc(100vh-20px)] overflow-hidden bg-background">
        {/* LEFT: Posts (400px) */}
        <aside className="flex flex-col w-[400px] shrink-0 border-r border-border/40 bg-card/20">
          <PostsListPanel pc={pc} />
        </aside>

        {/* CENTER: Comments */}
        <main className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {pc.selectedPost ? <CommentsPanel pc={pc} /> : <EmptyCenter />}
        </main>

        {/* RIGHT: Config + Stats (400px) */}
        <aside className="hidden lg:flex flex-col w-[400px] shrink-0 border-l border-border/40 bg-card/20">
          {pc.selectedPost ? (
            <ConfigStatsPanel pc={pc} />
          ) : (
            <StatsSidebar posts={pc.posts} commentStats={pc.commentStats} />
          )}
        </aside>
      </div>

      {/* ── Mobile: single-panel with bottom nav ── */}
      <div className="flex md:hidden flex-col h-[calc(100vh-20px)] overflow-hidden bg-background">
        {/* Panel content */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {mobilePanel === "posts" && (
            <div className="flex flex-col h-full">
              <PostsListPanel pc={{ ...pc, selectPost: handleSelectPost }} />
            </div>
          )}
          {mobilePanel === "comments" && (
            <div className="flex flex-col h-full">
              {/* Mobile back button */}
              <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-border/40 bg-background/80">
                <button
                  onClick={() => setMobilePanel("posts")}
                  className="flex items-center gap-1.5 text-xs text-primary font-semibold"
                >
                  ← Posts
                </button>
              </div>
              {pc.selectedPost ? (
                <CommentsPanel pc={pc} />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    Sélectionnez un post pour voir ses commentaires
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMobilePanel("posts")}
                  >
                    Voir les posts
                  </Button>
                </div>
              )}
            </div>
          )}
          {mobilePanel === "config" && (
            <div className="flex flex-col h-full">
              <div className="shrink-0 px-4 pt-3 pb-2 border-b border-border/40">
                <p className="text-sm font-bold">
                  {pc.selectedPost
                    ? pc.selectedPost.message?.slice(0, 40) ?? "Post sélectionné"
                    : "Statistiques"}
                </p>
              </div>
              {pc.selectedPost ? (
                <ConfigStatsPanel pc={pc} />
              ) : (
                <StatsSidebar posts={pc.posts} commentStats={pc.commentStats} />
              )}
            </div>
          )}
        </div>

        {/* Bottom navigation bar */}
        <nav className="shrink-0 border-t border-border/40 bg-background/95 backdrop-blur-sm">
          <div className="flex items-center">
            {(
              [
                {
                  id: "posts" as MobilePanel,
                  icon: IconMessage,
                  label: "Posts",
                  badge: pc.posts.length > 0 ? pc.posts.length : null,
                },
                {
                  id: "comments" as MobilePanel,
                  icon: IconSearch,
                  label: "Commentaires",
                  badge:
                    pc.commentStats.unanswered > 0
                      ? pc.commentStats.unanswered
                      : null,
                },
                {
                  id: "config" as MobilePanel,
                  icon: IconSettings,
                  label: "Config & Stats",
                  badge: null,
                },
              ] as const
            ).map(({ id, icon: Icon, label, badge }) => (
              <button
                key={id}
                onClick={() => setMobilePanel(id)}
                className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors relative ${
                  mobilePanel === id
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              >
                <div className="relative">
                  <Icon className="h-5 w-5" />
                  {badge !== null && badge > 0 && (
                    <span className="absolute -top-1 -right-1.5 h-4 min-w-4 rounded-full bg-rose-500 text-[9px] font-bold text-white flex items-center justify-center px-0.5">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </div>
                <span>{label}</span>
                {mobilePanel === id && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </div>
        </nav>
      </div>

      {/* ── Delete confirmation dialog ── */}
      <AlertDialog
        open={!!pc.confirmDeleteId}
        onOpenChange={(o) => !o && pc.cancelDeletePost()}
      >
        <AlertDialogContent className="max-w-md rounded-2xl border-border/60 p-0 overflow-hidden">
          <div className="border-b border-border/40 px-6 py-5">
            <AlertDialogHeader className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <IconTrash className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <AlertDialogTitle className="text-base font-bold tracking-tight">
                    Retirer ce post de la gestion ?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="mt-1.5 text-xs leading-relaxed">
                    prosendia n&apos;automatisera plus les réponses pour cette
                    publication. La configuration IA et les commentaires
                    synchronisés seront retirés de l&apos;interface.
                  </AlertDialogDescription>
                </div>
              </div>
            </AlertDialogHeader>
          </div>
          <div className="px-6 py-4">
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3.5 py-2.5">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                Le post original reste intact sur Facebook.
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                Cette action retire seulement le suivi et l&apos;automatisation
                dans votre espace.
              </p>
            </div>
          </div>
          <AlertDialogFooter className="border-t border-border/40 bg-secondary/20 px-6 py-4 sm:justify-end">
            <AlertDialogCancel
              onClick={pc.cancelDeletePost}
              className="h-9 rounded-full px-4 text-xs"
            >
              Garder le post
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={pc.confirmDeletePost}
              className="h-9 rounded-full bg-destructive px-4 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90"
            >
              Retirer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Add post dialog ── */}
      <AddPostDialog
        open={pc.addDialogOpen}
        onClose={() => pc.setAddDialogOpen(false)}
        feedPosts={pc.feedPosts}
        feedLoading={pc.loadingFeed}
        adding={false}
        activePage={pc.activePage}
        onAdd={async (post) => {
          await pc.handleAddPost(post);
          pc.setAddDialogOpen(false);
        }}
        managedPostsLimit={pc.managedPostsLimit}
      />
    </TooltipProvider>
  );
}

// ─── No connected page CTA ──────────────────────────────────────────────────

function NoConnectedPageCta() {
  return (
    <div className="flex h-[calc(100vh-20px)] items-center justify-center bg-background px-6">
      <div className="flex max-w-md flex-col items-center gap-5 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1877F2]/10">
          <IconBrandFacebook className="h-8 w-8 text-[#1877F2]" />
        </div>
        <div className="space-y-2">
          <h1 className="text-lg font-bold tracking-tight">
            Connectez une page Facebook pour commencer
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            La gestion des posts et des réponses automatiques aux commentaires
            nécessite une page Facebook connectée à prosendia.
          </p>
        </div>
        <Button
          asChild
          className="h-10 gap-2 rounded-full px-5 text-sm font-semibold bg-[#1877F2] hover:bg-[#166FE5]"
        >
          <Link href="/dashboard/facebook-pages">
            <IconLink className="h-4 w-4" />
            Connecter ma page Facebook
          </Link>
        </Button>
      </div>
    </div>
  );
}

// ─── Posts list panel ─────────────────────────────────────────────────────────

function PostsListPanel({ pc }: { pc: ReturnType<typeof usePostsComments> }) {
  const [search, setSearch] = useState("");

  const filtered = pc.posts.filter(
    (p) =>
      !search.trim() ||
      (p.message ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border/40 space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold tracking-tight">Posts gérés</h2>
          <Button
            size="sm"
            className="h-9 gap-1.5 rounded-full px-3 text-xs font-semibold bg-[#1877F2] hover:bg-[#166FE5]"
            onClick={pc.openAddDialog}
          >
            <IconPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Ajouter un post</span>
            <span className="sm:hidden">Ajouter</span>
          </Button>
        </div>

        {pc.pages.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-0.5">
              Changer de page →
            </p>
            <PageSwitcher
              pages={pc.pages}
              activeKey={pc.activeKey}
              onSwitch={pc.setActiveKey}
            />
          </div>
        )}

        {pc.posts.length > 0 && (
          <div className="relative">
            <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Rechercher un post…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 rounded-full border-0 bg-secondary/45 pl-10 text-sm focus-visible:ring-1 focus-visible:ring-primary/50"
            />
          </div>
        )}
      </div>

      {/* List */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2.5 space-y-3">
          {pc.loadingPosts ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-56 rounded-lg" />
            ))
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center px-4">
              <p className="text-xs text-muted-foreground">
                {pc.posts.length === 0
                  ? "Aucun post géré. Ajoutez une publication Facebook pour suivre ses commentaires."
                  : "Aucun résultat."}
              </p>
            </div>
          ) : (
            filtered.map((post) =>
              pc.activePage ? (
                <PostCard
                  key={post.id}
                  post={post}
                  page={pc.activePage}
                  active={pc.selectedPost?.id === post.id}
                  deleting={pc.deletingId === post.id}
                  onSelect={() => pc.selectPost(post)}
                  onDelete={(e) => {
                    e.stopPropagation();
                    pc.requestDeletePost(post.id);
                  }}
                />
              ) : null,
            )
          )}
        </div>
      </ScrollArea>
    </>
  );
}

// ─── Comments panel ───────────────────────────────────────────────────────────

function CommentsPanel({ pc }: { pc: ReturnType<typeof usePostsComments> }) {
  const post = pc.selectedPost!;

  return (
    <>
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/40 bg-background/80 backdrop-blur-sm shrink-0 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">
              {post.message ?? "Post sans légende"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {formatDistanceToNow(new Date(post.publishedAt), {
                addSuffix: true,
                locale: fr,
              })}
              {" · "}
              <span className="font-medium">
                {post._count?.comments ?? post.commentsCount}
              </span>{" "}
              commentaires
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 px-2.5 text-xs shrink-0"
            disabled={pc.syncingComments}
            onClick={pc.handleSyncComments}
          >
            <IconRefresh
              className={`h-3.5 w-3.5 ${pc.syncingComments ? "animate-spin" : ""}`}
            />
            {pc.syncingComments ? "Sync…" : "Sync"}
          </Button>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(["all", "pending", "replied"] as CommentFilter[]).map((f) => {
            const labels: Record<CommentFilter, string> = {
              all: "Tous",
              pending: "Sans réponse",
              replied: "Répondus",
            };
            const counts: Record<CommentFilter, number> = {
              all: pc.commentTotal,
              pending: pc.commentStats.unanswered,
              replied:
                pc.commentStats.repliedByAi + pc.commentStats.repliedByHuman,
            };
            return (
              <button
                key={f}
                onClick={() => pc.handleFilterChange(f)}
                className={`flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border transition-all ${
                  pc.commentFilter === f
                    ? "bg-primary/10 border-primary/30 text-primary font-semibold"
                    : "border-border/40 text-muted-foreground hover:border-border"
                }`}
              >
                {labels[f]}
                <span
                  className={`text-[9px] font-bold rounded-full px-1 ${
                    pc.commentFilter === f ? "bg-primary/15" : "bg-secondary"
                  }`}
                >
                  {counts[f]}
                </span>
              </button>
            );
          })}

          <div className="relative ml-auto">
            <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Chercher…"
              value={pc.commentSearch}
              onChange={(e) => pc.handleSearchChange(e.target.value)}
              className="pl-7 h-7 w-28 sm:w-36 text-xs bg-secondary/40 border-0 rounded-full focus-visible:ring-1 focus-visible:ring-primary/50"
            />
          </div>
        </div>
      </div>

      {/* Comments list */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="w-full max-w-3xl px-3 py-4 space-y-4 sm:px-6">
          {pc.loadingComments && pc.comments.length === 0 ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-2.5">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-16 rounded-2xl" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))
          ) : pc.comments.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-sm text-muted-foreground">
                Aucun commentaire trouvé.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={pc.handleSyncComments}
              >
                <IconRefresh className="h-3.5 w-3.5 mr-1.5" />
                Synchroniser depuis Facebook
              </Button>
            </div>
          ) : (
            <>
              {pc.comments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  pageName={pc.activePage?.name}
                  isReplyingTo={pc.replyingToId === comment.id}
                  replyText={pc.replyText}
                  replyMode={pc.replyMode}
                  replySending={pc.replySending}
                  aiTyping={pc.aiTypingComments.has(comment.id)}
                  onStartReply={() => pc.startReply(comment.id)}
                  onCancelReply={pc.cancelReply}
                  onChangeText={pc.setReplyText}
                  onChangeMode={pc.setReplyMode}
                  onSubmitReply={pc.submitReply}
                  onAiReply={() => pc.handleAiReply(comment.id)}
                />
              ))}

              {pc.comments.length < pc.commentTotal && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    disabled={pc.loadingComments}
                    onClick={pc.loadNextPage}
                  >
                    {pc.loadingComments ? "Chargement…" : "Charger plus"}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </>
  );
}

// ─── Config + Stats right panel ────────────────────────────────────────────────

function ConfigStatsPanel({ pc }: { pc: ReturnType<typeof usePostsComments> }) {
  return (
    <Tabs
      value={pc.activeTab}
      onValueChange={(v) => pc.setActiveTab(v as "comments" | "config")}
      className="flex flex-col h-full"
    >
      <TabsList className="shrink-0 mx-4 mt-4 h-8 rounded-xl">
        <TabsTrigger
          value="comments"
          className="flex-1 text-xs h-6 rounded-lg gap-1.5"
        >
          <IconChartBar className="h-3.5 w-3.5" />
          Statistiques
        </TabsTrigger>
        <TabsTrigger
          value="config"
          className="flex-1 text-xs h-6 rounded-lg gap-1.5"
        >
          <IconSettings className="h-3.5 w-3.5" />
          Config IA
        </TabsTrigger>
      </TabsList>

      <TabsContent
        value="comments"
        className="flex-1 overflow-y-auto mt-0 p-0"
      >
        <StatsSidebar posts={pc.posts} commentStats={pc.commentStats} />
      </TabsContent>

      <TabsContent value="config" className="flex-1 overflow-hidden mt-0 p-0">
        <PostConfigPanel
          config={pc.postConfig}
          loading={pc.loadingConfig}
          saving={pc.savingConfig}
          error={pc.configError}
          autoReplyCount={pc.autoReplyCount}
          autoReplyLimitReached={pc.autoReplyLimitReached}
          suggestingField={pc.suggestingField}
          onSave={pc.saveConfig}
          onSuggest={pc.generateSuggestion}
        />
      </TabsContent>
    </Tabs>
  );
}

// ─── Empty center ─────────────────────────────────────────────────────────────

function EmptyCenter() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-center px-8">
        <div className="h-12 w-12 rounded-2xl bg-secondary flex items-center justify-center">
          <IconMessage className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold">Sélectionnez un post</p>
          <p className="text-xs text-muted-foreground mt-1">
            Choisissez un post dans la liste pour voir et gérer ses
            commentaires.
          </p>
        </div>
      </div>
    </div>
  );
}
