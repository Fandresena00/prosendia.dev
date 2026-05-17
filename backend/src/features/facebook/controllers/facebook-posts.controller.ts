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
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.types.js';
import { PostCommentAiService } from '../services/post-comment-ai.service.js';
import { FacebookPostsService } from '../services/facebook-posts.service.js';

class ReplyToCommentDto {
  message!: string;
}

class UpdatePostAiConfigDto {
  autoReply?:            boolean;
  privateReplyEnabled?:  boolean;
  privateReplyMessage?:  string;
  customInstructions?:   string;
  replyLanguage?:        string;
  maxReplyTokens?:       number;
  tone?:                 string;
  responseStyle?:        string;
}

@UseGuards(JwtAuthGuard)
@Controller('facebook')
export class FacebookPostsController {
  constructor(
    private readonly fbPosts:       FacebookPostsService,
    private readonly commentAi:     PostCommentAiService,
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
  syncComments(
    @Param('postId') postId: string,
    @Query('limit') limit = 50,
  ) {
    return this.fbPosts.syncPostComments(postId, +limit);
  }

  // ─── Read ─────────────────────────────────────────────────────────────────

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

  // ─── Manual replies ────────────────────────────────────────────────────────

  /** Manual public reply from the app (human agent). */
  @Post('comments/:commentId/reply')
  @HttpCode(HttpStatus.NO_CONTENT)
  async replyPublic(
    @Param('commentId') commentId: string,
    @Body() dto: ReplyToCommentDto,
  ) {
    await this.fbPosts.replyToCommentPublic(commentId, dto.message, false);
  }

  /** Manual private reply (DM) from the app (human agent). */
  @Post('comments/:commentId/private-reply')
  @HttpCode(HttpStatus.NO_CONTENT)
  async replyPrivate(
    @Param('commentId') commentId: string,
    @Body() dto: ReplyToCommentDto,
  ) {
    await this.fbPosts.sendPrivateReplyToComment(commentId, dto.message, false);
  }

  /** Force AI reply for a specific comment (manual trigger). */
  @Post('comments/:commentId/ai-reply')
  @HttpCode(HttpStatus.NO_CONTENT)
  async aiReply(@Param('commentId') commentId: string) {
    void this.commentAi.processNewComment(commentId).catch(() => undefined);
  }
}
