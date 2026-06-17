"use client";
/**
 * @file features/posts-comments/pages/posts-comments.page.tsx
 *
 * Three-panel layout (responsive):
 *   [400px posts list] | [flex comments] | [400px config/stats]
 *
 * CHANGES IN THIS REVISION
 * ─────────────────────────────────────────────────────────────────────────
 * 1. NEW — NoConnectedPageCta: when the user has zero connected Facebook
 *    pages, the whole 3-panel layout is replaced with a single centered
 *    call-to-action that links to the Facebook connection page. Previously
 *    the page silently rendered an empty/confusing UI with no explanation.
 * 2. Widened side columns: 360px → 400px (posts list + stats/config), per
 *    "tu peux elargir un peu la column des tab de stats et configuration ia".
 *
 * Other existing features:
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
  IconBrandFacebook,
  IconLink,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSparkles,
  IconTrash,
} from "@tabler/icons-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import Image from "next/image";
import Link from "next/link";
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

  // FIX (point: CTA quand aucune page connectée) — previously the page
  // rendered the full 3-panel layout even with zero Facebook pages
  // connected, showing an empty posts list with no explanation. Now we
  // short-circuit to a single, clear call-to-action.
  if (pc.hasNoConnectedPages) {
    return <NoConnectedPageCta />;
  }

  return (
    <TooltipProvider>
      <div className="flex h-[calc(100vh-20px)] overflow-hidden bg-background">

        {/* ── LEFT: Posts list (400px) ── */}
        <aside className="hidden md:flex flex-col w-[400px] shrink-0 border-r border-border/40 bg-card/20">
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

        {/* ── RIGHT: Config + Stats (400px) ── */}
        <aside className="hidden lg:flex flex-col w-[400px] shrink-0 border-l border-border/40 bg-card/20">
          {pc.selectedPost ? (
            <ConfigStatsPanel pc={pc} />
          ) : (
            <StatsSidebar posts={pc.posts} commentStats={pc.commentStats} />
          )}
        </aside>
      </div>

      {/* ── Delete confirmation dialog ── */}
      <AlertDialog open={!!pc.confirmDeleteId} onOpenChange={(o) => !o && pc.cancelDeletePost()}>
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
                    VendeoAI n&apos;automatisera plus les réponses pour cette publication.
                    La configuration IA et les commentaires synchronisés liés à ce post seront retirés de l&apos;interface.
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
                Cette action retire seulement le suivi et l&apos;automatisation dans votre espace.
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
        loading={pc.loadingFeed}
        onAdd={pc.handleAddPost}
        managedPostsLimit={pc.managedPostsLimit}
      />
    </TooltipProvider>
  );
}

// ─── No connected page CTA ──────────────────────────────────────────────────

/**
 * Rendered instead of the full layout when the user has zero connected
 * Facebook pages. Points directly to the Facebook connection flow instead
 * of leaving the user looking at an empty, unexplained posts/comments UI.
 */
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
            nécessite une page Facebook connectée à VendeoAI. Connectez votre
            page pour gérer vos publications et activer l&apos;IA.
          </p>
        </div>
        <Button asChild className="h-10 gap-2 rounded-full px-5 text-sm font-semibold bg-[#1877F2] hover:bg-[#166FE5]">
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
            className="h-9 gap-1.5 rounded-full px-3 text-xs font-semibold bg-[#1877F2] hover:bg-[#166FE5]"
            onClick={pc.openAddDialog}
          >
            <IconPlus className="h-4 w-4" />
            Ajouter un post
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
        <div className="w-full max-w-3xl px-4 py-4 space-y-4 lg:px-6">
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
  open, onClose, feedPosts, loading, onAdd, managedPostsLimit,
}: {
  open:      boolean;
  onClose:   () => void;
  feedPosts: FbFeedPost[];
  loading:   boolean;
  onAdd:     (post: FbFeedPost) => Promise<void>;
  /** Plan-based managed-post limit (point 6). When current >= max, post
   *  selection is disabled and an upgrade message is shown instead of
   *  letting the backend reject the request with an unexplained 400. */
  managedPostsLimit?: { current: number; max: number | null; planName: string };
}) {
  const [adding, setAdding] = useState<string | null>(null);
  const [selected, setSelected] = useState<FbFeedPost | null>(null);

  const isLimitReached =
    !!managedPostsLimit &&
    managedPostsLimit.max !== null &&
    managedPostsLimit.current >= managedPostsLimit.max;

  const handleClose = () => {
    if (adding) return;
    setSelected(null);
    onClose();
  };

  const handleAdd = async () => {
    if (!selected || selected.alreadyAdded || isLimitReached) return;
    setAdding(selected.externalId);
    await onAdd(selected).finally(() => {
      setAdding(null);
      setSelected(null);
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm sm:p-5">
      <div className="flex h-[min(90vh,920px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border/60 bg-background shadow-2xl">
        {/* Header */}
        <div className="shrink-0 border-b border-border/40 px-4 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1877F2]/10">
                  <IconBrandFacebook className="h-5 w-5 text-[#1877F2]" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold tracking-tight">Ajouter un post à gérer</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Choisissez une publication Facebook dans votre feed.
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={handleClose}
              disabled={!!adding}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-50"
              aria-label="Fermer"
            >
              ×
            </button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
              Sélectionnez un post de votre page pour activer la gestion des commentaires.
          </p>

          {/* Plan limit banner (point 6) */}
          {isLimitReached && managedPostsLimit && (
            <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/8 px-3.5 py-3">
              <p className="text-xs font-semibold text-amber-700">
                Limite du plan {managedPostsLimit.planName} atteinte (
                {managedPostsLimit.current}/{managedPostsLimit.max})
              </p>
              <p className="text-[10px] text-amber-600/80 mt-0.5 leading-relaxed">
                Retirez un post géré existant, ou passez à un abonnement
                supérieur pour en gérer davantage.
              </p>
            </div>
          )}
        </div>

        {/* Feed list */}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5">
          {loading ? (
            <div className="mx-auto max-w-2xl space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-80 rounded-xl" />
              ))}
            </div>
          ) : feedPosts.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">
              Aucun post trouvé sur cette page.
            </p>
          ) : (
            <div className="mx-auto max-w-2xl space-y-4">
              {feedPosts.map((post) => (
                <FeedPostCard
                  key={post.externalId}
                  post={post}
                  selected={selected?.externalId === post.externalId}
                  disabled={isLimitReached}
                  onSelect={() => {
                    if (!post.alreadyAdded && !adding && !isLimitReached) setSelected(post);
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-border/40 bg-background/95 px-4 py-3 sm:px-6">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {isLimitReached
                ? "Limite de posts gérés atteinte pour votre abonnement."
                : selected && !selected.alreadyAdded
                  ? "Post sélectionné. Vous pouvez maintenant l'ajouter à la gestion."
                  : "Sélectionnez une publication dans la liste."}
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" className="h-9 px-4 text-xs" onClick={handleClose} disabled={!!adding}>
            Fermer
          </Button>
              <Button
                className="h-9 gap-2 rounded-full bg-[#1877F2] px-4 text-xs font-semibold hover:bg-[#166FE5]"
                disabled={!selected || selected.alreadyAdded || !!adding || isLimitReached}
                onClick={handleAdd}
              >
                {adding ? (
                  <><span className="h-3.5 w-3.5 rounded-full border-2 border-transparent border-t-current animate-spin" />Ajout…</>
                ) : isLimitReached ? (
                  "Limite atteinte"
                ) : (
                  <><IconSparkles className="h-3.5 w-3.5" />Ajouter le post</>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeedPostCard({
  post, selected, disabled, onSelect,
}: {
  post:   FbFeedPost;
  selected: boolean;
  /** True when the plan's managed-post limit has been reached. */
  disabled?: boolean;
  onSelect: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const timeAgo = formatDistanceToNow(new Date(post.publishedAt), {
    addSuffix: true,
    locale: fr,
  });

  return (
    <button
      type="button"
      disabled={post.alreadyAdded || disabled}
      onClick={onSelect}
      className={`relative w-full overflow-hidden rounded-xl border bg-card text-left transition-all ${
      post.alreadyAdded
        ? "cursor-not-allowed border-emerald-500/30 bg-emerald-500/5 opacity-75"
        : disabled
          ? "cursor-not-allowed border-border/30 opacity-50"
          : selected
            ? "border-[#1877F2] shadow-[0_0_0_2px_rgba(24,119,242,.16)]"
            : "border-border/50 hover:border-primary/35 hover:shadow-md"
    }`}>
      <div className="flex items-center gap-3 px-4 pt-4">
        <div className="h-10 w-10 rounded-full bg-[#1877F2]/10 flex items-center justify-center shrink-0">
          <IconBrandFacebook className="h-5 w-5 text-[#1877F2]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">Publication Facebook</p>
          <p className="text-[11px] text-muted-foreground">{timeAgo}</p>
        </div>
        {post.alreadyAdded && (
          <Badge variant="secondary" className="h-6 bg-emerald-500/10 text-emerald-700 border-emerald-500/20">
            Déjà ajouté
          </Badge>
        )}
        {selected && !post.alreadyAdded && (
          <Badge className="h-6 bg-[#1877F2] text-white hover:bg-[#1877F2]">
            Sélectionné
          </Badge>
        )}
      </div>

      <div className="px-4 py-3">
        <p className="text-[14px] leading-relaxed text-foreground">
          {post.message ?? <span className="italic text-muted-foreground">Pas de légende</span>}
        </p>
      </div>

      {post.imageUrl && !imgError ? (
        <div className="relative aspect-[1.7/1] w-full bg-secondary/40">
          <Image
            src={post.imageUrl} alt="" fill sizes="672px"
            className="object-cover" unoptimized
            onError={() => setImgError(true)}
          />
        </div>
      ) : null}

      <div className="px-4 py-3">
        <div className="flex items-center justify-between border-b border-border/40 pb-2 text-[12px] text-muted-foreground">
          <span>{post.reactionsCount} réaction{post.reactionsCount > 1 ? "s" : ""}</span>
          <span>{post.commentsCount} commentaire{post.commentsCount > 1 ? "s" : ""}</span>
        </div>

        <div className="pt-3">
          {post.alreadyAdded ? (
            <div className="flex h-10 items-center justify-center rounded-lg bg-emerald-500/10 text-sm font-semibold text-emerald-700">
              Ce post est déjà géré
            </div>
          ) : (
            <div className={`flex h-10 items-center justify-center rounded-lg text-sm font-semibold transition-colors ${
              selected
                ? "bg-[#1877F2]/10 text-[#1877F2]"
                : "bg-secondary/60 text-muted-foreground"
            }`}>
              {selected ? "Post sélectionné" : "Cliquer pour sélectionner"}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
