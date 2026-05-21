/**
 * FacebookAuthService — full OAuth flow, page connect and disconnect.
 *
 * Flow:
 *  1. buildOAuthUrl()   — frontend redirects the user to Facebook
 *  2. handleCallback()  — exchanges code for page tokens, returns page choices
 *  3. connectPage()     — user picks a page; we store the token and subscribe
 *  4. disconnectPage()  — unsubscribes webhook and removes the connection
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

/** Returned by handleCallback — what the frontend uses to render the page picker. */
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

  // ─── Step 1 — OAuth URL ───────────────────────────────────────────────────

  buildOAuthUrl(businessProfileId: string): string {
    const appId = this.configService.getOrThrow<string>('facebookAppId');
    const frontendUrl = this.configService.getOrThrow<string>('frontendUrl');

    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: `${frontendUrl}/facebook/callback`, // Must match the redirect URI set in Facebook App settings
      scope: FACEBOOK_SCOPES.join(','),
      state: businessProfileId, // Passed back as-is on the callback
      response_type: 'code',
    });

    return `${FACEBOOK_API.DIALOG_URL}?${params.toString()}`;
  }

  // ─── Step 2 — OAuth callback ──────────────────────────────────────────────

  /**
   * Exchanges the authorization code for a long-lived token, then fetches the
   * pages the user manages. The frontend uses the returned list to show a
   * page-picker UI before calling connectPage().
   *
   * Note: businessProfileId is available here (via state param) but not used
   * because this step only returns options — connectPage() binds the choice.
   */
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
    // 1. Resolve or auto-create the BusinessProfile
    let profile = dto.businessProfileId
      ? await this.prisma.businessProfile.findFirst({
          where: { id: dto.businessProfileId, userId },
        })
      : null;

    if (!profile) {
      profile = await this.prisma.businessProfile.create({
        data: {
          name: dto.pageName,
          businessType: 'OTHER',
          user: { connect: { id: userId } },
        },
      });
      this.logger.log(
        `Auto-created BusinessProfile ${profile.id} for user ${userId} (page: ${dto.pageName})`,
      );
    }

    // 2. Validate the page token before storing it
    const isValid = await this.graphClient.isTokenValid(dto.pageAccessToken);
    if (!isValid) {
      throw new BadRequestException(
        'The provided page access token is invalid or expired.',
      );
    }

    // 3. Conflict — same page already connected to a *different* profile
    const existing = await this.prisma.facebookConnection.findUnique({
      where: { pageId: dto.pageId },
    });
    if (existing && existing.businessProfileId !== profile.id) {
      throw new ConflictException(
        `Page ${dto.pageId} is already connected to another business profile.`,
      );
    }

    // 4. Encrypt and upsert the connection
    const encryptedAccessToken = this.encryption.encrypt(dto.pageAccessToken);
    const appId = this.configService.getOrThrow<string>('facebookAppId');
    const debug = await this.graphClient.debugToken(dto.pageAccessToken);
    const grantedScopes =
      debug?.scopes?.map((s) => s.trim()).filter(Boolean) ??
      dto.grantedScopes?.split(',').map((s) => s.trim()).filter(Boolean) ??
      [];

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
      `Connected page ${dto.pageId} with scopes: ${grantedScopes.join(', ') || '(none)'}`,
    );

    // 5. Subscribe to webhook (best-effort — failure should not block the connect)
    await this.trySubscribeWebhook(
      connection.id,
      dto.pageId,
      dto.pageAccessToken,
    );

    return this.toResponseDto(connection);
  }

  // ─── Step 4 — Disconnect ──────────────────────────────────────────────────

  async disconnectPage(
    businessProfileId: string,
    userId: string,
  ): Promise<void> {
    const conn = await this.prisma.facebookConnection.findFirst({
      where: { businessProfileId, businessProfile: { userId } },
    });
    if (!conn) throw new NotFoundException('Facebook connection not found.');

    // Best-effort webhook unsubscription — failure is logged but non-fatal
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
      `Disconnected Facebook page ${conn.pageId} for user ${userId}`,
    );
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

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
