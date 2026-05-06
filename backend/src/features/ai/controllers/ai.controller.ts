/**
 * @file features/ai/controllers/ai.controller.ts
 *
 * REST endpoints for the AI feature.
 *
 * Routes:
 *   GET  /ai/:businessProfileId/config          → get AI behaviour config
 *   PUT  /ai/:businessProfileId/config          → update AI behaviour config
 *   GET  /ai/:businessProfileId/models          → get model selection
 *   PUT  /ai/:businessProfileId/models          → update model selection
 *   GET  /ai/models/available                   → list OpenRouter catalogue
 *   GET  /ai/conversations/:id/logs             → AI reply audit logs
 *   POST /ai/conversations/:id/resume           → switch HUMAN → AI (with auto-reply)
 *   POST /ai/conversations/:id/reply-now        → force an immediate AI reply
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.types.js';
import {
  AiConfigResponseDto,
  AiModelConfigResponseDto,
  OpenRouterModelDto,
  UpdateAiConfigDto,
  UpdateAiModelConfigDto,
} from '../dto/ai.dto.js';
import { AiConfigService } from '../services/ai-config.service.js';
import { ReplyAiService } from '../services/reply-ai.service.js';

@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(
    private readonly aiConfigService: AiConfigService,
    private readonly replyAiService:  ReplyAiService,
    private readonly prisma:          PrismaService,
  ) {}

  // ─── AI Behaviour Config ──────────────────────────────────────────────────

  /**
   * GET /ai/:businessProfileId/config
   * Returns the AI behaviour config (prompts, tone, escalation thresholds).
   * Auto-creates with defaults on first access.
   */
  @Get(':businessProfileId/config')
  getAiConfig(
    @Param('businessProfileId') businessProfileId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AiConfigResponseDto> {
    return this.aiConfigService.getAiConfig(businessProfileId, user.sub);
  }

  /**
   * PUT /ai/:businessProfileId/config
   * Partial update — only fields present in the body are updated.
   */
  @Put(':businessProfileId/config')
  updateAiConfig(
    @Param('businessProfileId') businessProfileId: string,
    @Body() dto: UpdateAiConfigDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AiConfigResponseDto> {
    return this.aiConfigService.updateAiConfig(businessProfileId, user.sub, dto);
  }

  // ─── AI Model Config ──────────────────────────────────────────────────────

  /**
   * GET /ai/:businessProfileId/models
   * Returns the OpenRouter model selections (reply model + summary model).
   */
  @Get(':businessProfileId/models')
  getModelConfig(
    @Param('businessProfileId') businessProfileId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AiModelConfigResponseDto> {
    return this.aiConfigService.getModelConfig(businessProfileId, user.sub);
  }

  /**
   * PUT /ai/:businessProfileId/models
   * Update the chosen OpenRouter models.
   */
  @Put(':businessProfileId/models')
  updateModelConfig(
    @Param('businessProfileId') businessProfileId: string,
    @Body() dto: UpdateAiModelConfigDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AiModelConfigResponseDto> {
    return this.aiConfigService.updateModelConfig(businessProfileId, user.sub, dto);
  }

  /**
   * GET /ai/models/available
   * Fetches the live OpenRouter model catalogue.
   * Called by the UI to populate the model selector.
   * Note: declared BEFORE :businessProfileId routes to avoid routing conflict.
   */
  @Get('models/available')
  listAvailableModels(): Promise<OpenRouterModelDto[]> {
    return this.aiConfigService.listAvailableModels();
  }

  // ─── Audit Logs ───────────────────────────────────────────────────────────

  /**
   * GET /ai/conversations/:id/logs
   * Paginated AI reply audit log for a conversation.
   * Useful for debugging model decisions and monitoring token usage.
   */
  @Get('conversations/:id/logs')
  getReplyLogs(
    @Param('id') conversationId: string,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.aiConfigService.getReplyLogs(
      conversationId,
      user.sub,
      +page,
      +pageSize,
    );
  }

  // ─── Handover ─────────────────────────────────────────────────────────────

  /**
   * POST /ai/conversations/:id/resume
   * Switch a conversation from HUMAN → AI mode.
   *
   * Behaviour:
   *   - Sets handoverStatus = AI
   *   - If the last message is from CLIENT → triggers an AI reply immediately
   *   - Emits SSE conversation_updated to update the inbox UI
   *
   * Returns 204 — the inbox UI is updated via SSE, not the response body.
   */
  @Post('conversations/:id/resume')
  @HttpCode(HttpStatus.NO_CONTENT)
  resumeAiMode(
    @Param('id') conversationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.replyAiService.resumeAiForConversation(conversationId, user.sub);
  }

  /**
   * POST /ai/conversations/:id/reply-now
   * Force an immediate AI reply for a conversation.
   * Useful for re-triggering a reply after a manual review.
   *
   * Returns 204 — the reply is sent asynchronously via fire-and-forget.
   */
  @Post('conversations/:id/reply-now')
  @HttpCode(HttpStatus.NO_CONTENT)
  async forceReply(
    @Param('id') conversationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    // Verify ownership before triggering
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, businessProfile: { userId: user.sub } },
    });
    if (!conv) return;

    // Mark as needing reply, then fire asynchronously
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data:  { needsAiReply: true },
    });

    void this.replyAiService.replyToConversation(conversationId);
  }
}
