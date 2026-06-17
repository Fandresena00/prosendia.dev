/**
 * @file features/posts-comments/services/posts-comments.service.ts
 * API client — all posts & comments backend endpoints.
 */

import { apiClient } from "@/lib/api-client";
import type {
  AiReplyResult,
  AiSuggestionResult,
  ApiComment,
  ApiPost,
  ApiPostAiConfig,
  CommentFilter,
  FbFeedPost,
  FacebookPage,
  Paginated,
  PostAiConfigForm,
} from "../types/posts-comments.types";

const BASE = "/facebook";

// ─── Pages ────────────────────────────────────────────────────────────────────

export async function getPagesList(): Promise<FacebookPage[]> {
  return apiClient(`${BASE}/pages/list`);
}

// ─── Feed (for add-post dialog) ───────────────────────────────────────────────

export async function getPageFeed(
  businessProfileId: string,
  limit = 25,
): Promise<FbFeedPost[]> {
  return apiClient(`${BASE}/posts/feed/${businessProfileId}?limit=${limit}`);
}

// ─── Managed posts CRUD ───────────────────────────────────────────────────────

export async function addManagedPost(
  data: Omit<FbFeedPost, "alreadyAdded"> & { businessProfileId: string },
): Promise<ApiPost> {
  return apiClient(`${BASE}/posts/managed`, {
    method: "POST",
    body:   JSON.stringify(data),
  });
}

export async function deleteManagedPost(
  postId:            string,
  businessProfileId: string,
): Promise<void> {
  return apiClient(
    `${BASE}/posts/managed/${postId}?businessProfileId=${businessProfileId}`,
    { method: "DELETE" },
  );
}

// ─── Posts ────────────────────────────────────────────────────────────────────

export async function getPosts(
  businessProfileId: string,
  page     = 1,
  pageSize = 20,
  search?: string,
): Promise<Paginated<ApiPost>> {
  const params = new URLSearchParams({
    page:     String(page),
    pageSize: String(pageSize),
    ...(search ? { search } : {}),
  });
  return apiClient(`${BASE}/posts/${businessProfileId}?${params}`);
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export async function syncComments(postId: string): Promise<{ synced: number }> {
  return apiClient(`${BASE}/sync/comments/${postId}`, { method: "POST" });
}

export async function getComments(
  postId:   string,
  page    = 1,
  pageSize = 50,
  filter?: CommentFilter,
  search?: string,
): Promise<Paginated<ApiComment>> {
  const params = new URLSearchParams({
    page:     String(page),
    pageSize: String(pageSize),
    ...(filter && filter !== "all" ? { filter } : {}),
    ...(search ? { search } : {}),
  });
  return apiClient(`${BASE}/posts/${postId}/comments?${params}`);
}

// ─── Replies ──────────────────────────────────────────────────────────────────

export async function replyToCommentPublic(
  commentId: string,
  message:   string,
): Promise<void> {
  return apiClient(`${BASE}/comments/${commentId}/reply`, {
    method: "POST",
    body:   JSON.stringify({ message }),
  });
}

export async function sendPrivateReply(
  commentId: string,
  message:   string,
): Promise<void> {
  return apiClient(`${BASE}/comments/${commentId}/private-reply`, {
    method: "POST",
    body:   JSON.stringify({ message }),
  });
}

export async function triggerAiReply(commentId: string): Promise<AiReplyResult> {
  return apiClient(`${BASE}/comments/${commentId}/ai-reply`, { method: "POST" });
}

// ─── PostAiConfig ─────────────────────────────────────────────────────────────

export async function getPostAiConfig(postId: string): Promise<ApiPostAiConfig> {
  return apiClient(`${BASE}/posts/${postId}/ai-config`);
}

export async function updatePostAiConfig(
  postId: string,
  data:   Partial<PostAiConfigForm>,
): Promise<ApiPostAiConfig> {
  return apiClient(`${BASE}/posts/${postId}/ai-config`, {
    method: "PUT",
    body:   JSON.stringify(data),
  });
}

// ─── AI suggestion (config field helper) ──────────────────────────────────────

/**
 * Asks the AI to draft/improve a single config field (private DM message or
 * custom instructions), taking the field's CURRENT content into account.
 * Consumes credits like any other AI call — "toute utilisation IA consomme
 * du crédit, même les suggestions".
 */
export async function generateAiSuggestion(
  postId:       string,
  field:        "privateReplyMessage" | "customInstructions",
  currentValue: string,
): Promise<AiSuggestionResult> {
  return apiClient(`${BASE}/posts/${postId}/ai-suggest`, {
    method: "POST",
    body:   JSON.stringify({ field, currentValue }),
  });
}
