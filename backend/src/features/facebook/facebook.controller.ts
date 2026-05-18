/**
 * @file features/facebook/facebook.controller.ts
 *
 * Core Facebook controller — OAuth, connections, messaging, webhook, sync, tokens.
 *
 * ADDED: GET /facebook/pages/list
 *   Returns connected pages formatted for the frontend with avatar URLs.
 *   Used by the posts-comments feature to populate the page switcher.
 */

import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.types.js';
import { ConnectPageDto } from './dto/auth/connect-page.dto.js';
import { FacebookConnectionResponseDto } from './dto/auth/facebook-connection-response.dto.js';
import {
  ReplyToCommentDto,
  ReplyToCommentResponseDto,
  SendMessageDto,
  SendMessageResponseDto,
} from './dto/messaging/messaging.dto.js';
import {
  PaginatedResponseDto,
  PaginationQueryDto,
} from './dto/shared/pagination.dto.js';
import { WebhookSignatureGuard } from './security/webhook-signature.guard.js';
import { FacebookAccountService } from './services/facebook-account.service.js';
import {
  type OAuthPageOption,
  FacebookAuthService,
} from './services/facebook-auth.service.js';
import { FacebookMessagingService } from './services/facebook-messaging.service.js';
import { FacebookSyncService } from './services/facebook-sync.service.js';
import {
  type TokenValidationSummary,
  TokenService,
} from './services/token.service.js';
import {
  type FbWebhookPayload,
  WebhookService,
} from './services/webhook.service.js';

// ─── Facebook page for frontend ───────────────────────────────────────────────

export interface FacebookPageListItem {
  /** businessProfileId — used as the page key in the frontend */
  key:       string;
  pageId:    string;
  name:      string;
  /** 2-letter initials for fallback avatar */
  avatar:    string;
  /** Tailwind color class for fallback avatar background */
  color:     string;
  /** Facebook CDN avatar URL — may return 403 for private pages */
  avatarUrl: string;
}

/** Color palette for page avatars — cycles by index */
const PAGE_COLORS = [
  'bg-primary/15 text-primary',
  'bg-violet-500/15 text-violet-600',
  'bg-emerald-500/15 text-emerald-600',
  'bg-amber-500/15 text-amber-600',
  'bg-rose-500/15 text-rose-600',
] as const;

@Controller('facebook')
export class FacebookController {
  constructor(
    private readonly authService:      FacebookAuthService,
    private readonly accountService:   FacebookAccountService,
    private readonly syncService:      FacebookSyncService,
    private readonly messagingService: FacebookMessagingService,
    private readonly webhookService:   WebhookService,
    private readonly tokenService:     TokenService,
    private readonly configService:    ConfigService,
  ) {}

  // ─── Pages list (for frontend page switcher) ──────────────────────────────

  /**
   * GET /facebook/pages/list
   * Returns all connected Facebook pages for the current user,
   * formatted for the frontend page switcher (with avatar URLs).
   */
  @UseGuards(JwtAuthGuard)
  @Get('pages/list')
  async listPages(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FacebookPageListItem[]> {
    const { data: connections } = await this.accountService.listForUser(
      user.sub,
      { page: 1, pageSize: 50 },
    );

    return connections.map((conn, index) => ({
      key:       conn.businessProfileId,
      pageId:    conn.pageId,
      name:      conn.pageName,
      avatar:    conn.pageName
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .join(''),
      color:     PAGE_COLORS[index % PAGE_COLORS.length],
      avatarUrl: `https://graph.facebook.com/${conn.pageId}/picture?type=square`,
    }));
  }

  // ─── OAuth ────────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('oauth/url')
  getOAuthUrl(@Query('businessProfileId') businessProfileId: string): { url: string } {
    return { url: this.authService.buildOAuthUrl(businessProfileId) };
  }

  @UseGuards(JwtAuthGuard)
  @Post('oauth/callback')
  async handleCallback(
    @Body('code') code: string,
  ): Promise<{ pages: OAuthPageOption[] }> {
    return { pages: await this.authService.handleCallback(code) };
  }

  // ─── Connections ──────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('connect')
  @HttpCode(HttpStatus.CREATED)
  async connectPage(
    @Body() dto: ConnectPageDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FacebookConnectionResponseDto> {
    return this.authService.connectPage(dto, user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('disconnect/:businessProfileId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async disconnectPage(
    @Param('businessProfileId') businessProfileId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.authService.disconnectPage(businessProfileId, user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get('connections')
  async listConnections(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<FacebookConnectionResponseDto>> {
    return this.accountService.listForUser(user.sub, pagination);
  }

  @UseGuards(JwtAuthGuard)
  @Get('connections/:businessProfileId')
  async getConnection(
    @Param('businessProfileId') businessProfileId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FacebookConnectionResponseDto> {
    return this.accountService.getForUser(businessProfileId, user.sub);
  }

  // ─── Sync ─────────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('sync/conversations/:businessProfileId')
  async syncConversations(
    @Param('businessProfileId') businessProfileId: string,
    @Query('limit') limit = 20,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ synced: number }> {
    const result = await this.syncService.syncConversations(
      businessProfileId,
      user.sub,
      +limit,
    );
    return { synced: result.synced };
  }

  @UseGuards(JwtAuthGuard)
  @Post('sync/messages/:conversationId')
  async syncMessages(
    @Param('conversationId') conversationId: string,
    @Query('limit') limit = 25,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ synced: number }> {
    const result = await this.syncService.syncConversationMessages(
      conversationId,
      user.sub,
      +limit,
    );
    return { synced: result.synced };
  }

  // ─── Messaging ────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('messages/send')
  @HttpCode(HttpStatus.CREATED)
  async sendMessage(
    @Body() dto: SendMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SendMessageResponseDto> {
    return this.messagingService.sendMessage(
      dto.businessProfileId,
      user.sub,
      dto.recipientPsid,
      dto.text,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('comments/:commentId/reply')
  @HttpCode(HttpStatus.CREATED)
  async replyToComment(
    @Param('commentId') externalCommentId: string,
    @Body() dto: ReplyToCommentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReplyToCommentResponseDto> {
    return this.messagingService.replyToComment(
      dto.businessProfileId,
      user.sub,
      externalCommentId,
      dto.message,
    );
  }

  // ─── Token management ─────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('tokens/validate')
  async validateTokens(
    @Query('batchSize') batchSize = 10,
  ): Promise<TokenValidationSummary> {
    return this.tokenService.validateAllActiveTokens(+batchSize);
  }

  // ─── Webhook ──────────────────────────────────────────────────────────────

  @Get('webhook')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.challenge') challenge: string,
    @Query('hub.verify_token') verifyToken: string,
  ): string {
    const expected = this.configService.getOrThrow<string>('facebookVerifyToken');
    if (mode !== 'subscribe' || verifyToken !== expected) {
      throw new ForbiddenException('Webhook verification failed');
    }
    return challenge;
  }

  @UseGuards(WebhookSignatureGuard)
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async receiveWebhook(@Body() payload: FbWebhookPayload): Promise<void> {
    void this.webhookService.dispatchPayload(payload);
  }
}
