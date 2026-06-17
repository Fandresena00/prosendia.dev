"use client";
/**
 * @file features/posts-comments/hooks/use-posts-comments.ts
 *
 * Central state for the posts & comments page.
 *
 * AI typing tracking:
 *   - aiTypingComments: Set<commentId> — comments where AI reply is in progress.
 *   - Added when triggerAiReply() is called.
 *   - Removed when SSE comment:replied fires for that comment.
 *   - Auto-cleared after 30s timeout to avoid stuck indicators.
 *
 * commentStats: aggregated from the current comment list for StatsSidebar.
 *
 * CHANGES IN THIS REVISION
 * ─────────────────────────────────────────────────────────────────────────
 * 1. FIX — handleAiReply() now reads the result of triggerAiReply() (the
 *    backend used to be fire-and-forget, 204, with NO feedback — a click on
 *    "IA" could silently do nothing). Now shows a toast explaining exactly
 *    why no reply was sent (no credits, spam-filtered, already replied…)
 *    instead of leaving the "IA en train de répondre…" spinner stuck.
 * 2. NEW — onCommentAiSkipped SSE handler: when the backend evaluates a
 *    comment and deliberately skips it (spam-filtered), the comment is
 *    flagged in state (aiSkipped/aiSkipReason/aiSpamScore) so CommentItem
 *    can show "IA: pas de réponse (ressemble à du spam)" instead of the
 *    page looking broken.
 * 3. NEW — hasNoConnectedPages: derived from `pages.length === 0` once the
 *    initial load completes, so the page component can render a CTA
 *    ("Connectez une page Facebook") instead of an empty, confusing UI.
 * 4. NEW — managedPostsLimit: derived from posts.length vs the active
 *    plan's maxManagedPosts (read from FacebookPage — see types). Exposed
 *    so AddPostDialog can disable "Ajouter" and explain the plan limit
 *    instead of letting the backend 400 silently.
 * 5. NEW — generateSuggestion(): calls the new ai-suggest endpoint for the
 *    "✨ Suggestion IA" button on privateReplyMessage / customInstructions.
 */

import { apiClient } from "@/lib/api-client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { CommentStats } from "../components/stats-sidebar";
import {
  addManagedPost,
  deleteManagedPost,
  generateAiSuggestion,
  getComments,
  getPageFeed,
  getPagesList,
  getPostAiConfig,
  getPosts,
  replyToCommentPublic,
  sendPrivateReply,
  syncComments,
  triggerAiReply,
  updatePostAiConfig,
} from "../services/posts-comments.service";
import type {
  ActiveTab,
  ApiComment,
  ApiPost,
  ApiPostAiConfig,
  CommentFilter,
  FacebookPage,
  FbFeedPost,
  PostAiConfigForm,
} from "../types/posts-comments.types";
import { usePostsRealtime } from "./use-posts-realtime";

// ─── Constants ────────────────────────────────────────────────────────────────

const COMMENT_PAGE_SIZE = 50;
const AI_TYPING_TIMEOUT = 30_000; // auto-clear after 30s

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePostsComments() {
  // ── Pages ──────────────────────────────────────────────────────────────────
  const [pages, setPages] = useState<FacebookPage[]>([]);
  const [activeKey, setActiveKey] = useState<string>("");
  const [pagesLoaded, setPagesLoaded] = useState(false);

  // NEW (point 6 — plan-based limits): fetched once from /billing/status,
  // which already exposes maxManagedPosts per CreditStatusDto. Used by
  // AddPostDialog to disable "Ajouter" and explain the plan limit instead
  // of letting the backend reject the request with an unexplained 400.
  const [managedPostsLimit, setManagedPostsLimit] = useState<
    { current: number; max: number | null; planName: string } | undefined
  >(undefined);

  useEffect(() => {
    apiClient<{ planName: string; maxManagedPosts: number | null }>(
      "/billing/status",
    )
      .then((status) => {
        setManagedPostsLimit({
          current: 0,
          max: status.maxManagedPosts,
          planName: status.planName,
        });
      })
      .catch(() => undefined); // non-critical — dialog just won't show the limit banner
  }, []);

  // ── Posts ──────────────────────────────────────────────────────────────────
  const [posts, setPosts] = useState<ApiPost[]>([]);
  const [selectedPost, setSelectedPost] = useState<ApiPost | null>(null);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Delete confirmation ────────────────────────────────────────────────────
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // ── Comments ───────────────────────────────────────────────────────────────
  const [comments, setComments] = useState<ApiComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentFilter, setCommentFilter] = useState<CommentFilter>("all");
  const [commentSearch, setCommentSearch] = useState("");
  const [commentPage, setCommentPage] = useState(1);
  const [commentTotal, setCommentTotal] = useState(0);
  const [syncingComments, setSyncingComments] = useState(false);

  // ── AI typing tracking ─────────────────────────────────────────────────────
  const [aiTypingComments, setAiTypingComments] = useState<Set<string>>(
    new Set(),
  );
  const aiTypingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  // ── Active tab ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ActiveTab>("comments");

  // ── Post config ────────────────────────────────────────────────────────────
  const [postConfig, setPostConfig] = useState<ApiPostAiConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  // ── Add post dialog ────────────────────────────────────────────────────────
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [feedPosts, setFeedPosts] = useState<FbFeedPost[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(false);

  // ── Reply state ────────────────────────────────────────────────────────────
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyMode, setReplyMode] = useState<"public" | "private">("public");
  const [replySending, setReplySending] = useState(false);

  // ── Real-time ──────────────────────────────────────────────────────────────
  const activePageId = pages.find((p) => p.key === activeKey)?.key;
  const selectedPostRef = useRef<ApiPost | null>(null);
  useEffect(() => {
    selectedPostRef.current = selectedPost;
  }, [selectedPost]);

  // ─── Load comments ─────────────────────────────────────────────────────────

  const loadComments = useCallback(
    async (
      postId: string,
      filter: CommentFilter = "all",
      search = "",
      page = 1,
    ) => {
      setLoadingComments(true);
      try {
        const res = await getComments(
          postId,
          page,
          COMMENT_PAGE_SIZE,
          filter,
          search,
        );
        if (page === 1) {
          setComments(res.data);
        } else {
          setComments((prev) => [...prev, ...res.data]);
        }
        setCommentTotal(res.pagination.total);
        setCommentPage(page);
      } catch {
        toast.error("Impossible de charger les commentaires.");
      } finally {
        setLoadingComments(false);
      }
    },
    [],
  );

  // ─── Select post ───────────────────────────────────────────────────────────

  const selectPost = useCallback(
    (post: ApiPost) => {
      setSelectedPost(post);
      setCommentFilter("all");
      setCommentSearch("");
      setCommentPage(1);
      setActiveTab("comments");
      setPostConfig(null);
      loadComments(post.id, "all", "", 1);
    },
    [loadComments],
  );

  // ─── AI typing helpers ────────────────────────────────────────────────────

  const markAiTyping = useCallback((commentId: string) => {
    setAiTypingComments((prev) => new Set(prev).add(commentId));
    // Auto-clear after timeout to avoid stuck indicators
    const existing = aiTypingTimers.current.get(commentId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      setAiTypingComments((prev) => {
        const next = new Set(prev);
        next.delete(commentId);
        return next;
      });
      aiTypingTimers.current.delete(commentId);
    }, AI_TYPING_TIMEOUT);
    aiTypingTimers.current.set(commentId, timer);
  }, []);

  const clearAiTyping = useCallback((commentId: string) => {
    setAiTypingComments((prev) => {
      const next = new Set(prev);
      next.delete(commentId);
      return next;
    });
    const existing = aiTypingTimers.current.get(commentId);
    if (existing) {
      clearTimeout(existing);
      aiTypingTimers.current.delete(commentId);
    }
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      aiTypingTimers.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  // ─── SSE real-time handlers ────────────────────────────────────────────────

  usePostsRealtime(activePageId ?? null, {
    onCommentAdded: (comment) => {
      const cur = selectedPostRef.current;
      if (!cur || comment.postId !== cur.id) return;
      setComments((prev) => {
        if (
          prev.some(
            (c) => c.id === comment.id || c.externalId === comment.externalId,
          )
        )
          return prev;
        return [comment, ...prev];
      });
      setCommentTotal((t) => t + 1);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === comment.postId
            ? {
                ...p,
                commentsCount: p.commentsCount + 1,
                _count: {
                  comments: (p._count?.comments ?? p.commentsCount) + 1,
                },
              }
            : p,
        ),
      );
    },

    onCommentReplied: (_postId, commentId, reply) => {
      clearAiTyping(commentId);
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? {
                ...c,
                isReplied: true,
                replyContent: reply.content,
                repliedAt: new Date().toISOString(),
                repliedByAi: reply.repliedByAi,
                aiSkipped: false,
                aiSkipReason: null,
              }
            : c,
        ),
      );
    },

    // NEW: backend deliberately chose NOT to reply (e.g. spam-filtered).
    // Without this, users see a comment sit unanswered with no explanation
    // and conclude "l'IA ne marche pas".
    onCommentAiSkipped: (_postId, commentId, info) => {
      clearAiTyping(commentId);
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? {
                ...c,
                aiSkipped: true,
                aiSkipReason: info.reason,
                aiSpamScore: info.spamScore ?? c.aiSpamScore ?? null,
              }
            : c,
        ),
      );
    },

    onPostUpdated: (postId, updates) => {
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, ...updates } : p)),
      );
      setSelectedPost((prev) =>
        prev?.id === postId ? ({ ...prev, ...updates } as ApiPost) : prev,
      );
    },

    onSyncCompleted: () => {
      // Scheduler finished — reload comments for the active post
      if (selectedPostRef.current) {
        void loadComments(
          selectedPostRef.current.id,
          commentFilter,
          commentSearch,
          1,
        );
      }
    },
  });

  // ─── Load pages ────────────────────────────────────────────────────────────

  useEffect(() => {
    getPagesList()
      .then((list) => {
        setPages(list);
        if (list.length > 0) setActiveKey(list[0].key);
      })
      .catch(() => toast.error("Impossible de charger les pages Facebook."))
      .finally(() => setPagesLoaded(true));
  }, []);

  // ─── Load posts when page changes ─────────────────────────────────────────

  useEffect(() => {
    if (!activeKey) return;
    setLoadingPosts(true);
    setSelectedPost(null);
    setComments([]);

    getPosts(activeKey)
      .then((res) => {
        setPosts(res.data);
        if (res.data.length > 0) selectPost(res.data[0]);
      })
      .catch(() => toast.error("Impossible de charger les posts."))
      .finally(() => setLoadingPosts(false));
  }, [activeKey, selectPost]);

  // ─── Load config when tab switches to config ───────────────────────────────

  useEffect(() => {
    if (activeTab !== "config" || !selectedPost?.id || postConfig) return;
    setLoadingConfig(true);
    getPostAiConfig(selectedPost.id)
      .then(setPostConfig)
      .catch(() => setConfigError("Impossible de charger la configuration."))
      .finally(() => setLoadingConfig(false));
  }, [activeTab, selectedPost?.id, postConfig, selectedPost]);

  // ─── Sync comments ─────────────────────────────────────────────────────────

  const handleSyncComments = useCallback(async () => {
    if (!selectedPost) return;
    setSyncingComments(true);
    try {
      const { synced } = await syncComments(selectedPost.id);
      await loadComments(selectedPost.id, commentFilter, commentSearch, 1);
      if (synced > 0)
        toast.success(
          `${synced} nouveau${synced > 1 ? "x" : ""} commentaire${synced > 1 ? "s" : ""} synchronisé${synced > 1 ? "s" : ""}.`,
        );
    } catch {
      toast.error("Erreur lors de la synchronisation.");
    } finally {
      setSyncingComments(false);
    }
  }, [selectedPost, commentFilter, commentSearch, loadComments]);

  // ─── Filter / search ───────────────────────────────────────────────────────

  const handleFilterChange = useCallback(
    (f: CommentFilter) => {
      setCommentFilter(f);
      if (selectedPost) loadComments(selectedPost.id, f, commentSearch, 1);
    },
    [selectedPost, commentSearch, loadComments],
  );

  const handleSearchChange = useCallback(
    (s: string) => {
      setCommentSearch(s);
      if (selectedPost) loadComments(selectedPost.id, commentFilter, s, 1);
    },
    [selectedPost, commentFilter, loadComments],
  );

  const loadNextPage = useCallback(() => {
    if (!selectedPost) return;
    loadComments(
      selectedPost.id,
      commentFilter,
      commentSearch,
      commentPage + 1,
    );
  }, [selectedPost, commentFilter, commentSearch, commentPage, loadComments]);

  // ─── Replies ───────────────────────────────────────────────────────────────

  const startReply = useCallback((commentId: string) => {
    setReplyingToId(commentId);
    setReplyText("");
    setReplyMode("public");
  }, []);

  const cancelReply = useCallback(() => {
    setReplyingToId(null);
    setReplyText("");
  }, []);

  const submitReply = useCallback(async () => {
    if (!replyingToId || !replyText.trim()) return;
    setReplySending(true);
    try {
      if (replyMode === "private") {
        await sendPrivateReply(replyingToId, replyText.trim());
      } else {
        await replyToCommentPublic(replyingToId, replyText.trim());
      }
      setComments((prev) =>
        prev.map((c) =>
          c.id === replyingToId
            ? {
                ...c,
                isReplied: true,
                replyContent: replyText.trim(),
                repliedAt: new Date().toISOString(),
                repliedByAi: false,
              }
            : c,
        ),
      );
      cancelReply();
      toast.success(
        replyMode === "private" ? "Message privé envoyé." : "Réponse publiée.",
      );
    } catch {
      toast.error("Erreur lors de l'envoi.");
    } finally {
      setReplySending(false);
    }
  }, [replyingToId, replyText, replyMode, cancelReply]);

  const handleAiReply = useCallback(
    async (commentId: string) => {
      markAiTyping(commentId);
      try {
        const result = await triggerAiReply(commentId);

        if (result.success) {
          // SSE onCommentReplied normally arrives first and already updates
          // the UI; this toast confirms it explicitly (rule-based replies
          // are instant and don't need an SSE round-trip to feel responsive).
          clearAiTyping(commentId);
          toast.success(
            result.ruleMatched
              ? "Réponse envoyée via une règle automatique (0 crédit)."
              : "Réponse IA envoyée.",
          );
        } else {
          // FIX: previously this branch didn't exist — a non-2xx-but-200
          // "skipped" result (autoReply off, spam-filtered, no credits,
          // already replied…) was silently swallowed, leaving the spinner
          // to time out after 30s with no explanation.
          clearAiTyping(commentId);
          toast.error(
            result.message ?? "L'IA n'a pas répondu à ce commentaire.",
          );
          if (
            result.reason === "spam_filtered" &&
            typeof result.spamScore === "number"
          ) {
            setComments((prev) =>
              prev.map((c) =>
                c.id === commentId
                  ? {
                      ...c,
                      aiSkipped: true,
                      aiSkipReason: result.reason,
                      aiSpamScore: result.spamScore,
                    }
                  : c,
              ),
            );
          }
        }
      } catch {
        clearAiTyping(commentId);
        toast.error("Impossible de déclencher la réponse IA.");
      }
    },
    [markAiTyping, clearAiTyping],
  );

  // ─── AI suggestion (config field helper) ───────────────────────────────────

  const [suggestingField, setSuggestingField] = useState<
    "privateReplyMessage" | "customInstructions" | null
  >(null);

  /**
   * Calls the AI suggestion endpoint for a single config field, taking its
   * current content into account. Consumes credits — same as any other AI
   * call. Returns the suggestion text so the caller (PostConfigPanel) can
   * insert it into the form; does NOT save automatically, so the user can
   * still review/edit before hitting "Enregistrer".
   */
  const generateSuggestion = useCallback(
    async (
      field: "privateReplyMessage" | "customInstructions",
      currentValue: string,
    ): Promise<string | null> => {
      if (!selectedPost) return null;
      setSuggestingField(field);
      try {
        const result = await generateAiSuggestion(
          selectedPost.id,
          field,
          currentValue,
        );
        toast.success(
          result.creditsUsed > 0
            ? `Suggestion générée (${result.creditsUsed} crédit${result.creditsUsed > 1 ? "s" : ""} utilisé${result.creditsUsed > 1 ? "s" : ""}).`
            : "Suggestion générée.",
        );
        return result.suggestion;
      } catch {
        toast.error("Impossible de générer une suggestion IA.");
        return null;
      } finally {
        setSuggestingField(null);
      }
    },
    [selectedPost],
  );

  // ─── Post config save ──────────────────────────────────────────────────────

  const saveConfig = useCallback(
    async (form: Partial<PostAiConfigForm>) => {
      if (!selectedPost) return;
      setSavingConfig(true);
      setConfigError(null);
      try {
        const updated = await updatePostAiConfig(selectedPost.id, form);
        setPostConfig(updated);
        // Reflect autoReply change in posts list
        setPosts((prev) =>
          prev.map((p) =>
            p.id === selectedPost.id ? { ...p, postAiConfig: updated } : p,
          ),
        );
        setSelectedPost((prev) =>
          prev?.id === selectedPost.id
            ? { ...prev, postAiConfig: updated }
            : prev,
        );
        toast.success("Configuration enregistrée.");
      } catch {
        setConfigError("Impossible d'enregistrer la configuration.");
      } finally {
        setSavingConfig(false);
      }
    },
    [selectedPost],
  );

  // ─── Add post ──────────────────────────────────────────────────────────────

  const openAddDialog = useCallback(async () => {
    setAddDialogOpen(true);
    if (!activeKey) return;
    setLoadingFeed(true);
    try {
      const feed = await getPageFeed(activeKey, 25);
      setFeedPosts(feed);
    } catch {
      toast.error("Impossible de charger le fil de la page.");
    } finally {
      setLoadingFeed(false);
    }
  }, [activeKey]);

  const handleAddPost = useCallback(
    async (feedPost: FbFeedPost) => {
      if (!activeKey) return;
      try {
        const created = await addManagedPost({
          businessProfileId: activeKey,
          externalId: feedPost.externalId,
          message: feedPost.message,
          imageUrl: feedPost.imageUrl,
          permalinkUrl: feedPost.permalinkUrl,
          reactionsCount: feedPost.reactionsCount,
          commentsCount: feedPost.commentsCount,
          sharesCount: feedPost.sharesCount,
          publishedAt: feedPost.publishedAt,
        });
        setPosts((prev) => [created, ...prev]);
        setFeedPosts((prev) =>
          prev.map((p) =>
            p.externalId === feedPost.externalId
              ? { ...p, alreadyAdded: true }
              : p,
          ),
        );
        selectPost(created);
        toast.success("Post ajouté à la gestion.");
      } catch {
        toast.error("Impossible d'ajouter ce post.");
      }
    },
    [activeKey, selectPost],
  );

  // ─── Delete post ───────────────────────────────────────────────────────────

  const requestDeletePost = useCallback((postId: string) => {
    setConfirmDeleteId(postId);
  }, []);

  const cancelDeletePost = useCallback(() => {
    setConfirmDeleteId(null);
  }, []);

  const confirmDeletePost = useCallback(async () => {
    const postId = confirmDeleteId;
    if (!postId || !activeKey) return;
    setConfirmDeleteId(null);
    setDeletingId(postId);
    try {
      await deleteManagedPost(postId, activeKey);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      if (selectedPost?.id === postId) {
        const nextPost = posts.find((p) => p.id !== postId) ?? null;
        setSelectedPost(nextPost);
        if (nextPost) {
          loadComments(nextPost.id, "all", "", 1);
        } else {
          setComments([]);
        }
      }
      toast.success("Post retiré de la gestion.");
    } catch {
      toast.error("Impossible de supprimer ce post.");
    } finally {
      setDeletingId(null);
    }
  }, [confirmDeleteId, activeKey, selectedPost?.id, posts, loadComments]);

  // ─── Comment stats ─────────────────────────────────────────────────────────

  const commentStats: CommentStats = useMemo(() => {
    const total = commentTotal;
    const repliedByAi = comments.filter(
      (c) => c.isReplied && c.repliedByAi === true,
    ).length;
    const repliedByHuman = comments.filter(
      (c) => c.isReplied && c.repliedByAi === false,
    ).length;
    const unanswered = comments.filter((c) => !c.isReplied).length;
    // Estimate DM count from posts with privateReplyEnabled
    const withPrivateDm = posts
      .filter((p) => p.postAiConfig?.privateReplyEnabled)
      .reduce((sum, p) => sum + (p._count?.comments ?? p.commentsCount), 0);
    return { total, repliedByAi, repliedByHuman, unanswered, withPrivateDm };
  }, [comments, commentTotal, posts]);

  // ─── Active page ───────────────────────────────────────────────────────────

  const activePage = pages.find((p) => p.key === activeKey) ?? null;
  const autoReplyCount = posts.filter((p) => p.postAiConfig?.autoReply).length;

  // NEW (point 5 / CTA): true once the initial pages load has completed AND
  // confirmed there are zero connected Facebook pages. The page component
  // uses this to render a "Connectez votre page Facebook" CTA instead of an
  // empty, confusing posts/comments UI.
  const hasNoConnectedPages = pagesLoaded && pages.length === 0;

  // Keep the plan-limit "current" count in sync with the managed posts
  // actually loaded for the active page (point 6).
  useEffect(() => {
    setManagedPostsLimit((prev) =>
      prev ? { ...prev, current: posts.length } : prev,
    );
  }, [posts.length]);

  return {
    // Pages
    pages,
    activeKey,
    setActiveKey,
    activePage,
    pagesLoaded,
    hasNoConnectedPages,
    managedPostsLimit,
    // Posts
    posts,
    selectedPost,
    loadingPosts,
    deletingId,
    confirmDeleteId,
    requestDeletePost,
    cancelDeletePost,
    confirmDeletePost,
    selectPost,
    // Add post
    addDialogOpen,
    setAddDialogOpen,
    feedPosts,
    loadingFeed,
    openAddDialog,
    handleAddPost,
    // Comments
    comments,
    loadingComments,
    commentFilter,
    commentSearch,
    commentPage,
    commentTotal,
    syncingComments,
    handleFilterChange,
    handleSearchChange,
    handleSyncComments,
    loadNextPage,
    // AI typing
    aiTypingComments,
    // Reply
    replyingToId,
    replyText,
    replyMode,
    replySending,
    startReply,
    cancelReply,
    setReplyText,
    setReplyMode,
    submitReply,
    handleAiReply,
    // Config
    activeTab,
    setActiveTab,
    postConfig,
    loadingConfig,
    savingConfig,
    configError,
    saveConfig,
    autoReplyCount,
    autoReplyLimitReached: autoReplyCount >= 10,
    // AI suggestion
    suggestingField,
    generateSuggestion,
    // Stats
    commentStats,
  };
}
