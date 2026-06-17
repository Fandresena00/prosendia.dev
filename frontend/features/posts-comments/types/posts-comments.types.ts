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
  /** "Répondre à tous les commentaires" — bypasses the spam filter entirely. */
  replyToAllComments:  boolean;
  /** Deterministic, non-AI keyword reply rules (0 credits when matched). */
  keywordRules:        KeywordRule[];
}

/**
 * A single non-AI, deterministic reply rule.
 *   replyText set  → fixed reply, posted directly, 0 AI calls/credits.
 *   replyText null → bypasses the spam filter, AI generates the reply
 *                     (credits consumed as usual).
 */
export interface KeywordRule {
  id:               string;
  keyword:          string;
  matchType:        "contains" | "exact";
  replyText:        string | null;
  sendPrivateReply: boolean;
  privateReplyText: string | null;
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
  /**
   * Set by PostCommentAiService when it evaluated this comment and chose
   * NOT to reply (e.g. it looked like spam). Lets the frontend show
   * "IA: pas de réponse (ressemble à du spam)" instead of looking broken.
   */
  aiSpamScore?:  number | null;
  aiSkipped?:    boolean;
  aiSkipReason?: string | null;
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
  replyToAllComments:  boolean;
  keywordRules:        KeywordRule[];
}

/** Plan-based limit info for managed posts, surfaced from CreditStatusDto. */
export interface ManagedPostsLimitInfo {
  current: number;
  max:     number | null; // null = unlimited (CUSTOM plan)
  planName: string;
}

/** Result of a manual/forced AI reply trigger — POST .../ai-reply */
export interface AiReplyResult {
  success:     boolean;
  reason?:     string;
  message?:    string;
  spamScore?:  number;
  ruleMatched?: boolean;
}

/** Result of an AI suggestion call — POST .../ai-suggest */
export interface AiSuggestionResult {
  suggestion:  string;
  creditsUsed: number;
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
