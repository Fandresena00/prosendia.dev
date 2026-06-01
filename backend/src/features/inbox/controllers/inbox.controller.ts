/**
 * @file features/inbox/controllers/inbox.controller.ts
 *
 * REST endpoints for the inbox feature.
 *
 * Routes:
 *   GET  /inbox/conversations                       → paginated conversation list
 *   GET  /inbox/conversations/:id                   → single conversation
 *   POST /inbox/conversations/:id/read              → mark messages read
 *   POST /inbox/conversations/:id/handover          → set AI / HUMAN / RESOLVED
 *   GET  /inbox/conversations/:id/messages          → cursor-paginated messages
 *   POST /inbox/messages/text                       → send text message
 *   POST /inbox/messages/images                     → send image(s)
 *   POST /inbox/messages/file                       → send file
 *   POST /inbox/uploads/reference                   → store reference images
 *   GET  /inbox/reference-presets                   → list reference presets
 *   POST /inbox/reference-presets                   → create reference preset
 *   DELETE /inbox/reference-presets/:id             → delete reference preset
 *   POST /inbox/uploads/temp                        → temporary upload for sends
 *   POST /inbox/sync/:businessProfileId             → manual sync (regular)
 *   POST /inbox/initial-sync/:businessProfileId     → first-connection full sync
 *                                                     (40 conversations, 50 messages each)
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
  Query,
  Req,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.types.js';
import type {
  ConversationResponseDto,
  MessagesPageDto,
  MessageResponseDto,
  ReferencePresetDto,
  SyncCompleteEvent,
  UploadReferenceImagesResponseDto,
} from '../dto/inbox.dto.js';
import {
  CreateReferencePresetDto,
  GetMessagesQueryDto,
  ListConversationsQueryDto,
  ListReferencePresetsQueryDto,
  SendFileMessageDto,
  SendImageMessageDto,
  SendTextMessageDto,
  SetHandoverDto,
} from '../dto/inbox.dto.js';
import { ConversationService } from '../services/conversation.service.js';
import { InboxSyncService } from '../services/inbox-sync.service.js';
import { MessageService } from '../services/message.service.js';
import type { MulterFile } from '../services/upload.service.js';
import { UploadService } from '../services/upload.service.js';
import type { PaginatedResponseDto } from '../../facebook/dto/shared/pagination.dto.js';
import type { Request } from 'express';

@UseGuards(JwtAuthGuard)
@Controller('inbox')
export class InboxController {
  constructor(
    private readonly conversations: ConversationService,
    private readonly messages:      MessageService,
    private readonly uploads:       UploadService,
    private readonly sync:          InboxSyncService,
  ) {}

  // ─── Conversations ─────────────────────────────────────────────────────────

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

  // ─── Messages ──────────────────────────────────────────────────────────────

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

  // ─── Reference images ──────────────────────────────────────────────────────

  @Post('uploads/reference')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FilesInterceptor('images', 10, {
      storage: memoryStorage(),
      limits:  { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadReferenceImages(
    @UploadedFiles() files: MulterFile[],
    @Req() req: Request,
  ): Promise<UploadReferenceImagesResponseDto> {
    return this.uploads.saveReferenceImages(files, `${req.protocol}://${req.get('host')}`);
  }

  @Get('reference-presets')
  listReferencePresets(
    @Query() query: ListReferencePresetsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReferencePresetDto[]> {
    return this.uploads.listReferencePresets(query.businessProfileId, user.sub);
  }

  @Post('reference-presets')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FilesInterceptor('images', 10, {
      storage: memoryStorage(),
      limits:  { fileSize: 5 * 1024 * 1024 },
    }),
  )
  createReferencePreset(
    @Body() dto: CreateReferencePresetDto,
    @UploadedFiles() files: MulterFile[],
    @Req() req: Request,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReferencePresetDto> {
    return this.uploads.createReferencePreset({
      businessProfileId: dto.businessProfileId,
      userId:            user.sub,
      name:              dto.name,
      description:       dto.description,
      files,
      baseUrl:           `${req.protocol}://${req.get('host')}`,
    });
  }

  @Delete('reference-presets/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteReferencePreset(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.uploads.deleteReferencePreset(id, user.sub);
  }

  // ─── Temporary upload ──────────────────────────────────────────────────────

  @Post('uploads/temp')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits:  { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadTemp(
    @UploadedFile() file: MulterFile,
    @Req() req: Request,
  ): Promise<{ url: string }> {
    return this.uploads.saveTempUpload(file, `${req.protocol}://${req.get('host')}`);
  }

  // ─── Sync ──────────────────────────────────────────────────────────────────

  /**
   * POST /inbox/sync/:businessProfileId
   *
   * Regular on-demand sync. Fetches the 25 most recent conversations with
   * 25 messages each. Use this after the inbox is already loaded.
   */
  @Post('sync/:businessProfileId')
  @HttpCode(HttpStatus.OK)
  manualSync(
    @Param('businessProfileId') businessProfileId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SyncCompleteEvent> {
    return this.sync.syncProfile(businessProfileId, user.sub);
  }

  /**
   * POST /inbox/initial-sync/:businessProfileId
   *
   * Full first-connection sync. Fetches 40 conversations with 50 messages
   * each and stores everything in the DB. The frontend calls this once on
   * first open and waits for the sync_complete SSE event before hiding its
   * loading state.
   *
   * Idempotent: calling it on an already-populated inbox is safe — messages
   * already in the DB are skipped via their unique externalId constraint.
   */
  @Post('initial-sync/:businessProfileId')
  @HttpCode(HttpStatus.OK)
  initialSync(
    @Param('businessProfileId') businessProfileId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SyncCompleteEvent> {
    return this.sync.initialSync(businessProfileId, user.sub);
  }
}
