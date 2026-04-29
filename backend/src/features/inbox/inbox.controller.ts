/**
 * @file features/inbox/controllers/inbox.controller.ts
 *
 * REST endpoints for the inbox feature.
 *
 * Routes:
 *   GET  /inbox/conversations                  → list conversations (paginated)
 *   GET  /inbox/conversations/:id              → single conversation
 *   POST /inbox/conversations/:id/read         → mark all messages read
 *   POST /inbox/conversations/:id/handover     → set AI / HUMAN / RESOLVED
 *   GET  /inbox/conversations/:id/messages     → cursor-paginated messages
 *   POST /inbox/messages/text                  → send text message
 *   POST /inbox/messages/images                → send image(s) to Facebook
 *   POST /inbox/messages/file                  → send file to Facebook
 *   POST /inbox/uploads/reference              → upload reference images (stored)
 *   POST /inbox/sync/:businessProfileId        → manual sync trigger
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.types.js';
import { PaginatedResponseDto } from '../facebook/dto/shared/pagination.dto.js';
import {
  ConversationResponseDto,
  GetMessagesQueryDto,
  ListConversationsQueryDto,
  MessageResponseDto,
  MessagesPageDto,
  SendFileMessageDto,
  SendImageMessageDto,
  SendTextMessageDto,
  SetHandoverDto,
  SyncCompleteEvent,
  UploadReferenceImagesResponseDto,
} from './dto/inbox.dto.js';
import { ConversationService } from './services/conversation.service.js';
import { InboxSyncService } from './services/inbox-sync.service.js';
import { MessageService } from './services/message.service.js';
import { MulterFile, UploadService } from './services/upload.service.js';

@Controller('inbox')
@UseGuards(JwtAuthGuard)
export class InboxController {
  constructor(
    private readonly conversations: ConversationService,
    private readonly messages: MessageService,
    private readonly uploads: UploadService,
    private readonly sync: InboxSyncService,
  ) {}

  // ── Conversations ─────────────────────────────────────────────────────────

  @Get('conversations')
  listConversations(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListConversationsQueryDto,
  ): Promise<PaginatedResponseDto<ConversationResponseDto>> {
    return this.conversations.listForUser(user.sub, query);
  }

  @Get('conversations/:id')
  getConversation(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ConversationResponseDto> {
    return this.conversations.getForUser(id, user.sub);
  }

  @Post('conversations/:id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markRead(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.conversations.markRead(id, user.sub);
  }

  @Post('conversations/:id/handover')
  setHandover(
    @Param('id') id: string,
    @Body() dto: SetHandoverDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ConversationResponseDto> {
    return this.conversations.setHandover(id, user.sub, dto.status);
  }

  // ── Messages ──────────────────────────────────────────────────────────────

  @Get('conversations/:id/messages')
  getMessages(
    @Param('id') conversationId: string,
    @Query() query: GetMessagesQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MessagesPageDto> {
    return this.messages.getMessages(conversationId, user.sub, query);
  }

  @Post('messages/text')
  @HttpCode(HttpStatus.CREATED)
  sendText(
    @Body() dto: SendTextMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MessageResponseDto> {
    return this.messages.sendText(dto.conversationId, dto.text, user.sub);
  }

  @Post('messages/images')
  @HttpCode(HttpStatus.CREATED)
  sendImages(
    @Body() dto: SendImageMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MessageResponseDto[]> {
    return this.messages.sendImages(
      dto.conversationId,
      dto.imageUrls,
      dto.caption,
      user.sub,
    );
  }

  @Post('messages/file')
  @HttpCode(HttpStatus.CREATED)
  sendFile(
    @Body() dto: SendFileMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MessageResponseDto> {
    return this.messages.sendFile(
      dto.conversationId,
      dto.fileUrl,
      dto.fileName,
      user.sub,
    );
  }

  // ── Reference image upload ─────────────────────────────────────────────────

  /**
   * POST /inbox/uploads/reference
   * Multipart form upload — field name: "images" — max 10 files, 5 MB each.
   * Only reference/preset images are stored. Regular message photos are not stored.
   */
  @Post('uploads/reference')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FilesInterceptor('images', 10, {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadReferenceImages(
    @UploadedFiles() files: MulterFile[],
    @Req() req: Request,
  ): Promise<UploadReferenceImagesResponseDto> {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return this.uploads.saveReferenceImages(files, baseUrl);
  }

  @Post('uploads/temp')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  uploadTempFile(
    @UploadedFile() file: MulterFile | undefined,
    @Req() req: Request,
  ): Promise<{ url: string }> {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return this.uploads.saveTempFile(file, baseUrl);
  }

  // ── Manual sync ───────────────────────────────────────────────────────────

  @Post('sync/:businessProfileId')
  @HttpCode(HttpStatus.OK)
  manualSync(
    @Param('businessProfileId') businessProfileId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SyncCompleteEvent> {
    return this.sync.syncProfile(businessProfileId, user.sub);
  }
}
