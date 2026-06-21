/**
 * @file features/facebook/services/facebook-auth.service.ts
 *
 * Full OAuth flow: build URL → exchange code → connect page → disconnect.
 *
 * KEY FIXES
 * ─────────
 * 1. connectPage: businessProfileId may be a non-UUID string (e.g. 'default'
 *    from the OAuth state parameter when the user has no profile yet).
 *    The service now validates the UUID itself before doing a DB lookup,
 *    instead of relying on the DTO validator which was throwing 400.
 *
 * 2. connectPage: an orphaned profile (no FacebookConnection) can still
 *    occur if a PREVIOUS connectPage() call failed after creating the
 *    profile but before the connection was saved (e.g. token validation
 *    failed midway). If no profile is found by ID, the service looks for
 *    such an orphan for this user and reuses it instead of creating a
 *    duplicate. NOTE: this no longer has anything to do with disconnectPage
 *    — see fix #3, disconnect no longer leaves orphans behind.
 *
 * 3. disconnectPage: now PERMANENTLY DELETES the BusinessProfile and every
 *    piece of data tied to it — conversations, messages, reference preset
 *    images (DB rows AND the files on disk), managed posts, comments,
 *    AI config, AND page-scoped notifications (HUMAN_TAKEOVER_REQUIRED,
 *    ANGRY_CLIENT_DETECTED, etc. — these are NOT cascade-deleted by the
 *    schema since Notification only cascades from User, not BusinessProfile,
 *    so they are explicitly cleaned up here). Disconnecting a page is a
 *    clean slate, not a pause.
 *
 *    Race-window mitigation: the FacebookConnection is flipped to
 *    isActive=false FIRST, before anything else — getByPageId() and
 *    isTokenUsableForWebhook() both filter on isActive, so any webhook
 *    delivered from this point on is rejected before it can write a new
 *    row. The remaining snapshot (file URLs to delete from disk) + the
 *    notification cleanup + the BusinessProfile delete itself all run
 *    inside a single Prisma transaction, so they commit atomically.
 *
 *    NOTE — CreditLedger.conversationId / .commentId are intentionally left
 *    untouched: CreditLedger belongs to the User (billing/audit trail), not
 *    to a BusinessProfile, and is never wiped by a page disconnect.
 */

import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaService } from '../../../database/prisma.service.js';
import { BILLING_PLANS, type PlanId } from '../../billing/billing.constants.js';
import { FacebookGraphClient } from '../clients/facebook-graph.client.js';
import { ConnectPageDto } from '../dto/auth/connect-page.dto.js';
import { FacebookConnectionResponseDto } from '../dto/auth/facebook-connection-response.dto.js';
import {
  FACEBOOK_API,
  FACEBOOK_SCOPES,
  FACEBOOK_WEBHOOK_FIELDS,
} from '../facebook.constants.js';
import { TokenEncryptionService } from '../security/token-encryption.service.js';

/** Regex for UUID v4 validation (mirrors class-validator's @IsUUID('4')). */
const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuidV4(value: string | undefined | null): value is string {
  return !!value && UUID_V4_RE.test(value);
}

/**
 * Maps a URL path marker to the physical directory it is served from on
 * disk (relative to `process.cwd()`). Used exclusively by disconnectPage()
 * to clean up locally-stored files once their DB rows are gone.
 *
 * Only LOCAL files match one of these markers. Remote Facebook CDN URLs
 * (e.g. FacebookPost.imageUrl, always graph.facebook.com / fbcdn.net) never
 * match and are safely left untouched — we only ever delete files this
 * server itself wrote to disk.
 */
const LOCAL_UPLOAD_DIRS: ReadonlyArray<{ marker: string; dir: string }> = [
  { marker: '/inbox/uploads/', dir: 'uploads/inbox/references' }, // reference preset images — UploadService
  { marker: '/uploads/inbox/temp/', dir: 'uploads/inbox/temp' }, // ad-hoc sends — UploadService
  { marker: '/uploads/media/', dir: 'uploads/media' }, // downloaded Messenger attachments — MediaDownloadService
  { marker: '/uploads/temp/', dir: 'uploads/temp' }, // ad-hoc sends — TempUploadService
];

export interface OAuthPageOption {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly accessToken: string;
  readonly instagramAccountId: string | null;
}

@Injectable()
export class FacebookAuthService {
  private readonly logger = new Logger(FacebookAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly graphClient: FacebookGraphClient,
    private readonly encryption: TokenEncryptionService,
    private readonly configService: ConfigService,
  ) {}

  // ─── Step 1 — Build OAuth URL ─────────────────────────────────────────────

  buildOAuthUrl(businessProfileId: string): string {
    const appId = this.configService.getOrThrow<string>('facebookAppId');
    const frontendUrl = this.configService.getOrThrow<string>('frontendUrl');

    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: `${frontendUrl}/facebook/callback`,
      scope: FACEBOOK_SCOPES.join(','),
      state: businessProfileId,
      response_type: 'code',
    });

    return `${FACEBOOK_API.DIALOG_URL}?${params.toString()}`;
  }

  // ─── Step 2 — OAuth callback ──────────────────────────────────────────────

  async handleCallback(code: string): Promise<OAuthPageOption[]> {
    const frontendUrl = this.configService.getOrThrow<string>('frontendUrl');

    const shortToken = await this.graphClient.exchangeCodeForToken(
      code,
      `${frontendUrl}/facebook/callback`,
    );
    const longToken = await this.graphClient.extendToken(shortToken);
    const pages = await this.graphClient.getUserPages(longToken);

    return pages.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      accessToken: p.access_token,
      instagramAccountId: p.instagram_business_account?.id ?? null,
    }));
  }

  // ─── Step 3 — Connect page ────────────────────────────────────────────────

  async connectPage(
    dto: ConnectPageDto,
    userId: string,
  ): Promise<FacebookConnectionResponseDto> {
    // ── Resolve BusinessProfile ───────────────────────────────────────────
    //
    // Priority:
    //   1. dto.businessProfileId is a valid UUID → look up that profile for user
    //   2. Not found / not UUID → look for an orphaned profile (no connection)
    //   3. No orphan → create a new profile
    //
    // An "orphaned" profile here is one left behind by a PREVIOUS connectPage()
    // call that created the profile but failed before saving the connection.
    // disconnectPage() no longer produces orphans — it deletes the profile
    // entirely (see disconnectPage() below).

    let profile: { id: string } | null = null;

    if (isUuidV4(dto.businessProfileId)) {
      profile = await this.prisma.businessProfile.findFirst({
        where: { id: dto.businessProfileId, userId },
        select: { id: true },
      });
    }

    if (!profile) {
      // An orphan (no FacebookConnection) can only exist here if a PREVIOUS
      // connectPage() call failed after creating the profile but before the
      // connection was saved (e.g. token validation threw). Reuse it instead
      // of creating a duplicate. This is unrelated to disconnectPage(), which
      // now deletes the profile entirely — see disconnectPage() below.
      profile = await this.prisma.businessProfile.findFirst({
        where: {
          userId,
          facebookConnection: null, // Prisma null check on optional one-to-one
        },
        select: { id: true },
        orderBy: { updatedAt: 'desc' }, // Pick the most recently used one
      });

      if (profile) {
        this.logger.log(
          `Reusing orphaned BusinessProfile ${profile.id} for user ${userId} (page: ${dto.pageName})`,
        );
      }
    }

    if (!profile) {
      // No existing profile — create a fresh one.
      profile = await this.prisma.businessProfile.create({
        data: {
          name: dto.pageName,
          businessType: 'OTHER',
          user: { connect: { id: userId } },
        },
        select: { id: true },
      });
      this.logger.log(
        `Created BusinessProfile ${profile.id} for user ${userId} (page: ${dto.pageName})`,
      );
    }

    // ── Conflict check ─────────────────────────────────────────────────────
    // Prevent the same Facebook page from being connected to a DIFFERENT profile.

    const existing = await this.prisma.facebookConnection.findUnique({
      where: { pageId: dto.pageId },
    });
    if (existing && existing.businessProfileId !== profile.id) {
      throw new ConflictException(
        `Page ${dto.pageId} is already connected to another business profile.`,
      );
    }

    // ── Plan limit check (point: limite selon le plan actuel) ─────────────
    //
    // Only enforced for a GENUINELY NEW connection. Reconnecting a page
    // that's already linked to THIS profile (existing?.businessProfileId
    // === profile.id, e.g. a token refresh / re-auth) never counts against
    // the limit — it's not adding a new page, just updating one.
    const isNewConnection = !existing;
    if (isNewConnection) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { activePlan: true },
      });
      const planId = (user?.activePlan ?? 'FREE') as PlanId;
      const planConfig = BILLING_PLANS[planId];
      const maxPages = planConfig?.maxPages ?? null;

      if (maxPages !== null) {
        const connectedCount = await this.prisma.facebookConnection.count({
          where: { businessProfile: { userId } },
        });

        if (connectedCount >= maxPages) {
          throw new BadRequestException(
            `Limite du plan ${planConfig?.name ?? planId} atteinte ` +
              `(${maxPages} page${maxPages > 1 ? 's' : ''} Facebook connectée${maxPages > 1 ? 's' : ''} ` +
              `maximum). Déconnectez une page existante ou passez à un ` +
              `abonnement supérieur pour en connecter davantage.`,
          );
        }
      }
    }

    // ── Validate the page token ────────────────────────────────────────────
    //
    // Moved AFTER the plan-limit check so a user who has already hit their
    // limit gets an immediate, clear error without an unnecessary Graph API
    // round-trip to validate a token we're about to reject anyway.

    const isValid = await this.graphClient.isTokenValid(dto.pageAccessToken);
    if (!isValid) {
      throw new BadRequestException(
        'The provided page access token is invalid or expired.',
      );
    }

    // ── Encrypt token and resolve scopes ──────────────────────────────────

    const encryptedAccessToken = this.encryption.encrypt(dto.pageAccessToken);
    const appId = this.configService.getOrThrow<string>('facebookAppId');
    const debug = await this.graphClient.debugToken(dto.pageAccessToken);

    const grantedScopes =
      debug?.scopes?.map((s) => s.trim()).filter(Boolean) ??
      dto.grantedScopes
        ?.split(',')
        .map((s) => s.trim())
        .filter(Boolean) ??
      [];

    // ── Upsert FacebookConnection ─────────────────────────────────────────

    const connection = await this.prisma.facebookConnection.upsert({
      where: { pageId: dto.pageId },
      create: {
        businessProfileId: profile.id,
        pageId: dto.pageId,
        pageName: dto.pageName,
        encryptedAccessToken,
        appId,
        grantedScopes,
        instagramAccountId: dto.instagramAccountId ?? null,
        tokenStatus: 'VALID',
        tokenValidatedAt: new Date(),
        isActive: true,
      },
      update: {
        pageName: dto.pageName,
        encryptedAccessToken,
        grantedScopes,
        instagramAccountId: dto.instagramAccountId ?? null,
        tokenStatus: 'VALID',
        tokenValidatedAt: new Date(),
        isActive: true,
      },
    });

    this.logger.log(
      `Connected page ${dto.pageId} → profile ${profile.id} ` +
        `(scopes: ${grantedScopes.join(', ') || '(none)'})`,
    );

    // ── Subscribe to webhook (best-effort) ────────────────────────────────

    await this.trySubscribeWebhook(
      connection.id,
      dto.pageId,
      dto.pageAccessToken,
    );

    return this.toResponseDto(connection);
  }

  // ─── Step 4 — Disconnect ──────────────────────────────────────────────────

  /**
   * Disconnects a Facebook page and PERMANENTLY DELETES every piece of data
   * tied to its BusinessProfile:
   *   - The FacebookConnection itself (token, scopes, webhook subscription)
   *   - All conversations and messages (the whole inbox for this page)
   *   - All reference preset images — ChatResource + ChatResourceImage rows
   *     AND the physical image files on disk
   *   - All managed posts, their comments, and PostAiConfig
   *   - AiConfig and AiModelConfig
   *   - Page-scoped Notification rows (HUMAN_TAKEOVER_REQUIRED,
   *     ANGRY_CLIENT_DETECTED, HOT_PROSPECT, etc.) — NOT covered by the
   *     schema's cascades (Notification only cascades from User), so they
   *     are removed explicitly below.
   *
   * "Disconnect" is a clean slate, not a pause: reconnecting the same page
   * afterwards always starts from a brand-new BusinessProfile with no
   * memory of the previous one. No orphaned profile is kept around for
   * reuse (the only orphan-reuse case left is documented in connectPage()
   * — a failed connection attempt, not a disconnect).
   *
   * Deletion order:
   *   0. Flip the connection to isActive=false FIRST, before anything else.
   *      getByPageId() and isTokenUsableForWebhook() both filter on
   *      isActive, so any webhook delivered from this point on is rejected
   *      immediately, instead of racing to write a new conversation/message
   *      row while we're mid-deletion.
   *   1. Best-effort webhook unsubscribe from Facebook.
   *   2. A single DB transaction that: snapshots every locally-stored file
   *      URL (reference images, message attachments) still in the DB at
   *      that moment, deletes Notification rows tied to this page or one
   *      of its conversations, then deletes the BusinessProfile itself —
   *      whose database-level cascades (`onDelete: Cascade` in
   *      schema.prisma) remove FacebookConnection, AiConfig, AiModelConfig,
   *      Conversation → Message / ConversationSummary / AiReplyLog,
   *      FacebookPost → PostComment / PostAiConfig, and
   *      ChatResource → ChatResourceImage. All three steps commit or roll
   *      back together.
   *   3. Best-effort cleanup of the physical files snapshotted in step 2.
   *      Filesystem operations aren't transactional, so this runs after the
   *      DB transaction has committed; a failure here never rolls back the
   *      (already-committed) DB deletion.
   *
   * Deliberately NOT touched: CreditLedger.conversationId / .commentId.
   * CreditLedger belongs to the User (billing/audit trail), not to a
   * BusinessProfile — it must survive a page disconnect intact.
   */
  async disconnectPage(
    businessProfileId: string,
    userId: string,
  ): Promise<void> {
    const conn = await this.prisma.facebookConnection.findFirst({
      where: { businessProfileId, businessProfile: { userId } },
    });
    if (!conn) throw new NotFoundException('Facebook connection not found.');

    // Step 0 — close the webhook race window immediately.
    await this.prisma.facebookConnection.update({
      where: { id: conn.id },
      data: { isActive: false },
    });

    // Step 1 — best-effort webhook unsubscribe.
    try {
      const token = this.encryption.decrypt(conn.encryptedAccessToken);
      await this.graphClient.unsubscribePageFromWebhook(conn.pageId, token);
    } catch {
      this.logger.warn(
        `Could not unsubscribe page ${conn.pageId} from webhook during disconnect`,
      );
    }

    // Step 2 — snapshot + notification cleanup + cascading delete, atomic.
    const localFileUrls = await this.prisma.$transaction(async (tx) => {
      const conversations = await tx.conversation.findMany({
        where: { businessProfileId },
        select: { id: true },
      });
      const conversationIds = conversations.map((c) => c.id);

      const [chatResourceImages, messages] = await Promise.all([
        tx.chatResourceImage.findMany({
          where: { chatResource: { businessProfileId } },
          select: { url: true },
        }),
        tx.message.findMany({
          where: { conversationId: { in: conversationIds } },
          select: { imageUrl: true, fileUrl: true },
        }),
      ]);

      // Notification is NOT cascade-deleted by businessProfile.delete() —
      // it only cascades from User. Remove anything tied to this page
      // (clientFbPageId) or to one of its now-deleted conversations.
      await tx.notification.deleteMany({
        where: {
          userId,
          OR: [
            { clientFbPageId: conn.pageId },
            { conversationId: { in: conversationIds } },
          ],
        },
      });

      await tx.businessProfile.delete({ where: { id: businessProfileId } });

      const urls: string[] = chatResourceImages.map((image) => image.url);
      for (const message of messages) {
        if (message.imageUrl) urls.push(message.imageUrl);
        if (message.fileUrl) urls.push(message.fileUrl);
      }
      return urls;
    });

    // Step 3 — best-effort physical file cleanup (outside the transaction:
    // the filesystem has no rollback).
    await this.deleteLocalFiles(localFileUrls);

    this.logger.log(
      `Disconnected page ${conn.pageId} for user ${userId} — business ` +
        `profile ${businessProfileId} and all related data permanently deleted ` +
        `(conversations, messages, reference images, managed posts, ` +
        `notifications, AI config).`,
    );
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Best-effort deletion of locally-stored files from disk.
   * Never throws: a file that is already gone (or was never local — e.g. a
   * Facebook CDN URL) is simply skipped. A failure here must never be
   * allowed to surface as an error to the caller — the DB deletion has
   * already committed by the time this runs.
   */
  private async deleteLocalFiles(urls: string[]): Promise<void> {
    let deletedCount = 0;

    await Promise.all(
      urls.map(async (url) => {
        const target = LOCAL_UPLOAD_DIRS.find(({ marker }) =>
          url.includes(marker),
        );
        if (!target) return; // remote URL (Facebook CDN) — nothing local to delete

        let filename: string;
        try {
          filename = path.basename(new URL(url).pathname);
        } catch {
          return; // malformed URL — skip rather than risk building a bad path
        }

        const targetDir = path.join(process.cwd(), target.dir);
        const absolutePath = path.join(targetDir, filename);

        // Defence-in-depth: resolved path must stay inside targetDir.
        if (!absolutePath.startsWith(targetDir + path.sep)) return;

        try {
          await fs.unlink(absolutePath);
          deletedCount++;
        } catch {
          // Already deleted, or never existed on this instance — not fatal.
        }
      }),
    );

    if (deletedCount > 0) {
      this.logger.log(
        `Removed ${deletedCount} local file(s) from disk during page disconnect`,
      );
    }
  }

  private async trySubscribeWebhook(
    connectionId: string,
    pageId: string,
    pageAccessToken: string,
  ): Promise<void> {
    try {
      await this.graphClient.subscribePageToWebhook(
        pageId,
        pageAccessToken,
        FACEBOOK_WEBHOOK_FIELDS,
      );
      await this.prisma.facebookConnection.update({
        where: { id: connectionId },
        data: { webhookSubscribed: true },
      });
      this.logger.log(`Webhook subscribed for page ${pageId}`);
    } catch (error) {
      this.logger.warn(
        `Webhook subscription failed for page ${pageId}: ${(error as Error).message}`,
      );
    }
  }

  private toResponseDto(
    conn: Awaited<ReturnType<typeof this.prisma.facebookConnection.upsert>>,
  ): FacebookConnectionResponseDto {
    return {
      id: conn.id,
      businessProfileId: conn.businessProfileId,
      pageId: conn.pageId,
      pageName: conn.pageName,
      tokenStatus: conn.tokenStatus,
      tokenValidatedAt: conn.tokenValidatedAt,
      tokenExpiresAt: conn.tokenExpiresAt,
      webhookSubscribed: conn.webhookSubscribed,
      isActive: conn.isActive,
      grantedScopes: conn.grantedScopes as string[],
      instagramAccountId: conn.instagramAccountId,
      lastSyncedAt: conn.lastSyncedAt,
      createdAt: conn.createdAt,
    };
  }
}
