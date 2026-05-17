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

@Controller('facebook')
export class FacebookController {
  constructor(
    private readonly authService: FacebookAuthService,
    private readonly accountService: FacebookAccountService,
    private readonly syncService: FacebookSyncService,
    private readonly messagingService: FacebookMessagingService,
    private readonly webhookService: WebhookService,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
  ) {}

  // ─── OAuth ────────────────────────────────────────────────────────────────

  /** Step 1 — Frontend redirects the user to the returned URL. */
  @UseGuards(JwtAuthGuard)
  @Get('oauth/url')
  getOAuthUrl(@Query('businessProfileId') businessProfileId: string): {
    url: string;
  } {
    return { url: this.authService.buildOAuthUrl(businessProfileId) };
  }

  /**
   * Step 2 — Frontend exchanges the code after Facebook redirects back.
   * Returns the list of pages the user manages so they can pick one.
   */
  @UseGuards(JwtAuthGuard)
  @Post('oauth/callback')
  async handleCallback(
    @Body('code') code: string,
  ): Promise<{ pages: OAuthPageOption[] }> {
    return { pages: await this.authService.handleCallback(code) };
  }

  // ─── Connections ──────────────────────────────────────────────────────────

  /**
   * Step 3 — User picks a page; we store the token and subscribe to the webhook.
   * Returns 201 on success.
   */
  @UseGuards(JwtAuthGuard)
  @Post('connect')
  @HttpCode(HttpStatus.CREATED)
  async connectPage(
    @Body() dto: ConnectPageDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FacebookConnectionResponseDto> {
    return this.authService.connectPage(dto, user.sub);
  }

  /** Remove a connection and unsubscribe the page's webhook. */
  @UseGuards(JwtAuthGuard)
  @Delete('disconnect/:businessProfileId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async disconnectPage(
    @Param('businessProfileId') businessProfileId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.authService.disconnectPage(businessProfileId, user.sub);
  }

  /** List all connections for the authenticated user (paginated). */
  @UseGuards(JwtAuthGuard)
  @Get('connections')
  async listConnections(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<FacebookConnectionResponseDto>> {
    return this.accountService.listForUser(user.sub, pagination);
  }

  /** Get a single connection by its business profile ID. */
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
  @Post('sync/posts/:businessProfileId')
  async syncPosts(
    @Param('businessProfileId') businessProfileId: string,
    @Query('limit') limit = 10,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ synced: number }> {
    return {
      synced: await this.syncService.syncPosts(
        businessProfileId,
        user.sub,
        +limit,
      ),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('sync/comments/:postId')
  async syncComments(
    @Param('postId') postId: string,
    @Query('limit') limit = 25,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ synced: number }> {
    return {
      synced: await this.syncService.syncPostComments(postId, user.sub, +limit),
    };
  }

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
    return {
      synced: result.synced,
    };
  }

  /** Pull individual messages for a conversation (called from the inbox UI). */
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
    return {
      synced: result.synced,
    };
  }

  // ─── Messaging (outbound) ─────────────────────────────────────────────────

  /** Send a text DM to a user. */
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

  /** Reply to a Facebook comment. commentId is the external Facebook comment ID. */
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

  /**
   * Trigger a bulk validation of all active tokens.
   * Intended to be called by a scheduled job (cron), but also available via API
   * for manual runs or debugging.
   */
  @UseGuards(JwtAuthGuard)
  @Post('tokens/validate')
  async validateTokens(
    @Query('batchSize') batchSize = 10,
  ): Promise<TokenValidationSummary> {
    return this.tokenService.validateAllActiveTokens(+batchSize);
  }

  // ─── Webhook ──────────────────────────────────────────────────────────────

  /**
   * GET — Facebook's one-time verification challenge.
   * Called once when you first register the webhook URL in the Meta dashboard.
   */
  @Get('webhook')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.challenge') challenge: string,
    @Query('hub.verify_token') verifyToken: string,
  ): string {
    const expected = this.configService.getOrThrow<string>(
      'facebookVerifyToken',
    );
    if (mode !== 'subscribe' || verifyToken !== expected) {
      throw new ForbiddenException('Webhook verification failed');
    }
    return challenge;
  }

  /**
   * POST — Receives real-time events (messages, comments, reactions) from Facebook.
   * Protected by HMAC-SHA256 signature verification via WebhookSignatureGuard.
   * Processing is fire-and-forget — we return 200 immediately to Facebook.
   */
  @UseGuards(WebhookSignatureGuard)
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async receiveWebhook(@Body() payload: FbWebhookPayload): Promise<void> {
    // Dispatch is async fire-and-forget: Facebook requires a 200 response within
    // 20s or it will retry. Processing happens in the background.
    void this.webhookService.dispatchPayload(payload);
  }
}
