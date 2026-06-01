/**
 * @file features/posts-comments/types/posts-comments.types.ts
 */

export interface FacebookPage {
  key:       string;
  pageId:    string;
  name:      string;
  avatar:    string;
  color:     string;
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
  id:               string;
  postId:           string;
  externalId:       string;
  authorId:         string;
  authorName:       string;
  authorAvatarUrl:  string | null;
  /** Computed by backend: https://www.facebook.com/profile.php?id={authorId} */
  authorProfileUrl?: string | null;
  message:          string;
  commentedAt:      string;
  isReplied:        boolean;
  replyContent:     string | null;
  repliedAt:        string | null;
  repliedByAi:      boolean | null;
  replies?:         ApiCommentReply[];
  spamScore?:       number;
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

export interface Paginated<T> {
  data: T[];
  pagination: {
    page:       number;
    pageSize:   number;
    total:      number;
    totalPages: number;
  };
}
