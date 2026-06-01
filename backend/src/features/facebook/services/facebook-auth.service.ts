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
 * 2. connectPage: after a disconnect, the BusinessProfile remains in DB
 *    (orphaned — no FacebookConnection). When the user reconnects, the old
 *    code created a NEW profile, leaving duplicates and losing AI config.
 *    Fix: if no profile is found by ID, look for an orphaned profile for
 *    this user (one that has no FacebookConnection), and reuse it.
 *    Only create a new profile if no orphan exists.
 *
 * 3. disconnectPage: does NOT delete the BusinessProfile. The profile holds
 *    AI config, conversation history, and reference presets. Deleting it
 *    would destroy user data silently. The orphan-reuse logic in connectPage
 *    handles reconnection cleanly.
 */

import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service.js';
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

export interface OAuthPageOption {
  readonly id:                  string;
  readonly name:                string;
  readonly category:            string;
  readonly accessToken:         string;
  readonly instagramAccountId:  string | null;
}

@Injectable()
export class FacebookAuthService {
  private readonly logger = new Logger(FacebookAuthService.name);

  constructor(
    private readonly prisma:        PrismaService,
    private readonly graphClient:   FacebookGraphClient,
    private readonly encryption:    TokenEncryptionService,
    private readonly configService: ConfigService,
  ) {}

  // ─── Step 1 — Build OAuth URL ─────────────────────────────────────────────

  buildOAuthUrl(businessProfileId: string): string {
    const appId       = this.configService.getOrThrow<string>('facebookAppId');
    const frontendUrl = this.configService.getOrThrow<string>('frontendUrl');

    const params = new URLSearchParams({
      client_id:     appId,
      redirect_uri:  `${frontendUrl}/facebook/callback`,
      scope:         FACEBOOK_SCOPES.join(','),
      state:         businessProfileId,
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
    const pages     = await this.graphClient.getUserPages(longToken);

    return pages.map((p) => ({
      id:                   p.id,
      name:                 p.name,
      category:             p.category,
      accessToken:          p.access_token,
      instagramAccountId:   p.instagram_business_account?.id ?? null,
    }));
  }

  // ─── Step 3 — Connect page ────────────────────────────────────────────────

  async connectPage(
    dto:    ConnectPageDto,
    userId: string,
  ): Promise<FacebookConnectionResponseDto> {

    // ── Resolve BusinessProfile ───────────────────────────────────────────
    //
    // Priority:
    //   1. dto.businessProfileId is a valid UUID → look up that profile for user
    //   2. Not found / not UUID → look for an orphaned profile (no connection)
    //   3. No orphan → create a new profile
    //
    // An "orphaned" profile is one that was left behind after a disconnect.
    // Reusing it preserves AI config, conversations, and reference presets.

    let profile: { id: string } | null = null;

    if (isUuidV4(dto.businessProfileId)) {
      profile = await this.prisma.businessProfile.findFirst({
        where:  { id: dto.businessProfileId, userId },
        select: { id: true },
      });
    }

    if (!profile) {
      // Look for a profile that has no FacebookConnection (disconnected / never connected).
      profile = await this.prisma.businessProfile.findFirst({
        where: {
          userId,
          facebookConnection: null, // Prisma null check on optional one-to-one
        },
        select:  { id: true },
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
          name:         dto.pageName,
          businessType: 'OTHER',
          user:         { connect: { id: userId } },
        },
        select: { id: true },
      });
      this.logger.log(
        `Created BusinessProfile ${profile.id} for user ${userId} (page: ${dto.pageName})`,
      );
    }

    // ── Validate the page token ────────────────────────────────────────────

    const isValid = await this.graphClient.isTokenValid(dto.pageAccessToken);
    if (!isValid) {
      throw new BadRequestException(
        'The provided page access token is invalid or expired.',
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

    // ── Encrypt token and resolve scopes ──────────────────────────────────

    const encryptedAccessToken = this.encryption.encrypt(dto.pageAccessToken);
    const appId                = this.configService.getOrThrow<string>('facebookAppId');
    const debug                = await this.graphClient.debugToken(dto.pageAccessToken);

    const grantedScopes =
      debug?.scopes?.map((s) => s.trim()).filter(Boolean) ??
      dto.grantedScopes?.split(',').map((s) => s.trim()).filter(Boolean) ??
      [];

    // ── Upsert FacebookConnection ─────────────────────────────────────────

    const connection = await this.prisma.facebookConnection.upsert({
      where:  { pageId: dto.pageId },
      create: {
        businessProfileId: profile.id,
        pageId:            dto.pageId,
        pageName:          dto.pageName,
        encryptedAccessToken,
        appId,
        grantedScopes,
        instagramAccountId: dto.instagramAccountId ?? null,
        tokenStatus:        'VALID',
        tokenValidatedAt:   new Date(),
        isActive:           true,
      },
      update: {
        pageName:            dto.pageName,
        encryptedAccessToken,
        grantedScopes,
        instagramAccountId:  dto.instagramAccountId ?? null,
        tokenStatus:         'VALID',
        tokenValidatedAt:    new Date(),
        isActive:            true,
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
   * Removes the FacebookConnection but intentionally keeps the BusinessProfile.
   *
   * The BusinessProfile may contain AI config, conversations, and reference
   * presets that the user would lose if we deleted it. When the user reconnects
   * a page, connectPage() will find this "orphaned" profile and reuse it.
   */
  async disconnectPage(
    businessProfileId: string,
    userId:            string,
  ): Promise<void> {
    const conn = await this.prisma.facebookConnection.findFirst({
      where: { businessProfileId, businessProfile: { userId } },
    });
    if (!conn) throw new NotFoundException('Facebook connection not found.');

    try {
      const token = this.encryption.decrypt(conn.encryptedAccessToken);
      await this.graphClient.unsubscribePageFromWebhook(conn.pageId, token);
    } catch {
      this.logger.warn(
        `Could not unsubscribe page ${conn.pageId} from webhook during disconnect`,
      );
    }

    await this.prisma.facebookConnection.delete({ where: { id: conn.id } });

    this.logger.log(
      `Disconnected page ${conn.pageId} for user ${userId} ` +
      `(BusinessProfile ${businessProfileId} preserved for reconnect)`,
    );
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async trySubscribeWebhook(
    connectionId:    string,
    pageId:          string,
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
        data:  { webhookSubscribed: true },
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
      id:                 conn.id,
      businessProfileId:  conn.businessProfileId,
      pageId:             conn.pageId,
      pageName:           conn.pageName,
      tokenStatus:        conn.tokenStatus,
      tokenValidatedAt:   conn.tokenValidatedAt,
      tokenExpiresAt:     conn.tokenExpiresAt,
      webhookSubscribed:  conn.webhookSubscribed,
      isActive:           conn.isActive,
      grantedScopes:      conn.grantedScopes as string[],
      instagramAccountId: conn.instagramAccountId,
      lastSyncedAt:       conn.lastSyncedAt,
      createdAt:          conn.createdAt,
    };
  }
}
