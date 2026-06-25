"use client";
/**
 * @file features/posts-comments/components/add-post-dialog.tsx
 *
 * REDESIGN (June 2026)
 * ────────────────────
 * Objectifs : clarté, hiérarchie visuelle forte, sélection évidente.
 *
 * Changements vs version précédente :
 * 1. Layout deux colonnes sur desktop (feed gauche | aperçu droit) — évite
 *    le scroll interminable et permet de voir l'image en plein format.
 * 2. Feed cards plus compactes : une ligne, pas de bouton CTA redondant,
 *    radio-style selection avec anneau bleu.
 * 3. Aperçu droit : montre l'image en grand, la légende complète, les stats
 *    d'engagement, et un call-to-action "Ajouter" bien visible.
 * 4. État "déjà ajouté" clairement indiqué avec badge + opacité réduite.
 * 5. Mobile : layout colonne unique, header compact, feed scrollable.
 * 6. Plan limit banner inchangé dans le header.
 * 7. Recherche dans le feed — filtre temps réel.
 * 8. Props alignées sur l'interface attendue par posts-comments.page.tsx.
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  IconAlertTriangle,
  IconBrandFacebook,
  IconCheck,
  IconMessage,
  IconPhoto,
  IconSearch,
  IconSparkles,
  IconThumbUp,
  IconX,
} from "@tabler/icons-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import Image from "next/image";
import { useState } from "react";
import type { FacebookPage, FbFeedPost } from "../types/posts-comments.types";

// ─── Props ────────────────────────────────────────────────────────────────────

interface AddPostDialogProps {
  open: boolean;
  feedPosts: FbFeedPost[];
  feedLoading: boolean;
  adding: boolean;
  activePage: FacebookPage | null;
  onClose: () => void;
  onAdd: (post: FbFeedPost) => Promise<void>;
  managedPostsLimit?: {
    current: number;
    max: number | null;
    planName: string;
  };
}

// ─── Thumbnail ─────────────────────────────────────────────────────────────

function PostThumbnail({ src, fill }: { src: string; fill?: boolean }) {
  const [error, setError] = useState(false);
  if (error) return null;
  if (fill) {
    return (
      <Image
        src={src}
        alt=""
        fill
        sizes="(max-width: 768px) 100vw, 50vw"
        className="object-cover"
        unoptimized
        onError={() => setError(true)}
      />
    );
  }
  return (
    <Image
      src={src}
      alt=""
      width={56}
      height={56}
      className="object-cover w-full h-full"
      unoptimized
      onError={() => setError(true)}
    />
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AddPostDialog({
  open,
  feedPosts,
  feedLoading,
  adding: _adding,
  activePage,
  onClose,
  onAdd,
  managedPostsLimit,
}: AddPostDialogProps) {
  const [selected, setSelected] = useState<FbFeedPost | null>(null);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");

  const isLimitReached =
    !!managedPostsLimit &&
    managedPostsLimit.max !== null &&
    managedPostsLimit.current >= managedPostsLimit.max;

  const filtered = feedPosts.filter(
    (p) =>
      !search.trim() ||
      (p.message ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  const handleClose = () => {
    if (adding) return;
    setSelected(null);
    setSearch("");
    onClose();
  };

  const handleAdd = async () => {
    if (!selected || selected.alreadyAdded || isLimitReached || adding) return;
    setAdding(true);
    try {
      await onAdd(selected);
      setSelected(null);
      setSearch("");
    } finally {
      setAdding(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-5">
      <div
        className="flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border/50 bg-background shadow-2xl"
        style={{ maxHeight: "min(92vh, 760px)" }}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="shrink-0 border-b border-border/40 px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1877F2]/10">
                <IconBrandFacebook className="h-5 w-5 text-[#1877F2]" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold tracking-tight leading-tight">
                  Ajouter un post à gérer
                </h2>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  {activePage
                    ? `Publications de « ${activePage.name} »`
                    : "Chargement de la page…"}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              disabled={adding}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
              aria-label="Fermer"
            >
              <IconX className="h-4 w-4" />
            </button>
          </div>

          {/* Plan limit banner */}
          {isLimitReached && managedPostsLimit && (
            <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/8 px-3.5 py-2.5">
              <IconAlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-700">
                  Limite du plan {managedPostsLimit.planName} atteinte (
                  {managedPostsLimit.current}/{managedPostsLimit.max})
                </p>
                <p className="text-[10px] text-amber-600/80 mt-0.5 leading-relaxed">
                  Retirez un post géré existant, ou passez à un abonnement
                  supérieur pour en gérer davantage.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Body: two columns on md+, single column on mobile ──────── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left: feed list */}
          <div className="flex flex-col w-full md:w-[360px] md:shrink-0 border-r border-border/40 min-h-0">
            {/* Search */}
            <div className="shrink-0 px-3 py-3 border-b border-border/30">
              <div className="relative">
                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher dans les posts…"
                  className="pl-9 h-8 text-xs bg-secondary/40 border-0 rounded-full focus-visible:ring-1 focus-visible:ring-primary/50"
                />
              </div>
            </div>

            <ScrollArea className="flex-1 min-h-0">
              <div className="p-2 space-y-1">
                {feedLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 rounded-xl" />
                  ))
                ) : filtered.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8 px-4">
                    {feedPosts.length === 0
                      ? "Aucun post trouvé sur cette page Facebook."
                      : "Aucun résultat pour cette recherche."}
                  </p>
                ) : (
                  filtered.map((post) => (
                    <FeedRow
                      key={post.externalId}
                      post={post}
                      selected={selected?.externalId === post.externalId}
                      disabled={isLimitReached}
                      onSelect={() => {
                        if (!post.alreadyAdded && !adding && !isLimitReached) {
                          setSelected(post);
                        }
                      }}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Right: preview (hidden on mobile — shown inline instead) */}
          <div className="hidden md:flex flex-col flex-1 min-h-0 min-w-0">
            {selected ? (
              <PostPreview
                post={selected}
                onAdd={handleAdd}
                adding={adding}
                isLimitReached={isLimitReached}
              />
            ) : (
              <EmptyPreview />
            )}
          </div>
        </div>

        {/* ── Mobile footer: shown only on small screens ─────────────── */}
        <div className="md:hidden shrink-0 border-t border-border/40 bg-background/95 px-4 py-3">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="flex-1 h-9 text-xs"
              onClick={handleClose}
              disabled={adding}
            >
              Annuler
            </Button>
            <Button
              className="flex-1 h-9 gap-1.5 rounded-full bg-[#1877F2] text-xs font-semibold hover:bg-[#166FE5]"
              disabled={
                !selected || selected.alreadyAdded || adding || isLimitReached
              }
              onClick={handleAdd}
            >
              {adding ? (
                <>
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-transparent border-t-current animate-spin" />
                  Ajout…
                </>
              ) : isLimitReached ? (
                "Limite atteinte"
              ) : (
                <>
                  <IconSparkles className="h-3.5 w-3.5" />
                  Ajouter
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Feed row (compact) ───────────────────────────────────────────────────────

function FeedRow({
  post,
  selected,
  disabled,
  onSelect,
}: {
  post: FbFeedPost;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  const timeAgo = formatDistanceToNow(new Date(post.publishedAt), {
    addSuffix: true,
    locale: fr,
  });

  const isDisabled = post.alreadyAdded || disabled;

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={onSelect}
      className={`w-full flex items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-all ${
        post.alreadyAdded
          ? "opacity-50 cursor-not-allowed"
          : disabled
            ? "opacity-40 cursor-not-allowed"
            : selected
              ? "bg-[#1877F2]/8 ring-1 ring-[#1877F2]/40"
              : "hover:bg-secondary/60 cursor-pointer"
      }`}
    >
      {/* Thumbnail */}
      <div className="relative h-11 w-11 shrink-0 rounded-lg overflow-hidden bg-secondary/60">
        {post.imageUrl ? (
          <PostThumbnail src={post.imageUrl} />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <IconPhoto className="h-4 w-4 text-muted-foreground/40" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium leading-snug line-clamp-2 text-foreground">
          {post.message ?? (
            <span className="italic text-muted-foreground">Pas de légende</span>
          )}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-muted-foreground">{timeAgo}</span>
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <IconThumbUp className="h-2.5 w-2.5" />
            {post.reactionsCount}
          </span>
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <IconMessage className="h-2.5 w-2.5" />
            {post.commentsCount}
          </span>
        </div>
      </div>

      {/* State indicator */}
      <div className="shrink-0 mt-0.5">
        {post.alreadyAdded ? (
          <Badge
            variant="secondary"
            className="text-[9px] h-4 px-1.5 bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
          >
            Géré
          </Badge>
        ) : selected ? (
          <div className="h-5 w-5 rounded-full bg-[#1877F2] flex items-center justify-center">
            <IconCheck className="h-3 w-3 text-white" />
          </div>
        ) : (
          <div className="h-5 w-5 rounded-full border-2 border-border/50" />
        )}
      </div>
    </button>
  );
}

// ─── Post preview (right panel) ───────────────────────────────────────────────

function PostPreview({
  post,
  onAdd,
  adding,
  isLimitReached,
}: {
  post: FbFeedPost;
  onAdd: () => void;
  adding: boolean;
  isLimitReached: boolean;
}) {
  const timeAgo = formatDistanceToNow(new Date(post.publishedAt), {
    addSuffix: true,
    locale: fr,
  });

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-5 space-y-4">
          {/* Post header */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-[#1877F2]/10 flex items-center justify-center shrink-0">
              <IconBrandFacebook className="h-5 w-5 text-[#1877F2]" />
            </div>
            <div>
              <p className="text-xs font-semibold leading-tight">
                Publication Facebook
              </p>
              <p className="text-[10px] text-muted-foreground">{timeAgo}</p>
            </div>
          </div>

          {/* Caption */}
          {post.message && (
            <p className="text-[13px] leading-relaxed text-foreground whitespace-pre-wrap">
              {post.message}
            </p>
          )}

          {/* Image */}
          {post.imageUrl && (
            <div className="relative rounded-xl overflow-hidden aspect-[1.7/1] bg-secondary/40">
              <PostThumbnail src={post.imageUrl} fill />
            </div>
          )}

          {/* Engagement stats */}
          <div className="flex items-center gap-4 py-2.5 border-y border-border/40">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <IconThumbUp className="h-4 w-4" />
              <span className="font-semibold text-foreground">
                {post.reactionsCount}
              </span>
              <span>réaction{post.reactionsCount !== 1 ? "s" : ""}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <IconMessage className="h-4 w-4" />
              <span className="font-semibold text-foreground">
                {post.commentsCount}
              </span>
              <span>commentaire{post.commentsCount !== 1 ? "s" : ""}</span>
            </div>
          </div>

          {/* What VendeoAI will do */}
          <div className="rounded-xl border border-primary/15 bg-primary/5 px-4 py-3 space-y-2">
            <p className="text-[11px] font-bold text-primary uppercase tracking-wider">
              Ce qui sera activé
            </p>
            <ul className="space-y-1.5">
              {[
                "Surveillance des nouveaux commentaires",
                "Réponses automatiques par IA (configurable)",
                "Synchronisation en temps réel via webhook",
                "Statistiques d'engagement",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-[11px] text-muted-foreground"
                >
                  <IconCheck className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </ScrollArea>

      {/* CTA */}
      <div className="shrink-0 border-t border-border/40 p-4">
        {post.alreadyAdded ? (
          <div className="flex items-center justify-center h-10 rounded-xl bg-emerald-500/10 text-sm font-semibold text-emerald-700 gap-2">
            <IconCheck className="h-4 w-4" />
            Ce post est déjà géré
          </div>
        ) : (
          <Button
            className="w-full h-10 gap-2 rounded-xl bg-[#1877F2] font-semibold hover:bg-[#166FE5]"
            disabled={adding || isLimitReached}
            onClick={onAdd}
          >
            {adding ? (
              <>
                <span className="h-4 w-4 rounded-full border-2 border-transparent border-t-current animate-spin" />
                Ajout en cours…
              </>
            ) : isLimitReached ? (
              "Limite de plan atteinte"
            ) : (
              <>
                <IconSparkles className="h-4 w-4" />
                Ajouter ce post à la gestion
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Empty preview state ──────────────────────────────────────────────────────

function EmptyPreview() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8 text-muted-foreground">
      <div className="h-12 w-12 rounded-2xl bg-secondary flex items-center justify-center">
        <IconBrandFacebook className="h-6 w-6 text-muted-foreground/50" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">
          Sélectionnez un post
        </p>
        <p className="text-xs mt-1 leading-relaxed">
          Cliquez sur une publication dans la liste pour voir son aperçu et
          l&apos;ajouter à la gestion.
        </p>
      </div>
    </div>
  );
}
