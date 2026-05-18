/**
 * @file features/facebook/controllers/facebook-posts.controller.ts
 *
 * REST endpoints for posts & comments management.
 *
 * Routes:
 *   POST /facebook/sync/posts/:businessProfileId     → sync posts from FB feed
 *   GET  /facebook/posts/:businessProfileId          → list posts (paginated)
 *   GET  /facebook/posts/:postId/comments            → list comments (paginated + filter)
 *   POST /facebook/sync/comments/:postId             → sync comments from FB
 *   POST /facebook/comments/:commentId/reply         → manual public reply
 *   POST /facebook/comments/:commentId/private-reply → manual private reply (DM)
 *   POST /facebook/comments/:commentId/ai-reply      → trigger AI reply for one comment
 *   GET  /facebook/posts/:postId/ai-config           → get PostAiConfig
 *   PUT  /facebook/posts/:postId/ai-config           → update PostAiConfig
 *
 * FIX: UpdatePostAiConfigDto.tone and .responseStyle changed from `string` to Prisma
 * enum types (`Tone`, `ResponseStyle`) to satisfy the typed UpdatePostAiConfigData
 * interface exported from FacebookPostsService.
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
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard.js';
import { ResponseStyle, Tone } from '../../../../generated/prisma/enums.js';
import { FacebookPostsService } from '../services/facebook-posts.service.js';
import { PostCommentAiService } from '../services/post-comment-ai.service.js';

// ─── DTOs ─────────────────────────────────────────────────────────────────────

class ReplyToCommentDto {
  @IsString()
  @MaxLength(8000)
  message!: string;
}

/**
 * FIX: `tone` and `responseStyle` are now validated as Prisma enums via @IsEnum().
 * This ensures the values passed to FacebookPostsService.updatePostAiConfig()
 * match the expected `Tone` and `ResponseStyle` types — no more TS2322.
 */
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
  @IsEnum(Tone) // FIX: was `string`, now validated as Tone enum
  tone?: Tone;

  @IsOptional()
  @IsEnum(ResponseStyle) // FIX: was `string`, now validated as ResponseStyle enum
  responseStyle?: ResponseStyle;
}

// ─── Controller ───────────────────────────────────────────────────────────────

@UseGuards(JwtAuthGuard)
@Controller('facebook')
export class FacebookPostsController {
  constructor(
    private readonly fbPosts: FacebookPostsService,
    private readonly commentAi: PostCommentAiService,
  ) {}

  // ─── Sync ─────────────────────────────────────────────────────────────────

  @Post('sync/posts/:businessProfileId')
  @HttpCode(HttpStatus.OK)
  syncPosts(
    @Param('businessProfileId') businessProfileId: string,
    @Query('limit') limit = 20,
  ) {
    return this.fbPosts.syncPagePosts(businessProfileId, +limit);
  }

  @Post('sync/comments/:postId')
  @HttpCode(HttpStatus.OK)
  syncComments(@Param('postId') postId: string, @Query('limit') limit = 50) {
    return this.fbPosts.syncPostComments(postId, +limit);
  }

  // ─── Read ─────────────────────────────────────────────────────────────────

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
    return this.fbPosts.updatePostAiConfig(postId, dto);
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

  @Post('comments/:commentId/ai-reply')
  @HttpCode(HttpStatus.NO_CONTENT)
  async aiReply(@Param('commentId') commentId: string) {
    void this.commentAi.processNewComment(commentId).catch(() => undefined);
  }
}
