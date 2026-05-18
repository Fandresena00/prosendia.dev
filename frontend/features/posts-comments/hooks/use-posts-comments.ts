"use client";
/**
 * @file features/posts-comments/hooks/use-posts-comments.ts
 *
 * Central hook — fully self-contained.
 * Fetches pages from the backend, no props needed.
 *
 * 10-post autoReply limit: tracked as `autoReplyCount` per active page.
 * The UI uses this to disable the toggle when the limit is reached.
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

const MAX_AUTO_REPLY = 10;

export function usePostsComments() {
  // ── Pages ──────────────────────────────────────────────────────────────────
  const [pages,        setPages]        = useState<FacebookPage[]>([]);
  const [pagesLoading, setPagesLoading] = useState(true);
  const [pagesError,   setPagesError]   = useState<string | null>(null);
  const [activePageKey, setActivePageKey] = useState<string>("");
  const activePage = pages.find((p) => p.key === activePageKey) ?? pages[0] ?? null;

  // ── Posts ──────────────────────────────────────────────────────────────────
  const [posts,        setPosts]        = useState<ApiPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsError,   setPostsError]   = useState<string | null>(null);
  const [postSearch,   setPostSearch]   = useState("");
  const [isSyncing,    setIsSyncing]    = useState(false);

  // Count of posts with autoReply enabled for the active page
  const autoReplyCount = posts.filter((p) => p.postAiConfig?.autoReply).length;
  const autoReplyLimitReached = autoReplyCount >= MAX_AUTO_REPLY;

  // ── Selected post ──────────────────────────────────────────────────────────
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const selectedPost = posts.find((p) => p.id === selectedPostId) ?? null;
  const [activeTab, setActiveTab] = useState<ActiveTab>("comments");

  // ── Comments ───────────────────────────────────────────────────────────────
  const [comments,          setComments]          = useState<ApiComment[]>([]);
  const [commentsLoading,   setCommentsLoading]   = useState(false);
  const [commentFilter,     setCommentFilter]     = useState<CommentFilter>("all");
  const [commentSearch,     setCommentSearch]     = useState("");
  const [commentPage,       setCommentPage]       = useState(1);
  const [commentTotal,      setCommentTotal]      = useState(0);
  const [isSyncingComments, setIsSyncingComments] = useState(false);

  // ── PostAiConfig ───────────────────────────────────────────────────────────
  const [postAiConfig,  setPostAiConfig]  = useState<ApiPostAiConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving,  setConfigSaving]  = useState(false);
  const [configError,   setConfigError]   = useState<string | null>(null);

  // ── Reply state ────────────────────────────────────────────────────────────
  const [replyingTo,   setReplyingTo]   = useState<string | null>(null);
  const [replyText,    setReplyText]    = useState("");
  const [replySending, setReplySending] = useState(false);
  const [replyMode,    setReplyMode]    = useState<"public" | "private">("public");

  // ── Add-post dialog ────────────────────────────────────────────────────────
  const [addDialogOpen,   setAddDialogOpen]   = useState(false);
  const [feedPosts,       setFeedPosts]       = useState<FbFeedPost[]>([]);
  const [feedLoading,     setFeedLoading]     = useState(false);
  const [addingPost,      setAddingPost]      = useState(false);
  const [deletingPostId,  setDeletingPostId]  = useState<string | null>(null);

  const didInit = useRef(false);

  // ── Load pages once on mount ───────────────────────────────────────────────
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
    if (!activePageKey) return;
    setPostsLoading(true);
    setPostsError(null);
    try {
      const result = await api.getPosts(activePageKey, 1, 50, postSearch || undefined);
      setPosts(result.data);
      // Auto-select first post
      if (result.data.length > 0 && !selectedPostId) {
        setSelectedPostId(result.data[0].id);
      }
    } catch {
      setPostsError("Impossible de charger les posts.");
    } finally {
      setPostsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePageKey, postSearch]);

  // ── Load comments + config when post selected ─────────────────────────────
  useEffect(() => {
    if (!selectedPostId) return;
    setComments([]);
    void loadComments(1);
    void loadPostAiConfig();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPostId, commentFilter, commentSearch]);

  const loadComments = useCallback(async (page = 1) => {
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
      setComments(page === 1 ? result.data : (prev) => [...prev, ...result.data]);
      setCommentPage(page);
      setCommentTotal(result.pagination.total);
    } catch {
      // silent
    } finally {
      setCommentsLoading(false);
    }
  }, [selectedPostId, commentFilter, commentSearch]);

  const loadPostAiConfig = useCallback(async () => {
    if (!selectedPostId) return;
    setConfigLoading(true);
    setPostAiConfig(null);
    try {
      const cfg = await api.getPostAiConfig(selectedPostId);
      setPostAiConfig(cfg);
    } catch {
      // config will be created on first save
    } finally {
      setConfigLoading(false);
    }
  }, [selectedPostId]);

  // ── Sync comments ─────────────────────────────────────────────────────────
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

  // ── Add post dialog ───────────────────────────────────────────────────────
  const openAddDialog = useCallback(async () => {
    if (!activePageKey) return;
    setAddDialogOpen(true);
    setFeedLoading(true);
    try {
      const feed = await api.getPageFeed(activePageKey, 30);
      setFeedPosts(feed);
    } catch {
      setFeedPosts([]);
    } finally {
      setFeedLoading(false);
    }
  }, [activePageKey]);

  const addPost = useCallback(async (post: FbFeedPost) => {
    if (!activePageKey) return;
    setAddingPost(true);
    try {
      const created = await api.addManagedPost({
        businessProfileId: activePageKey,
        externalId:        post.externalId,
        message:           post.message,
        imageUrl:          post.imageUrl,
        permalinkUrl:      post.permalinkUrl,
        reactionsCount:    post.reactionsCount,
        commentsCount:     post.commentsCount,
        sharesCount:       post.sharesCount,
        publishedAt:       post.publishedAt,
      });
      setPosts((prev) => [created, ...prev]);
      setSelectedPostId(created.id);
      setAddDialogOpen(false);
      // Mark as already added in feed
      setFeedPosts((prev) =>
        prev.map((p) =>
          p.externalId === post.externalId ? { ...p, alreadyAdded: true } : p,
        ),
      );
    } finally {
      setAddingPost(false);
    }
  }, [activePageKey]);

  // ── Delete post ───────────────────────────────────────────────────────────
  const deletePost = useCallback(async (postId: string) => {
    if (!activePageKey) return;
    setDeletingPostId(postId);
    try {
      await api.deleteManagedPost(postId, activePageKey);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      if (selectedPostId === postId) {
        const remaining = posts.filter((p) => p.id !== postId);
        setSelectedPostId(remaining[0]?.id ?? null);
      }
    } finally {
      setDeletingPostId(null);
    }
  }, [activePageKey, selectedPostId, posts]);

  // ── Reply actions ─────────────────────────────────────────────────────────
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
            ? { ...c, isReplied: true, replyContent: replyText.trim(), repliedByAi: false }
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

  // ── Config save ───────────────────────────────────────────────────────────
  const saveConfig = useCallback(async (form: Partial<PostAiConfigForm>) => {
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
      const msg =
        err instanceof Error ? err.message : "Erreur lors de la sauvegarde.";
      setConfigError(msg);
      throw err;
    } finally {
      setConfigSaving(false);
    }
  }, [selectedPostId]);

  // ── Page switch ───────────────────────────────────────────────────────────
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

    // Posts
    posts,
    postsLoading,
    postsError,
    postSearch,
    setPostSearch,
    loadPosts,
    isSyncing,

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

    // Add / delete post
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
