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
 *   POST /facebook/comments/:commentId/ai-reply         → trigger AI reply
 *   GET  /facebook/posts/:postId/ai-config              → get PostAiConfig
 *   PUT  /facebook/posts/:postId/ai-config              → update PostAiConfig
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
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard.js';
import { Tone, ResponseStyle } from '../../../generated/prisma/enums.js';
import { PostCommentAiService } from '../services/post-comment-ai.service.js';
import {
  FacebookPostsService,
  type AddManagedPostDto,
} from '../services/facebook-posts.service.js';

// ─── DTOs ─────────────────────────────────────────────────────────────────────

class ReplyToCommentDto {
  @IsString() @MaxLength(8000)
  message!: string;
}

class AddManagedPostBodyDto implements Omit<AddManagedPostDto, never> {
  @IsString() @IsNotEmpty()
  businessProfileId!: string;

  @IsString() @IsNotEmpty()
  externalId!: string;

  @IsOptional() @IsString() @MaxLength(63206)
  message?: string | null;

  @IsOptional() @IsString()
  imageUrl?: string | null;

  @IsOptional() @IsString()
  permalinkUrl?: string | null;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  reactionsCount?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  commentsCount?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  sharesCount?: number;

  @IsDateString()
  publishedAt!: string;
}

class UpdatePostAiConfigDto {
  @IsOptional() @IsBoolean()
  autoReply?: boolean;

  @IsOptional() @IsBoolean()
  privateReplyEnabled?: boolean;

  @IsOptional() @IsString() @MaxLength(2000)
  privateReplyMessage?: string;

  @IsOptional() @IsString() @MaxLength(4000)
  customInstructions?: string;

  @IsOptional() @IsString()
  replyLanguage?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(50)
  maxReplyTokens?: number;

  @IsOptional() @IsEnum(Tone)
  tone?: Tone;

  @IsOptional() @IsEnum(ResponseStyle)
  responseStyle?: ResponseStyle;
}

// ─── Controller ───────────────────────────────────────────────────────────────

@UseGuards(JwtAuthGuard)
@Controller('facebook')
export class FacebookPostsController {
  constructor(
    private readonly fbPosts:   FacebookPostsService,
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

  /** Add a post to management (creates post record + PostAiConfig). */
  @Post('posts/managed')
  @HttpCode(HttpStatus.CREATED)
  addManagedPost(@Body() dto: AddManagedPostBodyDto) {
    return this.fbPosts.addManagedPost({
      businessProfileId: dto.businessProfileId,
      externalId:        dto.externalId,
      message:           dto.message ?? null,
      imageUrl:          dto.imageUrl ?? null,
      permalinkUrl:      dto.permalinkUrl ?? null,
      reactionsCount:    dto.reactionsCount ?? 0,
      commentsCount:     dto.commentsCount  ?? 0,
      sharesCount:       dto.sharesCount    ?? 0,
      publishedAt:       dto.publishedAt,
    });
  }

  /** Remove a post from management (deletes post + cascade to config/comments). */
  @Delete('posts/managed/:postId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteManagedPost(
    @Param('postId')           postId:           string,
    @Query('businessProfileId') businessProfileId: string,
  ) {
    return this.fbPosts.deleteManagedPost(postId, businessProfileId);
  }

  // ─── Read managed posts ───────────────────────────────────────────────────

  @Get('posts/:businessProfileId')
  getPosts(
    @Param('businessProfileId') businessProfileId: string,
    @Query('page')     page     = 1,
    @Query('pageSize') pageSize = 20,
    @Query('search')   search?: string,
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
    @Param('postId')   postId: string,
    @Query('page')     page     = 1,
    @Query('pageSize') pageSize = 50,
    @Query('filter')   filter?: 'all' | 'pending' | 'replied' | 'useful',
    @Query('search')   search?: string,
  ) {
    return this.fbPosts.getCommentsForPost(postId, +page, +pageSize, filter, search);
  }

  // ─── Sync comments ────────────────────────────────────────────────────────

  @Post('sync/comments/:postId')
  @HttpCode(HttpStatus.OK)
  syncComments(
    @Param('postId') postId: string,
    @Query('limit') limit = 50,
  ) {
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
