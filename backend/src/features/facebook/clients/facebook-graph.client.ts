/**
 * FacebookGraphClient — typed HTTP client for Facebook Graph API (Native Fetch).
 *
 * Key decisions:
 * - URL built via template literal (`${GRAPH_URL}/${path}`) to prevent
 *   `new URL(path, base)` silently dropping the API version when base has
 *   no trailing slash.
 * - `handleError` accepts `unknown` and narrows via helpers — no `any`.
 * - All public methods are typed end-to-end; callers never see `unknown`.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FACEBOOK_API,
  GRAPH_RETRY,
  RETRYABLE_HTTP_STATUSES,
} from '../facebook.constants.js';
import {
  FacebookRateLimitError,
  FacebookTemporaryError,
  FacebookTokenError,
  mapGraphApiError,
} from './facebook-graph.errors.js';

// ─── Response shapes ─────────────────────────────────────────────────────────

export interface FbPage {
  readonly id: string;
  readonly name: string;
  readonly access_token: string;
  readonly category: string;
  readonly instagram_business_account?: { id: string };
}

export interface FbPost {
  readonly id: string;
  readonly message?: string;
  readonly full_picture?: string;
  readonly permalink_url?: string;
  readonly created_time: string;
  readonly reactions?: { summary: { total_count: number } };
  readonly comments?: { summary: { total_count: number } };
  readonly shares?: { count: number };
}

export interface FbComment {
  readonly id: string;
  readonly message: string;
  readonly from?: { id: string; name: string };
  readonly created_time: string;
}

export interface FbConversation {
  readonly id: string;
  readonly updated_time: string;
  readonly participants?: { data: ReadonlyArray<{ id: string; name: string }> };
  readonly messages?: {
    data: ReadonlyArray<{
      id: string;
      message: string;
      from: { id: string; name: string };
      created_time: string;
    }>;
  };
}

export interface FbMessage {
  readonly id: string;
  readonly message?: string;
  readonly from?: { id: string; name: string; email?: string };
  readonly to?: { data: ReadonlyArray<{ id: string; name: string }> };
  readonly created_time: string;
  readonly attachments?: {
    data: ReadonlyArray<{
      id: string;
      image_data?: { url: string };
      mime_type?: string;
      file_url?: string;
    }>;
  };
}

export interface TokenDebugData {
  readonly app_id: string;
  readonly type: string;
  readonly is_valid: boolean;
  readonly expires_at?: number;
  readonly scopes: string[];
  readonly user_id?: string;
  readonly error?: { code: number; message: string; subcode?: number };
}

export interface FbPaginatedResponse<T> {
  readonly data: T[];
  readonly paging?: {
    cursors?: { before: string; after: string };
    next?: string;
    previous?: string;
  };
}

export interface FbSendMessageResponse {
  readonly recipient_id: string;
  readonly message_id: string;
}

export interface FbMessengerUserProfile {
  readonly name?: string;
  readonly first_name?: string;
  readonly last_name?: string;
  readonly profile_pic?: string;
}

interface FbGraphUserName {
  readonly id: string;
  readonly name?: string;
}

// ─── Internal types ───────────────────────────────────────────────────────────

interface GraphRequestConfig {
  readonly method: 'GET' | 'POST' | 'DELETE';
  readonly endpoint: string;
  readonly data?: Record<string, unknown>;
  readonly params?: Record<string, unknown>;
}

// ─── Client ──────────────────────────────────────────────────────────────────

@Injectable()
export class FacebookGraphClient {
  private readonly logger = new Logger(FacebookGraphClient.name);
  private readonly appId: string;
  private readonly appSecret: string;

  constructor(configService: ConfigService) {
    this.appId = configService.getOrThrow<string>('facebookAppId');
    this.appSecret = configService.getOrThrow<string>('facebookAppSecret');
  }

  // ─── Generic request methods ──────────────────────────────────────────────

  async get<T>(endpoint: string, params?: Record<string, unknown>): Promise<T> {
    return this.executeWithRetry<T>({ method: 'GET', endpoint, params });
  }

  async post<T>(
    endpoint: string,
    data?: Record<string, unknown>,
    params?: Record<string, unknown>,
  ): Promise<T> {
    return this.executeWithRetry<T>({ method: 'POST', endpoint, data, params });
  }

  async delete<T>(
    endpoint: string,
    params?: Record<string, unknown>,
  ): Promise<T> {
    return this.executeWithRetry<T>({ method: 'DELETE', endpoint, params });
  }

  // ─── Retry engine ─────────────────────────────────────────────────────────

  private async executeWithRetry<T>(
    config: GraphRequestConfig,
    attempt = 1,
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const url = this.buildUrl(config.endpoint);

      if (config.params) {
        for (const [key, value] of Object.entries(config.params)) {
          if (value !== undefined) url.searchParams.append(key, String(value));
        }
      }

      this.logger.debug(
        `→ ${config.method} ${config.endpoint} (attempt ${attempt})`,
      );

      const response = await fetch(url.toString(), {
        method: config.method,
        headers: { 'Content-Type': 'application/json' },
        body: config.data ? JSON.stringify(config.data) : undefined,
        signal: controller.signal,
      });

      // Graph API returns 200 even on error — check body first
      const body: unknown = await response.json().catch(() => ({}));

      if (
        typeof body === 'object' &&
        body !== null &&
        'error' in body &&
        (body as Record<string, unknown>).error
      ) {
        throw mapGraphApiError(
          (body as { error: Parameters<typeof mapGraphApiError>[0] }).error,
        );
      }

      if (!response.ok) {
        const err: {
          isFetchError: true;
          status: number;
          data: unknown;
          message: string;
        } = {
          isFetchError: true,
          status: response.status,
          data: body,
          message: `HTTP error ${response.status}`,
        };
        throw err;
      }

      this.logger.debug(`✓ ${config.method} ${config.endpoint}`);
      return body as T;
    } catch (error) {
      return this.handleError<T>(error, config, attempt);
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Build the full Graph API URL.
   *
   * Uses template literal concatenation instead of `new URL(path, base)` to avoid
   * the browser/Node URL API silently stripping the API version segment when the
   * base has no trailing slash:
   *   new URL('me/accounts', 'https://graph.facebook.com/v25.0')
   *   → 'https://graph.facebook.com/me/accounts'  ✗  (version dropped!)
   */
  private buildUrl(endpoint: string): URL {
    const path = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    return new URL(`${FACEBOOK_API.GRAPH_URL}/${path}`);
  }

  private async handleError<T>(
    error: unknown,
    config: GraphRequestConfig,
    attempt: number,
  ): Promise<T> {
    // Token errors are final — never retry
    if (error instanceof FacebookTokenError) {
      this.logger.warn(`Token error on ${config.endpoint}: ${error.message}`);
      throw error;
    }

    // Typed retryable Facebook errors (rate limit / server temporary)
    if (
      (error instanceof FacebookRateLimitError ||
        error instanceof FacebookTemporaryError) &&
      attempt <= GRAPH_RETRY.MAX_ATTEMPTS
    ) {
      const delay = this.backoffDelay(attempt, error);
      this.logger.warn(
        `Retryable FB error on ${config.endpoint} — retry ${attempt}/${GRAPH_RETRY.MAX_ATTEMPTS} in ${delay}ms`,
      );
      await this.sleep(delay);
      return this.executeWithRetry<T>(config, attempt + 1);
    }

    // HTTP 429 / 5xx
    const httpStatus = this.extractHttpStatus(error);
    if (
      httpStatus !== undefined &&
      (RETRYABLE_HTTP_STATUSES as readonly number[]).includes(httpStatus) &&
      attempt <= GRAPH_RETRY.MAX_ATTEMPTS
    ) {
      const delay = this.backoffDelay(attempt);
      this.logger.warn(
        `HTTP ${httpStatus} on ${config.endpoint} — retry ${attempt}/${GRAPH_RETRY.MAX_ATTEMPTS} in ${delay}ms`,
      );
      await this.sleep(delay);
      return this.executeWithRetry<T>(config, attempt + 1);
    }

    // Network / timeout errors
    if (this.isNetworkError(error)) {
      if (attempt <= GRAPH_RETRY.MAX_ATTEMPTS) {
        const delay = this.backoffDelay(attempt);
        this.logger.warn(
          `Network error on ${config.endpoint} — retry ${attempt}/${GRAPH_RETRY.MAX_ATTEMPTS} in ${delay}ms`,
        );
        await this.sleep(delay);
        return this.executeWithRetry<T>(config, attempt + 1);
      }
      throw new FacebookTemporaryError(
        `Network error (timeout/refused) after ${attempt} attempts`,
      );
    }

    if (error instanceof Error) throw error;
    throw new Error(`Unexpected Graph API error: ${String(error)}`);
  }

  private extractHttpStatus(error: unknown): number | undefined {
    if (typeof error !== 'object' || error === null) return undefined;
    const maybe = error as Record<string, unknown>;
    return typeof maybe['status'] === 'number' ? maybe['status'] : undefined;
  }

  private isNetworkError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const nodeErr = error as NodeJS.ErrnoException;
    return (
      error.name === 'AbortError' ||
      nodeErr.code === 'ECONNRESET' ||
      nodeErr.code === 'ECONNREFUSED'
    );
  }

  private backoffDelay(attempt: number, error?: unknown): number {
    const base =
      error instanceof FacebookRateLimitError
        ? GRAPH_RETRY.BASE_DELAY_MS * 2
        : GRAPH_RETRY.BASE_DELAY_MS;
    return Math.min(
      base * Math.pow(GRAPH_RETRY.BACKOFF_FACTOR, attempt - 1),
      GRAPH_RETRY.MAX_DELAY_MS,
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  // ─── OAuth ────────────────────────────────────────────────────────────────

  async exchangeCodeForToken(
    code: string,
    redirectUri: string,
  ): Promise<string> {
    const data = await this.get<{ access_token: string }>(
      '/oauth/access_token',
      {
        client_id: this.appId,
        client_secret: this.appSecret,
        redirect_uri: redirectUri,
        code,
      },
    );
    return data.access_token;
  }

  async extendToken(shortLivedToken: string): Promise<string> {
    const data = await this.get<{ access_token: string }>(
      '/oauth/access_token',
      {
        grant_type: 'fb_exchange_token',
        client_id: this.appId,
        client_secret: this.appSecret,
        fb_exchange_token: shortLivedToken,
      },
    );
    return data.access_token;
  }

  // ─── Token introspection ──────────────────────────────────────────────────

  /**
   * Returns null when a network/server error prevents inspection.
   * Callers must treat null as "unknown, assume valid" for non-blocking flows.
   */
  async debugToken(token: string): Promise<TokenDebugData | null> {
    try {
      const result = await this.get<{ data: TokenDebugData }>('/debug_token', {
        input_token: token,
        access_token: `${this.appId}|${this.appSecret}`,
      });
      return result.data;
    } catch (error) {
      if (error instanceof FacebookTemporaryError) {
        this.logger.warn('Token debug skipped due to network/server error');
        return null;
      }
      throw error;
    }
  }

  async isTokenValid(token: string): Promise<boolean> {
    const debug = await this.debugToken(token);
    if (debug === null) return true; // Network error → treat as valid (non-blocking)
    return debug.is_valid;
  }

  // ─── Pages ────────────────────────────────────────────────────────────────

  async getUserPages(userAccessToken: string): Promise<FbPage[]> {
    const result = await this.get<FbPaginatedResponse<FbPage>>('/me/accounts', {
      access_token: userAccessToken,
      fields: 'id,name,access_token,category,instagram_business_account',
    });
    return result.data;
  }

  async getPageInfo(
    pageId: string,
    accessToken: string,
  ): Promise<Pick<FbPage, 'id' | 'name' | 'category'>> {
    return this.get(`/${pageId}`, {
      access_token: accessToken,
      fields: 'id,name,category',
    });
  }

  // ─── Webhook ──────────────────────────────────────────────────────────────

  async subscribePageToWebhook(
    pageId: string,
    accessToken: string,
    fields: readonly string[],
  ): Promise<void> {
    const result = await this.post<{ success: boolean }>(
      `/${pageId}/subscribed_apps`,
      undefined,
      { access_token: accessToken, subscribed_fields: fields.join(',') },
    );
    if (!result.success) {
      throw new Error(`Failed to subscribe page ${pageId} to webhook`);
    }
  }

  async unsubscribePageFromWebhook(
    pageId: string,
    accessToken: string,
  ): Promise<void> {
    await this.delete(`/${pageId}/subscribed_apps`, {
      access_token: accessToken,
    });
  }

  // ─── Posts ────────────────────────────────────────────────────────────────

  async getPagePosts(
    pageId: string,
    accessToken: string,
    limit = 10,
  ): Promise<FbPost[]> {
    const result = await this.get<FbPaginatedResponse<FbPost>>(
      `/${pageId}/posts`,
      {
        access_token: accessToken,
        limit,
        fields:
          'id,message,full_picture,permalink_url,created_time,reactions.summary(true),comments.summary(true),shares',
      },
    );
    return result.data;
  }

  // ─── Comments ─────────────────────────────────────────────────────────────

  async getPostComments(
    postId: string,
    accessToken: string,
    limit = 25,
  ): Promise<FbComment[]> {
    const result = await this.get<FbPaginatedResponse<FbComment>>(
      `/${postId}/comments`,
      {
        access_token: accessToken,
        limit,
        fields: 'id,message,from,created_time',
        filter: 'toplevel',
      },
    );
    return result.data;
  }

  async getCommentById(
    commentId: string,
    accessToken: string,
  ): Promise<FbComment> {
    return this.get<FbComment>(`/${commentId}`, {
      access_token: accessToken,
      fields: 'id,message,from,created_time',
    });
  }

  async getCommentReplies(
    commentId: string,
    accessToken: string,
    limit = 25,
  ): Promise<FbComment[]> {
    const result = await this.get<FbPaginatedResponse<FbComment>>(
      `/${commentId}/comments`,
      {
        access_token: accessToken,
        limit,
        fields: 'id,message,from,created_time',
        filter: 'stream',
      },
    );
    return result.data;
  }

  async getUserNameById(
    userId: string,
    accessToken: string,
  ): Promise<string | null> {
    const user = await this.get<FbGraphUserName>(`/${userId}`, {
      access_token: accessToken,
      fields: 'id,name',
    });
    return user.name?.trim() || null;
  }

  async replyToComment(
    commentId: string,
    message: string,
    accessToken: string,
  ): Promise<{ id: string }> {
    return this.post<{ id: string }>(
      `/${commentId}/comments`,
      { message },
      { access_token: accessToken },
    );
  }

  // ─── Messenger ────────────────────────────────────────────────────────────

  async sendTextMessage(
    recipientPsid: string,
    text: string,
    pageAccessToken: string,
  ): Promise<FbSendMessageResponse> {
    return this.post<FbSendMessageResponse>(
      '/me/messages',
      { recipient: { id: recipientPsid }, message: { text } },
      { access_token: pageAccessToken },
    );
  }

  async sendImageMessage(
    recipientPsid: string,
    imageUrl: string,
    pageAccessToken: string,
  ): Promise<FbSendMessageResponse> {
    return this.post<FbSendMessageResponse>(
      '/me/messages',
      {
        recipient: { id: recipientPsid },
        message: {
          attachment: {
            type: 'image',
            payload: { url: imageUrl, is_reusable: true },
          },
        },
      },
      { access_token: pageAccessToken },
    );
  }

  async sendImageMessageFromFile(
    recipientPsid: string,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    pageAccessToken: string,
  ): Promise<FbSendMessageResponse> {
    const url = this.buildUrl('/me/messages');
    url.searchParams.set('access_token', pageAccessToken);

    const form = new FormData();
    form.set('recipient', JSON.stringify({ id: recipientPsid }));
    form.set(
      'message',
      JSON.stringify({
        attachment: {
          type: 'image',
          payload: { is_reusable: false },
        },
      }),
    );
    form.set(
      'filedata',
      new Blob([new Uint8Array(fileBuffer)], { type: mimeType }),
      fileName,
    );

    this.logger.debug('→ POST /me/messages (multipart file upload)');
    const response = await fetch(url.toString(), {
      method: 'POST',
      body: form,
    });
    const body: unknown = await response.json().catch(() => ({}));

    if (
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      (body as Record<string, unknown>).error
    ) {
      throw mapGraphApiError(
        (body as { error: Parameters<typeof mapGraphApiError>[0] }).error,
      );
    }
    if (!response.ok) {
      throw new Error(
        `Graph multipart upload failed with HTTP ${response.status}`,
      );
    }

    this.logger.debug('✓ POST /me/messages (multipart file upload)');
    return body as FbSendMessageResponse;
  }

  /** Mark a message as seen (sender action). */
  async markMessageSeen(
    recipientPsid: string,
    pageAccessToken: string,
  ): Promise<void> {
    await this.post(
      '/me/messages',
      { recipient: { id: recipientPsid }, sender_action: 'mark_seen' },
      { access_token: pageAccessToken },
    );
  }

  async getMessengerUserProfile(
    psid: string,
    pageAccessToken: string,
  ): Promise<FbMessengerUserProfile> {
    return this.get<FbMessengerUserProfile>(`/${psid}`, {
      access_token: pageAccessToken,
      fields: 'name,first_name,last_name,profile_pic',
    });
  }

  async getConversations(
    pageId: string,
    accessToken: string,
    limit = 20,
  ): Promise<FbConversation[]> {
    const result = await this.get<FbPaginatedResponse<FbConversation>>(
      `/${pageId}/conversations`,
      {
        access_token: accessToken,
        platform: 'messenger',
        limit,
        fields:
          'id,updated_time,participants,messages{id,message,from,created_time}',
      },
    );
    return result.data;
  }

  async getConversationMessages(
    conversationId: string,
    accessToken: string,
    limit = 25,
  ): Promise<FbMessage[]> {
    const result = await this.get<FbPaginatedResponse<FbMessage>>(
      `/${conversationId}/messages`,
      {
        access_token: accessToken,
        limit,
        fields: 'id,message,from,to,created_time,attachments',
      },
    );
    return result.data;
  }

  // ─── Page Feed ────────────────────────────────────────────────────────────

  async getPageFeed(
    pageId: string,
    accessToken: string,
    limit = 20,
  ): Promise<FbPost[]> {
    const result = await this.get<FbPaginatedResponse<FbPost>>(
      `/${pageId}/feed`,
      {
        access_token: accessToken,
        limit,
        fields:
          'id,message,created_time,permalink_url,reactions.summary(true),comments.summary(true),shares',
      },
    );
    return result.data;
  }

  // ─── Private Reply to Comment ─────────────────────────────────────────────
  //
  // Facebook allows this as a "Private Reply" when responding to a comment on
  // the page's post. Requires pages_messaging permission.
  //
  // API: POST /{page-id}/messages
  // Body: { recipient: { comment_id: "..." }, message: { text: "..." } }

  async sendPrivateReplyToComment(
    pageId: string,
    commentId: string,
    text: string,
    accessToken: string,
  ): Promise<{ message_id?: string }> {
    return this.post<{ message_id?: string }>(
      `/${pageId}/messages`,
      {
        recipient: { comment_id: commentId },
        message: { text },
      },
      { access_token: accessToken },
    );
  }
}
