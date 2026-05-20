"use client";
/**
 * @file features/posts-comments/hooks/use-posts-comments.ts
 *
 * Central hook — fully self-contained, real-time enabled.
 *
 * CHANGES FROM PREVIOUS VERSION
 * ──────────────────────────────
 * 1. Integrates usePostsRealtime for live comment/post updates via SSE.
 * 2. businessProfileId FIX: all API calls use `activePage?.key` (which has
 *    a fallback to pages[0]) instead of `activePageKey` (which starts as "").
 *    This prevents the "businessProfileId should not be empty" 400 error.
 * 3. 10-post autoReply limit tracked via `autoReplyCount`.
 * 4. Real-time handlers:
 *    - onCommentAdded   → prepend to comments list if matching post is selected
 *    - onCommentReplied → update the specific comment inline
 *    - onPostUpdated    → update commentsCount on the matching post card
 *    - onSyncCompleted  → reload comments for selected post (scheduler fallback)
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

  // FIX: use `activePage?.key` for API calls — has fallback to pages[0]
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

  // ── Add/delete post ────────────────────────────────────────────────────────
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [feedPosts, setFeedPosts] = useState<FbFeedPost[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [addingPost, setAddingPost] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);

  const didInit = useRef(false);

  // ── Real-time SSE ──────────────────────────────────────────────────────────
  const selectedPostIdRef = useRef(selectedPostId);
  selectedPostIdRef.current = selectedPostId;

  const { connected: realtimeConnected } = usePostsRealtime(businessProfileId, {
    // New comment arrives — prepend if it's for the currently selected post
    onCommentAdded: useCallback((comment: ApiComment) => {
      if (comment.postId !== selectedPostIdRef.current) return;
      setComments((prev) => {
        // Avoid duplicates (scheduler might emit after webhook)
        if (prev.some((c) => c.id === comment.id)) return prev;
        return [comment, ...prev];
      });
      setCommentTotal((n) => n + 1);
      // Update post commentsCount in the list
      setPosts((prev) =>
        prev.map((p) =>
          p.id === comment.postId
            ? { ...p, commentsCount: p.commentsCount + 1 }
            : p,
        ),
      );
    }, []),

    // Comment was replied to — update it inline
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
                }
              : c,
          ),
        );
      },
      [],
    ),

    // Post metadata updated (commentsCount, etc.)
    onPostUpdated: useCallback(
      (postId: string, updates: Record<string, unknown>) => {
        setPosts((prev) =>
          prev.map((p) => (p.id === postId ? { ...p, ...updates } : p)),
        );
      },
      [],
    ),

    // Scheduler completed a sync cycle — reload comments for selected post
    onSyncCompleted: useCallback(() => {
      if (selectedPostIdRef.current) {
        void loadCommentsFnRef.current?.(1);
      }
    }, []),
  });

  // Keep loadComments reference stable for onSyncCompleted
  const loadCommentsFnRef = useRef<((page?: number) => Promise<void>) | null>(
    null,
  );

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

  // ── Load posts when page changes ───────────────────────────────────────────
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
    // FIX: use businessProfileId (from activePage?.key) not activePageKey
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
    void loadCommentsFn(1);
    void loadPostAiConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPostId, commentFilter, commentSearch]);

  const loadCommentsFn = useCallback(
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

  // Keep ref in sync for onSyncCompleted closure
  loadCommentsFnRef.current = loadCommentsFn;

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

  // ── Sync comments ──────────────────────────────────────────────────────────
  const syncComments = useCallback(async () => {
    if (!selectedPostId) return;
    setIsSyncingComments(true);
    try {
      await api.syncComments(selectedPostId);
      await loadCommentsFn(1);
    } finally {
      setIsSyncingComments(false);
    }
  }, [selectedPostId, loadCommentsFn]);

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
      // FIX: use businessProfileId (activePage?.key) not raw activePageKey
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
        setPosts((prev) => prev.filter((p) => p.id !== postId));
        if (selectedPostId === postId) {
          const remaining = posts.filter((p) => p.id !== postId);
          setSelectedPostId(remaining[0]?.id ?? null);
        }
      } finally {
        setDeletingPostId(null);
      }
    },
    [businessProfileId, selectedPostId, posts],
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
      setComments((prev) =>
        prev.map((c) =>
          c.id === replyingTo
            ? {
                ...c,
                isReplied: true,
                replyContent: replyText.trim(),
                repliedByAi: false,
              }
            : c,
        ),
      );
      setReplyingTo(null);
      setReplyText("");
    } finally {
      setReplySending(false);
    }
  }, [replyingTo, replyText, replyMode]);

  const triggerAiReply = useCallback(async (commentId: string) => {
    await api.triggerAiReply(commentId);
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

    // Real-time
    realtimeConnected,

    // Posts
    posts,
    postsLoading,
    postsError,
    postSearch,
    setPostSearch,
    loadPosts,

    // Limit
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
    loadComments: loadCommentsFn,
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

    // Add/delete
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
