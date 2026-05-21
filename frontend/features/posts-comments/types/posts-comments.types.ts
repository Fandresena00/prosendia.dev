/**
 * @file features/posts-comments/types/posts-comments.types.ts
 *
 * Types aligned with the backend API responses.
 * No local-only fields — everything comes from the backend.
 */

// ─── Backend API response types ───────────────────────────────────────────────

export interface FacebookPage {
  /** businessProfileId — used as the page key */
  key:       string;
  pageId:    string;
  name:      string;
  /** 2-letter initials fallback */
  avatar:    string;
  /** Tailwind color class for fallback avatar */
  color:     string;
  /** Facebook CDN avatar URL */
  avatarUrl: string;
}

export interface ApiPost {
  id:                string;
  businessProfileId: string;
  externalId:        string;
  message:           string | null;
  imageUrl:          string | null;
  permalinkUrl:      string | null;
  reactionsCount:    number;
  commentsCount:     number;
  sharesCount:       number;
  publishedAt:       string;
  lastSyncedAt:      string | null;
  postAiConfig:      ApiPostAiConfig | null;
  _count?:           { comments: number };
}

export interface ApiPostAiConfig {
  id:                  string;
  postId:              string;
  autoReply:           boolean;
  privateReplyEnabled: boolean;
  privateReplyMessage: string | null;
  customInstructions:  string | null;
  replyLanguage:       string | null;
  maxReplyTokens:      number | null;
  tone:                string | null;
  responseStyle:       string | null;
}

export interface ApiComment {
  id:              string;
  postId:          string;
  externalId:      string;
  authorId:        string;
  authorName:      string;
  authorAvatarUrl: string | null;
  message:         string;
  commentedAt:     string;
  isReplied:       boolean;
  replyContent:    string | null;
  repliedAt:       string | null;
  repliedByAi:     boolean | null;
  replies?:        ApiCommentReply[];
  spamScore?:      number;
}

export interface ApiCommentReply {
  id:              string;
  externalId:      string;
  authorId:        string;
  authorName:      string;
  authorAvatarUrl: string | null;
  message:         string;
  commentedAt:     string;
  isPageReply:     boolean;
  repliedByAi:     boolean | null;
}

/** Live feed post from Facebook (for add-post dialog). */
export interface FbFeedPost {
  externalId:     string;
  message:        string | null;
  imageUrl:       string | null;
  permalinkUrl:   string | null;
  reactionsCount: number;
  commentsCount:  number;
  sharesCount:    number;
  publishedAt:    string;
  alreadyAdded:   boolean;
}

// ─── UI types ─────────────────────────────────────────────────────────────────

export type CommentFilter = 'all' | 'pending' | 'replied';
export type ActiveTab     = 'comments' | 'config';

export interface PostAiConfigForm {
  autoReply:           boolean;
  privateReplyEnabled: boolean;
  privateReplyMessage: string;
  customInstructions:  string;
  replyLanguage:       string;
  maxReplyTokens:      number;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface Paginated<T> {
  data: T[];
  pagination: {
    page:       number;
    pageSize:   number;
    total:      number;
    totalPages: number;
  };
}
