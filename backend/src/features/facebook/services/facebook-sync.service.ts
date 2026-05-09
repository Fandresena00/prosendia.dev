/**
 * @file features/facebook/services/facebook-sync.service.ts
 *
 * On-demand sync from the Facebook Graph API into the local DB.
 * Called by the HTTP controller (manual trigger) and the inbox scheduler.
 *
 * ACCURACY GUARANTEES
 * ───────────────────
 * Every field stored in the DB comes directly from Facebook's Graph API
 * response — never from backend-computed values:
 *   - Message content:    fbMsg.message  (not user input)
 *   - Message timestamp:  fbMsg.created_time  (Facebook's clock, not Date.now())
 *   - Client name:        Messenger profile API
 *   - Client avatar:      Messenger profile API (normalized to HTTPS)
 *   - Reaction counts:    post.reactions.summary.total_count
 *   - Comment counts:     post.comments.summary.total_count
 *
 * CHANGES FROM PREVIOUS VERSION
 * ──────────────────────────────
 *   - syncConversations: refreshes clientName + clientAvatarUrl from the
 *     Graph API on every sync (previously only set on first create).
 *   - syncConversationMessages: uses fbMsg.created_time as the message
 *     timestamp (previously fell back to Date.now() for upsert-created msgs).
 *   - All avatar URLs normalized to HTTPS before storage.
 *   - normalizeUrl() helper extracted and used consistently.
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import { FacebookGraphClient } from '../clients/facebook-graph.client.js';
import { FacebookAccountService } from './facebook-account.service.js';

@Injectable()
export class FacebookSyncService {
  private readonly logger = new Logger(FacebookSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly graphClient: FacebookGraphClient,
    private readonly accounts: FacebookAccountService,
  ) {}

  // ─── Posts ────────────────────────────────────────────────────────────────

  async syncPosts(
    businessProfileId: string,
    userId: string,
    limit = 10,
  ): Promise<number> {
    const connection = await this.accounts.requireByProfileId(
      businessProfileId,
      userId,
    );

    const fbPosts = await this.graphClient.getPagePosts(
      connection.pageId,
      connection.decryptedToken,
      limit,
    );

    let syncedCount = 0;

    for (const post of fbPosts) {
      await this.prisma.facebookPost.upsert({
        where: { externalId: post.id },
        create: {
          businessProfileId,
          externalId: post.id,
          message: post.message ?? null,
          imageUrl: post.full_picture ?? null,
          permalinkUrl: post.permalink_url ?? null,
          reactionsCount: post.reactions?.summary.total_count ?? 0,
          commentsCount: post.comments?.summary.total_count ?? 0,
          sharesCount: post.shares?.count ?? 0,
          publishedAt: new Date(post.created_time),
          lastSyncedAt: new Date(),
        },
        update: {
          message: post.message ?? null,
          imageUrl: post.full_picture ?? null,
          reactionsCount: post.reactions?.summary.total_count ?? 0,
          commentsCount: post.comments?.summary.total_count ?? 0,
          sharesCount: post.shares?.count ?? 0,
          lastSyncedAt: new Date(),
        },
      });
      syncedCount++;
    }

    await this.prisma.facebookConnection.update({
      where: { id: connection.id },
      data: { lastSyncedAt: new Date() },
    });

    this.logger.log(
      `Synced ${syncedCount} posts for profile=${businessProfileId}`,
    );
    return syncedCount;
  }

  // ─── Post comments ────────────────────────────────────────────────────────

  async syncPostComments(
    postId: string,
    userId: string,
    limit = 25,
  ): Promise<number> {
    const post = await this.prisma.facebookPost.findUnique({
      where: { id: postId },
      include: { businessProfile: true },
    });

    if (!post || post.businessProfile.userId !== userId) {
      throw new NotFoundException(`Post ${postId} not found.`);
    }

    const connection = await this.accounts.requireByProfileId(
      post.businessProfileId,
      userId,
    );
    const fbComments = await this.graphClient.getPostComments(
      post.externalId,
      connection.decryptedToken,
      limit,
    );

    let syncedCount = 0;

    for (const comment of fbComments) {
      await this.prisma.postComment.upsert({
        where: { externalId: comment.id },
        create: {
          postId,
          externalId: comment.id,
          authorId: comment.from?.id ?? 'unknown',
          authorName: comment.from?.name ?? 'Unknown',
          message: comment.message,
          commentedAt: new Date(comment.created_time),
          lastSyncedAt: new Date(),
        },
        update: {
          // FIX: always update content to match Facebook (handles edits)
          message: comment.message,
          lastSyncedAt: new Date(),
        },
      });
      syncedCount++;
    }

    return syncedCount;
  }

  // ─── Conversations ────────────────────────────────────────────────────────

  /**
   * Syncs the conversation list from the Facebook Graph API.
   *
   * FIX: On every sync (not just on create), refreshes:
   *   - clientName       from Messenger profile API
   *   - clientAvatarUrl  from Messenger profile API (normalized to HTTPS)
   *
   * This ensures that if a client changes their name or avatar on Facebook,
   * the inbox reflects it within the next sync cycle (5 minutes).
   */
  async syncConversations(
    businessProfileId: string,
    userId: string,
    limit = 20,
  ): Promise<number> {
    const connection = await this.accounts.requireByProfileId(
      businessProfileId,
      userId,
    );
    const fbConversations = await this.graphClient.getConversations(
      connection.pageId,
      connection.decryptedToken,
      limit,
    );

    let syncedCount = 0;

    for (const fbConv of fbConversations) {
      // Identify the client participant (not the page)
      const clientParticipant = fbConv.participants?.data.find(
        (p) => p.id !== connection.pageId,
      );

      // Fetch fresh profile info from Messenger API (name + avatar)
      const freshProfile = clientParticipant
        ? await this.fetchClientProfile(
            clientParticipant.id,
            connection.pageId,
            connection.decryptedToken,
          )
        : null;

      const normalizedAvatarUrl = this.normalizeUrl(
        freshProfile?.profile_pic ?? null,
      );
      const displayName = freshProfile?.name ?? clientParticipant?.name ?? null;

      await this.prisma.conversation.upsert({
        where: {
          businessProfileId_externalId: {
            businessProfileId,
            externalId: fbConv.id,
          },
        },
        create: {
          businessProfileId,
          externalId: fbConv.id,
          clientPsid: clientParticipant?.id ?? null,
          clientName: displayName,
          clientAvatarUrl: normalizedAvatarUrl,
          lastMessageAt: new Date(fbConv.updated_time),
        },
        update: {
          // FIX: always refresh — Facebook is the source of truth
          clientPsid: clientParticipant?.id ?? undefined,
          clientName: displayName ?? undefined,
          clientAvatarUrl: normalizedAvatarUrl ?? undefined,
          lastMessageAt: new Date(fbConv.updated_time),
        },
      });

      syncedCount++;
    }

    this.logger.log(
      `Synced ${syncedCount} conversations for profile=${businessProfileId}`,
    );
    return syncedCount;
  }

  // ─── Messages for a conversation ──────────────────────────────────────────

  /**
   * Pulls individual messages for a conversation from the Graph API.
   *
   * FIX: Uses Facebook's `created_time` as the message timestamp, NOT Date.now().
   * This ensures the timeline in the inbox matches the timeline on Facebook
   * exactly — including messages that arrived while the server was down.
   */
  async syncConversationMessages(
    conversationId: string,
    userId: string,
    limit = 25,
  ): Promise<number> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { businessProfile: true },
    });

    if (!conversation || conversation.businessProfile.userId !== userId) {
      throw new NotFoundException(`Conversation ${conversationId} not found.`);
    }

    const connection = await this.accounts.requireByProfileId(
      conversation.businessProfileId,
      userId,
    );

    const fbMessages = await this.graphClient.getConversationMessages(
      conversation.externalId,
      connection.decryptedToken,
      limit,
    );

    let syncedCount = 0;

    for (const fbMsg of fbMessages) {
      const senderRole =
        fbMsg.from.id === connection.pageId ? 'PAGE' : 'CLIENT';

      // FIX: Use Facebook's timestamp as the authoritative createdAt.
      // The Graph API returns created_time in ISO 8601 format.
      const fbCreatedAt = fbMsg.created_time
        ? new Date(fbMsg.created_time)
        : undefined;

      await this.prisma.message.upsert({
        where: { externalId: fbMsg.id },
        create: {
          conversationId,
          externalId: fbMsg.id,
          sender: senderRole,
          content: fbMsg.message ?? null,
          status: 'DELIVERED',
          // Always use Facebook's timestamp on create
          ...(fbCreatedAt ? { createdAt: fbCreatedAt } : {}),
        },
        update: {
          // FIX: update content to catch message edits on Facebook
          content: fbMsg.message ?? null,
        },
      });

      syncedCount++;
    }

    this.logger.log(
      `Synced ${syncedCount} messages for conversation=${conversationId}`,
    );
    return syncedCount;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Fetches a Messenger user's display name and profile picture.
   * Returns null on any error (profile fetch is always best-effort).
   */
  private async fetchClientProfile(
    psid: string,
    pageId: string,
    decryptedToken: string,
  ): Promise<{ name: string | null; profile_pic: string | null } | null> {
    try {
      const profile = await this.graphClient.getMessengerUserProfile(
        psid,
        decryptedToken,
      );
      const name =
        (profile.name ??
          [profile.first_name, profile.last_name]
            .filter(Boolean)
            .join(' ')
            .trim()) ||
        null;
      return {
        name: name || null,
        profile_pic: profile.profile_pic ?? null,
      };
    } catch {
      return null;
    }
  }

  /**
   * Normalizes a URL to HTTPS.
   * Facebook CDN sometimes returns http:// URLs — upgrade them silently.
   */
  private normalizeUrl(rawUrl: string | null): string | null {
    if (!rawUrl) return null;
    if (rawUrl.startsWith('http://')) return `https://${rawUrl.slice(7)}`;
    return rawUrl;
  }
}
