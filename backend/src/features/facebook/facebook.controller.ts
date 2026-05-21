/**
 * @file features/facebook/facebook.controller.ts
 *
 * Core Facebook controller — OAuth, connections, messaging (inbox), webhook, sync, tokens.
 *
 * FIX: Removed `POST /facebook/comments/:commentId/reply` from this controller.
 *
 * WHY IT WAS BROKEN
 * ─────────────────
 * Both FacebookController and FacebookPostsController declared:
 *   POST /facebook/comments/:commentId/reply
 *
 * NestJS registers FacebookModule before FacebookPostsModule in AppModule,
 * so this controller's route was matched first. It expects { businessProfileId, message }
 * in the body (from messaging.dto.ts), but the frontend only sends { message }.
 * Result: "businessProfileId should not be empty" 400 error.
 *
 * THE FIX
 * ───────
 * Post comment replies are now handled exclusively by FacebookPostsController,
 * which uses the internal DB comment ID and resolves everything internally.
 * The inbox-level comment reply (external ID + businessProfileId) is no longer
 * needed as a separate endpoint — clients always have the internal ID.
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

// ─── Page list (for frontend page switcher) ───────────────────────────────────

export interface FacebookPageListItem {
  key:       string;
  pageId:    string;
  name:      string;
  avatar:    string;
  color:     string;
  avatarUrl: string;
}

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

  // ─── Pages list ───────────────────────────────────────────────────────────

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
  getOAuthUrl(
    @Query('businessProfileId') businessProfileId: string,
  ): { url: string } {
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

  // ─── Messaging (inbox DMs only — post comment replies via FacebookPostsController) ──

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

  // NOTE: POST /facebook/comments/:commentId/reply was intentionally removed.
  // It is now handled by FacebookPostsController which uses the internal DB
  // comment ID and does not require businessProfileId in the request body.

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
