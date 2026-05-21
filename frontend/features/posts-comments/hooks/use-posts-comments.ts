"use client";
/**
 * @file features/posts-comments/hooks/use-posts-comments.ts
 *
 * FIXES IN THIS VERSION
 * ─────────────────────
 * 1. BUG FIX — stale closure in onSyncCompleted
 *    `loadCommentsFn` was captured at hook creation time (empty deps []).
 *    When `selectedPostId` changed, the closure still called the OLD version.
 *    Fix: `loadCommentsRef` always points to the latest `loadCommentsFn`.
 *
 * 2. BUG FIX — comment author "Anonyme" duplicates
 *    `onCommentAdded` deduplication only checked `c.id`. If a comment arrived
 *    via SSE before the initial `loadComments` completed, it was prepended
 *    with whatever data the SSE had. On reload, the DB version appeared too.
 *    Fix: deduplicate by BOTH `id` AND `externalId`.
 *
 * 3. REAL-TIME — no manual page refresh needed
 *    All four SSE event types now update React state immediately:
 *    • comment:new      → prepend to list (dedup by id + externalId)
 *    • comment:replied  → update inline (no full reload needed)
 *    • post:updated     → update post card stats inline
 *    • sync:completed   → reload comments via fresh ref (not stale closure)
 *
 * 4. businessProfileId FIX — use `activePage?.key` (has pages[0] fallback)
 *    instead of raw `activePageKey` which starts as "".
 */

import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "../services/posts-comments.service";
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

const MAX_AUTO_REPLY = 10;

export function usePostsComments() {
  // ── Pages ──────────────────────────────────────────────────────────────────
  const [pages, setPages] = useState<FacebookPage[]>([]);
  const [pagesLoading, setPagesLoading] = useState(true);
  const [pagesError, setPagesError] = useState<string | null>(null);
  const [activePageKey, setActivePageKey] = useState<string>("");

  // FIX: businessProfileId from activePage?.key has a fallback to pages[0].
  // Raw activePageKey starts as "" which fails backend @IsNotEmpty() validation.
  const activePage =
    pages.find((p) => p.key === activePageKey) ?? pages[0] ?? null;
  const businessProfileId = activePage?.key ?? null;

  // ── Posts ──────────────────────────────────────────────────────────────────
  const [posts, setPosts] = useState<ApiPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [postSearch, setPostSearch] = useState("");

  const autoReplyCount = posts.filter((p) => p.postAiConfig?.autoReply).length;
  const autoReplyLimitReached = autoReplyCount >= MAX_AUTO_REPLY;

  // ── Selected post ──────────────────────────────────────────────────────────
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const selectedPost = posts.find((p) => p.id === selectedPostId) ?? null;
  const [activeTab, setActiveTab] = useState<ActiveTab>("comments");

  // ── Comments ───────────────────────────────────────────────────────────────
  const [comments, setComments] = useState<ApiComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentFilter, setCommentFilter] = useState<CommentFilter>("all");
  const [commentSearch, setCommentSearch] = useState("");
  const [commentPage, setCommentPage] = useState(1);
  const [commentTotal, setCommentTotal] = useState(0);
  const [isSyncingComments, setIsSyncingComments] = useState(false);

  // ── Config ─────────────────────────────────────────────────────────────────
  const [postAiConfig, setPostAiConfig] = useState<ApiPostAiConfig | null>(
    null,
  );
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  // ── Reply ──────────────────────────────────────────────────────────────────
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [replyMode, setReplyMode] = useState<"public" | "private">("public");

  // ── Add / delete post ──────────────────────────────────────────────────────
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [feedPosts, setFeedPosts] = useState<FbFeedPost[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [addingPost, setAddingPost] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);

  const didInit = useRef(false);

  // ── Refs for stable SSE callbacks ──────────────────────────────────────────
  // These refs always point to the latest values, preventing stale closures
  // in usePostsRealtime handlers (which are created once with [] deps).
  const selectedPostIdRef = useRef<string | null>(null);
  const activePageRef = useRef<FacebookPage | null>(null);
  const loadCommentsRef = useRef<(page?: number) => Promise<void>>(
    async () => {},
  );

  selectedPostIdRef.current = selectedPostId;
  activePageRef.current = activePage;

  // ── Load pages on mount ────────────────────────────────────────────────────
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    void loadPages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPages = useCallback(async () => {
    setPagesLoading(true);
    setPagesError(null);
    try {
      const list = await api.getPagesList();
      setPages(list);
      if (list.length > 0) setActivePageKey(list[0].key);
    } catch {
      setPagesError("Impossible de charger les pages Facebook.");
    } finally {
      setPagesLoading(false);
    }
  }, []);

  // ── Load posts when active page changes ───────────────────────────────────
  useEffect(() => {
    if (!activePageKey) return;
    setSelectedPostId(null);
    setComments([]);
    setCommentSearch("");
    setCommentFilter("all");
    void loadPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePageKey]);

  const loadPosts = useCallback(async () => {
    if (!businessProfileId) return;
    setPostsLoading(true);
    setPostsError(null);
    try {
      const result = await api.getPosts(
        businessProfileId,
        1,
        50,
        postSearch || undefined,
      );
      setPosts(result.data);
      if (result.data.length > 0 && !selectedPostId) {
        setSelectedPostId(result.data[0].id);
      }
    } catch {
      setPostsError("Impossible de charger les posts.");
    } finally {
      setPostsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessProfileId, postSearch]);

  // ── Load comments + config when post selected ─────────────────────────────
  useEffect(() => {
    if (!selectedPostId) return;
    setComments([]);
    void loadComments(1);
    void loadPostAiConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPostId, commentFilter, commentSearch]);

  const loadComments = useCallback(
    async (page = 1) => {
      if (!selectedPostId) return;
      setCommentsLoading(true);
      try {
        const result = await api.getComments(
          selectedPostId,
          page,
          50,
          commentFilter === "all" ? undefined : commentFilter,
          commentSearch || undefined,
        );
        setComments(
          page === 1 ? result.data : (prev) => [...prev, ...result.data],
        );
        setCommentPage(page);
        setCommentTotal(result.pagination.total);
      } catch {
        // silent
      } finally {
        setCommentsLoading(false);
      }
    },
    [selectedPostId, commentFilter, commentSearch],
  );

  // FIX: keep ref in sync so SSE handlers always call the latest version.
  // This prevents the stale closure bug in onSyncCompleted.
  useEffect(() => {
    loadCommentsRef.current = loadComments;
  }, [loadComments]);

  const loadPostAiConfig = useCallback(async () => {
    if (!selectedPostId) return;
    setConfigLoading(true);
    setPostAiConfig(null);
    try {
      setPostAiConfig(await api.getPostAiConfig(selectedPostId));
    } catch {
      // created on first save
    } finally {
      setConfigLoading(false);
    }
  }, [selectedPostId]);

  // ── Real-time SSE integration ──────────────────────────────────────────────

  const { connected: realtimeConnected } = usePostsRealtime(businessProfileId, {
    /**
     * comment:new — prepend the new comment to the active post's list.
     *
     * FIX: deduplicate by BOTH `id` AND `externalId`.
     * The same comment can arrive via:
     *   a) SSE from processNewComment (has DB id)
     *   b) SSE from scheduler sync (has DB id after create)
     *   c) Frontend full reload after sync:completed
     * Without externalId dedup, two records for the same FB comment could
     * appear — one with the correct author name (from DB), one with 'Anonyme'.
     */
    onCommentAdded: useCallback((comment: ApiComment) => {
      if (comment.postId !== selectedPostIdRef.current) return;

      setComments((prev) => {
        const duplicate = prev.some(
          (c) => c.id === comment.id || c.externalId === comment.externalId,
        );
        if (duplicate) return prev;
        return [comment, ...prev];
      });

      setCommentTotal((n) => n + 1);

      // Update commentsCount on the post card immediately
      setPosts((prev) =>
        prev.map((p) =>
          p.id === comment.postId
            ? {
                ...p,
                commentsCount: p.commentsCount + 1,
                _count: p._count
                  ? { ...p._count, comments: p._count.comments + 1 }
                  : undefined,
              }
            : p,
        ),
      );
    }, []),

    /**
     * comment:replied — update the comment inline without a full reload.
     * This is the key event for "no manual refresh" — as soon as the AI
     * or the human replies, the comment shows the reply immediately.
     */
    onCommentReplied: useCallback(
      (
        _postId: string,
        commentId: string,
        reply: { content: string; repliedByAi: boolean },
      ) => {
        setComments((prev) =>
          prev.map((c) =>
            c.id === commentId
              ? {
                  ...c,
                  isReplied: true,
                  replyContent: reply.content,
                  repliedAt: new Date().toISOString(),
                  repliedByAi: reply.repliedByAi,
                  replies: c.replies?.some((r) => r.message === reply.content)
                    ? c.replies
                    : [
                        ...(c.replies ?? []),
                        {
                          id: `local-${commentId}-${Date.now()}`,
                          externalId: `local-${commentId}-${Date.now()}`,
                          authorId: activePageRef.current?.pageId ?? "page",
                          authorName:
                            activePageRef.current?.name ?? "Votre page",
                          authorAvatarUrl: null,
                          message: reply.content,
                          commentedAt: new Date().toISOString(),
                          isPageReply: true,
                          repliedByAi: reply.repliedByAi,
                        },
                      ],
                }
              : c,
          ),
        );
      },
      [],
    ),

    /**
     * post:updated — update post card metadata (commentsCount, etc.) inline.
     * Scheduler emits this after syncing new comments for a post.
     */
    onPostUpdated: useCallback(
      (postId: string, updates: Record<string, unknown>) => {
        setPosts((prev) =>
          prev.map((p) => (p.id === postId ? { ...p, ...updates } : p)),
        );
      },
      [],
    ),

    /**
     * sync:completed — scheduler finished a full sync cycle.
     * FIX: use `loadCommentsRef.current` (always latest) instead of
     * capturing `loadComments` in a closure at creation time (stale).
     *
     * This triggers a fresh load of comments for the selected post,
     * ensuring the user sees any updates the scheduler found.
     */
    onSyncCompleted: useCallback(() => {
      if (selectedPostIdRef.current) {
        void loadCommentsRef.current?.(1);
      }
    }, []), // stable — refs never go stale
  });

  // ── Sync comments manually ─────────────────────────────────────────────────
  const syncComments = useCallback(async () => {
    if (!selectedPostId) return;
    setIsSyncingComments(true);
    try {
      await api.syncComments(selectedPostId);
      await loadComments(1);
    } finally {
      setIsSyncingComments(false);
    }
  }, [selectedPostId, loadComments]);

  // ── Add post dialog ────────────────────────────────────────────────────────
  const openAddDialog = useCallback(async () => {
    if (!businessProfileId) return;
    setAddDialogOpen(true);
    setFeedLoading(true);
    try {
      setFeedPosts(await api.getPageFeed(businessProfileId, 30));
    } catch {
      setFeedPosts([]);
    } finally {
      setFeedLoading(false);
    }
  }, [businessProfileId]);

  const addPost = useCallback(
    async (post: FbFeedPost) => {
      if (!businessProfileId) return;
      setAddingPost(true);
      try {
        const created = await api.addManagedPost({
          businessProfileId,
          externalId: post.externalId,
          message: post.message,
          imageUrl: post.imageUrl,
          permalinkUrl: post.permalinkUrl,
          reactionsCount: post.reactionsCount,
          commentsCount: post.commentsCount,
          sharesCount: post.sharesCount,
          publishedAt: post.publishedAt,
        });
        try {
          await api.syncComments(created.id);
        } catch {
          // The selected post will still be shown; users can retry sync manually.
        }
        setPosts((prev) => [created, ...prev]);
        setSelectedPostId(created.id);
        setAddDialogOpen(false);
        setFeedPosts((prev) =>
          prev.map((p) =>
            p.externalId === post.externalId ? { ...p, alreadyAdded: true } : p,
          ),
        );
      } finally {
        setAddingPost(false);
      }
    },
    [businessProfileId],
  );

  // ── Delete post ────────────────────────────────────────────────────────────
  const deletePost = useCallback(
    async (postId: string) => {
      if (!businessProfileId) return;
      setDeletingPostId(postId);
      try {
        await api.deleteManagedPost(postId, businessProfileId);
        setPosts((prev) => {
          const remaining = prev.filter((p) => p.id !== postId);
          // Auto-select the next post if the deleted one was selected
          if (selectedPostId === postId) {
            setSelectedPostId(remaining[0]?.id ?? null);
          }
          return remaining;
        });
      } finally {
        setDeletingPostId(null);
      }
    },
    [businessProfileId, selectedPostId],
  );

  // ── Reply ──────────────────────────────────────────────────────────────────
  const submitReply = useCallback(async () => {
    if (!replyingTo || !replyText.trim()) return;
    setReplySending(true);
    try {
      if (replyMode === "private") {
        await api.sendPrivateReply(replyingTo, replyText.trim());
      } else {
        await api.replyToCommentPublic(replyingTo, replyText.trim());
      }
      // Optimistic update — real-time SSE will confirm if needed
      const submittedAt = new Date().toISOString();
      setComments((prev) =>
        prev.map((c) =>
          c.id === replyingTo
            ? {
                ...c,
                isReplied: true,
                replyContent:
                  replyMode === "public" ? replyText.trim() : c.replyContent,
                repliedAt: submittedAt,
                repliedByAi: false,
                replies:
                  replyMode === "public"
                    ? [
                        ...(c.replies ?? []),
                        {
                          id: `local-${replyingTo}-${submittedAt}`,
                          externalId: `local-${replyingTo}-${submittedAt}`,
                          authorId: activePage?.pageId ?? "page",
                          authorName: activePage?.name ?? "Votre page",
                          authorAvatarUrl: null,
                          message: replyText.trim(),
                          commentedAt: submittedAt,
                          isPageReply: true,
                          repliedByAi: false,
                        },
                      ]
                    : c.replies,
              }
            : c,
        ),
      );
      setReplyingTo(null);
      setReplyText("");
    } finally {
      setReplySending(false);
    }
  }, [replyingTo, replyText, replyMode, activePage]);

  const triggerAiReply = useCallback(async (commentId: string) => {
    await api.triggerAiReply(commentId);
    // Mark as processing — SSE comment:replied will update with actual reply
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId ? { ...c, isReplied: true, repliedByAi: true } : c,
      ),
    );
  }, []);

  // ── Config save ────────────────────────────────────────────────────────────
  const saveConfig = useCallback(
    async (form: Partial<PostAiConfigForm>) => {
      if (!selectedPostId) return;
      setConfigSaving(true);
      setConfigError(null);
      try {
        const updated = await api.updatePostAiConfig(selectedPostId, form);
        setPostAiConfig(updated);
        // Update post card immediately
        setPosts((prev) =>
          prev.map((p) =>
            p.id === selectedPostId ? { ...p, postAiConfig: updated } : p,
          ),
        );
      } catch (err: unknown) {
        setConfigError(
          err instanceof Error ? err.message : "Erreur lors de la sauvegarde.",
        );
        throw err;
      } finally {
        setConfigSaving(false);
      }
    },
    [selectedPostId],
  );

  // ── Page switch ────────────────────────────────────────────────────────────
  const switchPage = useCallback((key: string) => {
    setActivePageKey(key);
    setSelectedPostId(null);
    setPostSearch("");
    setCommentSearch("");
    setCommentFilter("all");
    setPosts([]);
    setComments([]);
    setPostAiConfig(null);
  }, []);

  return {
    // Pages
    pages,
    pagesLoading,
    pagesError,
    activePage,
    activePageKey,
    switchPage,

    // Real-time status
    realtimeConnected,

    // Posts
    posts,
    postsLoading,
    postsError,
    postSearch,
    setPostSearch,
    loadPosts,

    // Auto-reply limit
    autoReplyCount,
    autoReplyLimitReached,

    // Selected post
    selectedPost,
    selectedPostId,
    setSelectedPostId,
    activeTab,
    setActiveTab,

    // Comments
    comments,
    commentsLoading,
    commentFilter,
    setCommentFilter,
    commentSearch,
    setCommentSearch,
    commentPage,
    commentTotal,
    loadComments,
    syncComments,
    isSyncingComments,

    // Reply
    replyingTo,
    setReplyingTo,
    replyText,
    setReplyText,
    replySending,
    replyMode,
    setReplyMode,
    submitReply,
    triggerAiReply,

    // Config
    postAiConfig,
    configLoading,
    configSaving,
    configError,
    saveConfig,

    // Add / delete
    addDialogOpen,
    setAddDialogOpen,
    feedPosts,
    feedLoading,
    addingPost,
    deletingPostId,
    openAddDialog,
    addPost,
    deletePost,
  };
}
