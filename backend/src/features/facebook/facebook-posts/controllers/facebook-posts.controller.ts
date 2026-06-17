/**
 * @file features/facebook-posts/controllers/facebook-posts.controller.ts
 *
 * REST endpoints for posts & comments management.
 *
 * Routes:
 *   GET  /facebook/posts/feed/:businessProfileId        → live FB feed (for add dialog)
 *   POST /facebook/posts/managed                        → add a post to management
 *   DELETE /facebook/posts/managed/:postId              → remove a managed post
 *   GET  /facebook/posts/:businessProfileId             → list managed posts
 *   GET  /facebook/posts/:postId/comments               → list comments
 *   POST /facebook/sync/comments/:postId                → sync comments from FB
 *   POST /facebook/comments/:commentId/reply            → public reply
 *   POST /facebook/comments/:commentId/private-reply    → private DM reply
 *   POST /facebook/comments/:commentId/ai-reply         → trigger AI reply (manual, forced)
 *   GET  /facebook/posts/:postId/ai-config              → get PostAiConfig
 *   PUT  /facebook/posts/:postId/ai-config              → update PostAiConfig
 *   POST /facebook/posts/:postId/ai-suggest             → AI suggestion for a config field
 *
 * CHANGES IN THIS REVISION
 * ─────────────────────────────────────────────────────────────────────────
 * - addManagedPost: now requires the authenticated user (CurrentUser) so
 *   FacebookPostsService can enforce BILLING_PLANS.<plan>.maxManagedPosts
 *   (point 6 — plan-based limits).
 * - aiReply: previously fired-and-forgot (204, no feedback). Now AWAITS
 *   PostCommentAiService.processNewComment() with `force: true` (bypasses
 *   the spam filter — the user explicitly asked for a reply on THIS
 *   comment) and returns a `ProcessCommentResult` so the frontend can show
 *   exactly why no reply was sent (no credits, already replied, model
 *   failure, etc.) — fixes "click does nothing, no feedback".
 * - NEW ai-suggest: powers the "✨ Suggestion IA" button for the private DM
 *   message / custom instructions fields. Consumes credits like any other
 *   AI call.
 * - UpdatePostAiConfigDto: + replyToAllComments, + keywordRules (non-AI
 *   keyword-based reply rules — "instructions flexibles sans abus IA").
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard.js';
import { ResponseStyle, Tone } from '../../../../generated/prisma/enums.js';
import type { AuthenticatedUser } from '../../../auth/types/authenticated-user.types.js';
import {
  FacebookPostsService,
  type AddManagedPostDto,
} from '../services/facebook-posts.service.js';
import {
  PostCommentAiService,
  type ProcessCommentResult,
} from '../services/post-comment-ai.service.js';

// ─── DTOs ─────────────────────────────────────────────────────────────────────

class ReplyToCommentDto {
  @IsString()
  @MaxLength(8000)
  message!: string;
}

class AddManagedPostBodyDto implements Omit<AddManagedPostDto, never> {
  @IsString()
  @IsNotEmpty()
  businessProfileId!: string;

  @IsString()
  @IsNotEmpty()
  externalId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(63206)
  message!: string | null;

  @IsOptional()
  @IsString()
  imageUrl!: string | null;

  @IsOptional()
  @IsString()
  permalinkUrl!: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  reactionsCount!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  commentsCount!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sharesCount!: number;

  @IsDateString()
  publishedAt!: string;
}

/**
 * A single non-AI, deterministic reply rule.
 *   replyText set    → fixed reply, posted directly, 0 AI calls/credits.
 *   replyText null   → bypasses the spam filter, AI generates the reply
 *                       (credits consumed as usual).
 */
class KeywordRuleDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  id?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  keyword!: string;

  @IsIn(['contains', 'exact'])
  matchType!: 'contains' | 'exact';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  replyText?: string | null;

  @IsOptional()
  @IsBoolean()
  sendPrivateReply?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  privateReplyText?: string | null;
}

class UpdatePostAiConfigDto {
  @IsOptional()
  @IsBoolean()
  autoReply?: boolean;

  @IsOptional()
  @IsBoolean()
  privateReplyEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  privateReplyMessage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  customInstructions?: string;

  @IsOptional()
  @IsString()
  replyLanguage?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(50)
  maxReplyTokens?: number;

  @IsOptional()
  @IsEnum(Tone)
  tone?: Tone;

  @IsOptional()
  @IsEnum(ResponseStyle)
  responseStyle?: ResponseStyle;

  /**
   * "Répondre à tous les commentaires" — bypasses the spam-score filter for
   * every comment on this post. AI still consumes credits per reply.
   */
  @IsOptional()
  @IsBoolean()
  replyToAllComments?: boolean;

  /**
   * Non-AI keyword reply rules, evaluated before the spam filter.
   * e.g. { keyword: "test", matchType: "contains", replyText: "test" }
   * → replies "test" to any comment containing "test", instantly, 0 credits.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => KeywordRuleDto)
  keywordRules?: KeywordRuleDto[];
}

/** Body for POST /facebook/posts/:postId/ai-suggest */
class AiSuggestDto {
  @IsIn(['privateReplyMessage', 'customInstructions'])
  field!: 'privateReplyMessage' | 'customInstructions';

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  currentValue?: string;
}

// ─── Controller ───────────────────────────────────────────────────────────────

@UseGuards(JwtAuthGuard)
@Controller('facebook')
export class FacebookPostsController {
  constructor(
    private readonly fbPosts: FacebookPostsService,
    private readonly commentAi: PostCommentAiService,
  ) {}

  // ─── Feed (for add dialog) ────────────────────────────────────────────────

  @Get('posts/feed/:businessProfileId')
  getPageFeed(
    @Param('businessProfileId') businessProfileId: string,
    @Query('limit') limit = 25,
  ) {
    return this.fbPosts.getPageFeed(businessProfileId, +limit);
  }

  // ─── Managed posts CRUD ───────────────────────────────────────────────────

  /**
   * Add a post to management (creates post record + PostAiConfig).
   * FIX (point 6): now passes the authenticated user so the service can
   * enforce BILLING_PLANS.<plan>.maxManagedPosts. Throws 400 with a clear
   * upgrade message when the plan limit is reached.
   */
  @Post('posts/managed')
  @HttpCode(HttpStatus.CREATED)
  addManagedPost(
    @Body() dto: AddManagedPostBodyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.fbPosts.addManagedPost(
      {
        businessProfileId: dto.businessProfileId,
        externalId: dto.externalId,
        message: dto.message ?? null,
        imageUrl: dto.imageUrl ?? null,
        permalinkUrl: dto.permalinkUrl ?? null,
        reactionsCount: dto.reactionsCount ?? 0,
        commentsCount: dto.commentsCount ?? 0,
        sharesCount: dto.sharesCount ?? 0,
        publishedAt: dto.publishedAt,
      },
      user.sub,
    );
  }

  /** Remove a post from management (deletes post + cascade to config/comments). */
  @Delete('posts/managed/:postId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteManagedPost(
    @Param('postId') postId: string,
    @Query('businessProfileId') businessProfileId: string,
  ) {
    return this.fbPosts.deleteManagedPost(postId, businessProfileId);
  }

  // ─── Read managed posts ───────────────────────────────────────────────────

  @Get('posts/:businessProfileId')
  getPosts(
    @Param('businessProfileId') businessProfileId: string,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
    @Query('search') search?: string,
  ) {
    return this.fbPosts.getPostsForProfile(
      businessProfileId,
      +page,
      +pageSize,
      search,
    );
  }

  @Get('posts/:postId/comments')
  getComments(
    @Param('postId') postId: string,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 50,
    @Query('filter') filter?: 'all' | 'pending' | 'replied' | 'useful',
    @Query('search') search?: string,
  ) {
    return this.fbPosts.getCommentsForPost(
      postId,
      +page,
      +pageSize,
      filter,
      search,
    );
  }

  // ─── Sync comments ────────────────────────────────────────────────────────

  @Post('sync/comments/:postId')
  @HttpCode(HttpStatus.OK)
  syncComments(@Param('postId') postId: string, @Query('limit') limit = 50) {
    return this.fbPosts.syncPostComments(postId, +limit);
  }

  // ─── PostAiConfig ─────────────────────────────────────────────────────────

  @Get('posts/:postId/ai-config')
  getPostAiConfig(@Param('postId') postId: string) {
    return this.fbPosts.getOrCreatePostAiConfig(postId);
  }

  @Put('posts/:postId/ai-config')
  updatePostAiConfig(
    @Param('postId') postId: string,
    @Body() dto: UpdatePostAiConfigDto,
  ) {
    return this.fbPosts.updatePostAiConfig(postId, {
      ...dto,
      keywordRules: dto.keywordRules?.map((rule) => ({
        id: rule.id ?? '',
        keyword: rule.keyword,
        matchType: rule.matchType,
        replyText: rule.replyText ?? null,
        sendPrivateReply: rule.sendPrivateReply ?? false,
        privateReplyText: rule.privateReplyText ?? null,
      })),
    });
  }

  /**
   * POST /facebook/posts/:postId/ai-suggest
   *
   * AI-assisted suggestion for `privateReplyMessage` or `customInstructions`,
   * taking the field's CURRENT content into account. Consumes credits
   * (type 'AI_SUGGESTION_CONSUME') — "toute utilisation IA consomme du
   * crédit, même les suggestions".
   */
  @Post('posts/:postId/ai-suggest')
  @HttpCode(HttpStatus.OK)
  generateAiSuggestion(
    @Param('postId') postId: string,
    @Body() dto: AiSuggestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.commentAi.generateFieldSuggestion(
      postId,
      dto.field,
      dto.currentValue ?? '',
      user.sub,
    );
  }

  // ─── Manual replies ───────────────────────────────────────────────────────

  @Post('comments/:commentId/reply')
  @HttpCode(HttpStatus.NO_CONTENT)
  async replyPublic(
    @Param('commentId') commentId: string,
    @Body() dto: ReplyToCommentDto,
  ) {
    await this.fbPosts.replyToCommentPublic(commentId, dto.message, false);
  }

  @Post('comments/:commentId/private-reply')
  @HttpCode(HttpStatus.NO_CONTENT)
  async replyPrivate(
    @Param('commentId') commentId: string,
    @Body() dto: ReplyToCommentDto,
  ) {
    await this.fbPosts.sendPrivateReplyToComment(commentId, dto.message, false);
  }

  /**
   * POST /facebook/comments/:commentId/ai-reply
   *
   * FIX: previously fire-and-forget (204, `.catch(() => undefined)` —
   * a click on the "IA" button could silently do NOTHING, zero feedback,
   * reported as "l'IA ne marche pas").
   *
   * Now AWAITS the result and returns it (200), with `force: true` so the
   * spam-score filter is bypassed — the user explicitly asked for a reply
   * on THIS comment. The frontend uses `result.success`/`result.message`
   * to show a toast explaining exactly what happened.
   */
  @Post('comments/:commentId/ai-reply')
  @HttpCode(HttpStatus.OK)
  async aiReply(
    @Param('commentId') commentId: string,
  ): Promise<ProcessCommentResult> {
    return this.commentAi.processNewComment(commentId, {
      emitNew: true,
      force: true,
    });
  }
}
