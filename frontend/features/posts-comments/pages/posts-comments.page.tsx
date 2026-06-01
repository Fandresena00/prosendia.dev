"use client";
/**
 * @file features/posts-comments/pages/posts-comments.page.tsx
 *
 * Three-panel layout (responsive):
 *   [360px posts list] | [flex comments] | [360px config/stats]
 *
 * Improvements:
 *   - Wider sidebars (360px each)
 *   - Delete confirmation dialog
 *   - Larger add-post dialog (max-w-3xl)
 *   - Better stats (replied by AI, human, unanswered, DMs)
 *   - Page switcher with "Changer de page" label
 *   - AI typing indicator on comments
 *   - Responsive (collapses on mobile)
 *   - Comment count/filter bar with sync button
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
  IconPlus,
  IconRefresh,
  IconSearch,
} from "@tabler/icons-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import Image from "next/image";
import { useState } from "react";
import { CommentItem } from "../components/comment-item";
import { PageSwitcher } from "../components/page-switcher";
import { PostCard } from "../components/post-card";
import { PostConfigPanel } from "../components/post-config-panel";
import { StatsSidebar } from "../components/stats-sidebar";
import { usePostsComments } from "../hooks/use-posts-comments";
import type { CommentFilter, FbFeedPost } from "../types/posts-comments.types";

export function PostsCommentsPage() {
  const pc = usePostsComments();

  return (
    <TooltipProvider>
      <div className="flex h-[calc(100vh-20px)] overflow-hidden bg-background">

        {/* ── LEFT: Posts list (360px) ── */}
        <aside className="hidden md:flex flex-col w-[360px] shrink-0 border-r border-border/40 bg-card/20">
          <PostsListPanel pc={pc} />
        </aside>

        {/* ── CENTER: Comments ── */}
        <main className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {pc.selectedPost ? (
            <CommentsPanel pc={pc} />
          ) : (
            <EmptyCenter />
          )}
        </main>

        {/* ── RIGHT: Config + Stats (360px) ── */}
        <aside className="hidden lg:flex flex-col w-[360px] shrink-0 border-l border-border/40 bg-card/20">
          {pc.selectedPost ? (
            <ConfigStatsPanel pc={pc} />
          ) : (
            <StatsSidebar posts={pc.posts} commentStats={pc.commentStats} />
          )}
        </aside>
      </div>

      {/* ── Delete confirmation dialog ── */}
      <AlertDialog open={!!pc.confirmDeleteId} onOpenChange={(o) => !o && pc.cancelDeletePost()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer ce post ?</AlertDialogTitle>
            <AlertDialogDescription>
              Ce post sera retiré de la gestion VendeoAI. Sa configuration IA et ses
              commentaires seront supprimés. Le post Facebook original n&apos;est pas affecté.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={pc.cancelDeletePost}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={pc.confirmDeletePost}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
        loading={pc.loadingFeed}
        onAdd={pc.handleAddPost}
      />
    </TooltipProvider>
  );
}

// ─── Posts list panel ─────────────────────────────────────────────────────────

function PostsListPanel({ pc }: { pc: ReturnType<typeof usePostsComments> }) {
  const [search, setSearch] = useState("");

  const filtered = pc.posts.filter((p) =>
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
            className="h-7 gap-1 px-2.5 text-xs"
            onClick={pc.openAddDialog}
          >
            <IconPlus className="h-3.5 w-3.5" />
            Ajouter
          </Button>
        </div>

        {/* Page switcher with label */}
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
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Rechercher un post…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-8 text-xs bg-secondary/40 border-0 rounded-full focus-visible:ring-1 focus-visible:ring-primary/50"
            />
          </div>
        )}
      </div>

      {/* List */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 space-y-1.5">
          {pc.loadingPosts ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center px-4">
              <p className="text-xs text-muted-foreground">
                {pc.posts.length === 0
                  ? "Aucun post géré. Cliquez sur « Ajouter »."
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
                  onDelete={(e) => { e.stopPropagation(); pc.requestDeletePost(post.id); }}
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
            <p className="text-sm font-semibold truncate">{post.message ?? "Post sans légende"}</p>
            <p className="text-[11px] text-muted-foreground">
              {formatDistanceToNow(new Date(post.publishedAt), { addSuffix: true, locale: fr })}
              {" · "}
              <span className="font-medium">{post._count?.comments ?? post.commentsCount}</span> commentaires
            </p>
          </div>
          <Button
            variant="outline" size="sm"
            className="h-7 gap-1.5 px-2.5 text-xs shrink-0"
            disabled={pc.syncingComments}
            onClick={pc.handleSyncComments}
          >
            <IconRefresh className={`h-3.5 w-3.5 ${pc.syncingComments ? "animate-spin" : ""}`} />
            {pc.syncingComments ? "Sync…" : "Sync"}
          </Button>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-2">
          {(["all", "pending", "replied"] as CommentFilter[]).map((f) => {
            const labels: Record<CommentFilter, string> = {
              all:     "Tous",
              pending: "Sans réponse",
              replied: "Répondus",
            };
            const counts: Record<CommentFilter, number> = {
              all:     pc.commentTotal,
              pending: pc.commentStats.unanswered,
              replied: pc.commentStats.repliedByAi + pc.commentStats.repliedByHuman,
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
                <span className={`text-[9px] font-bold rounded-full px-1 ${
                  pc.commentFilter === f ? "bg-primary/15" : "bg-secondary"
                }`}>
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
              className="pl-7 h-7 w-36 text-xs bg-secondary/40 border-0 rounded-full focus-visible:ring-1 focus-visible:ring-primary/50"
            />
          </div>
        </div>
      </div>

      {/* Comments list */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
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
              <p className="text-sm text-muted-foreground">Aucun commentaire trouvé.</p>
              <Button variant="outline" size="sm" onClick={pc.handleSyncComments}>
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

              {/* Load more */}
              {pc.comments.length < pc.commentTotal && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant="outline" size="sm"
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
        <TabsTrigger value="comments" className="flex-1 text-xs h-6 rounded-lg">
          Statistiques
        </TabsTrigger>
        <TabsTrigger value="config" className="flex-1 text-xs h-6 rounded-lg">
          Configuration IA
        </TabsTrigger>
      </TabsList>

      <TabsContent value="comments" className="flex-1 overflow-y-auto mt-0 p-0">
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
          onSave={pc.saveConfig}
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
          <IconSearch className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold">Sélectionnez un post</p>
          <p className="text-xs text-muted-foreground mt-1">
            Choisissez un post dans la liste pour voir et gérer ses commentaires.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Add post dialog ──────────────────────────────────────────────────────────

function AddPostDialog({
  open, onClose, feedPosts, loading, onAdd,
}: {
  open:      boolean;
  onClose:   () => void;
  feedPosts: FbFeedPost[];
  loading:   boolean;
  onAdd:     (post: FbFeedPost) => Promise<void>;
}) {
  const [adding, setAdding] = useState<string | null>(null);

  const handleAdd = async (post: FbFeedPost) => {
    setAdding(post.externalId);
    await onAdd(post).finally(() => setAdding(null));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-3xl bg-background rounded-2xl border border-border/60 shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border/40 shrink-0 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold">Ajouter un post à gérer</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Sélectionnez un post de votre page pour activer la gestion des commentaires.
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Feed grid */}
        <ScrollArea className="flex-1 min-h-0 p-5">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-44 rounded-xl" />
              ))}
            </div>
          ) : feedPosts.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">
              Aucun post trouvé sur cette page.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {feedPosts.map((post) => (
                <FeedPostCard
                  key={post.externalId}
                  post={post}
                  adding={adding === post.externalId}
                  onAdd={() => handleAdd(post)}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="px-6 py-4 border-t border-border/40 shrink-0 flex justify-end">
          <Button variant="outline" className="h-8 text-xs" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
}

function FeedPostCard({
  post, adding, onAdd,
}: {
  post:   FbFeedPost;
  adding: boolean;
  onAdd:  () => void;
}) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className={`relative rounded-xl border overflow-hidden flex flex-col transition-all ${
      post.alreadyAdded
        ? "border-emerald-500/30 bg-emerald-500/5 opacity-70"
        : "border-border/40 bg-card hover:border-primary/30 hover:shadow-sm cursor-pointer"
    }`}>
      {/* Image */}
      {post.imageUrl && !imgError ? (
        <div className="relative h-28 bg-secondary/40">
          <Image
            src={post.imageUrl} alt="" fill sizes="200px"
            className="object-cover" unoptimized
            onError={() => setImgError(true)}
          />
        </div>
      ) : (
        <div className="h-20 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
          <span className="text-3xl">📄</span>
        </div>
      )}

      {/* Content */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <p className="text-xs text-foreground line-clamp-2 flex-1 leading-snug">
          {post.message ?? <span className="italic text-muted-foreground">Pas de légende</span>}
        </p>

        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>👍 {post.reactionsCount}</span>
          <span>💬 {post.commentsCount}</span>
        </div>

        {post.alreadyAdded ? (
          <Badge variant="secondary" className="text-[10px] h-5 bg-emerald-500/10 text-emerald-700 border-emerald-500/20 w-fit">
            Déjà ajouté
          </Badge>
        ) : (
          <Button
            size="sm" className="h-7 text-xs w-full gap-1"
            disabled={adding}
            onClick={onAdd}
          >
            {adding ? (
              <><span className="h-3 w-3 rounded-full border-2 border-transparent border-t-current animate-spin" />Ajout…</>
            ) : (
              <><IconPlus className="h-3 w-3" />Gérer ce post</>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
