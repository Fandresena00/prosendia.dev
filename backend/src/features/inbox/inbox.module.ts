/**
 * @file features/inbox/inbox.module.ts
 *
 * Full inbox feature module: REST API, SSE stream, sync, upload.
 * Imports InboxEventsModule (shared) instead of redeclaring InboxEventEmitter.
 */

import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import * as path from 'path';
import { PrismaModule } from '../../database/prisma.module.js';
import { FacebookModule } from '../facebook/facebook.module.js';
import { TokenEncryptionService } from '../facebook/security/token-encryption.service.js';
import { QueueModule } from '../queue/queue.module.js';
import { InboxController } from './controllers/inbox.controller.js';
import { InboxSseController } from './gateways/inbox-sse.gateway.js';
import { InboxEventsModule } from './inbox-events.module.js';
import { CacheCleanupService } from './services/cache-cleanup.service.js';
import { ConversationService } from './services/conversation.service.js';
import { InboxSyncSchedulerService } from './services/inbox-sync-scheduler.service.js';
import { InboxSyncService } from './services/inbox-sync.service.js';
import { MediaDownloadService } from './services/media-download.service.js';
import { MessageService } from './services/message.service.js';
import { TempFileCleanupService } from './services/temp-file-cleanup.service.js';
import { TempUploadService } from './services/temp-upload.service.js';
import { UploadService } from './services/upload.service.js';

@Module({
  imports: [
    PrismaModule,
    FacebookModule,
    QueueModule,
    InboxEventsModule,
    ServeStaticModule.forRoot({
      rootPath: path.join(process.cwd(), 'uploads', 'inbox', 'references'),
      serveRoot: '/inbox/uploads',
      serveStaticOptions: { index: false },
    }),
  ],
  controllers: [InboxController, InboxSseController],
  providers: [
    ConversationService,
    MessageService,
    UploadService,
    InboxSyncService,
    InboxSyncSchedulerService,
    TokenEncryptionService,
    CacheCleanupService,
    TempFileCleanupService,
    TempUploadService,
    MediaDownloadService,
  ],
  exports: [InboxSyncService],
})
export class InboxModule {}
