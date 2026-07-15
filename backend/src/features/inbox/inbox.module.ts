/**
 * @file features/inbox/inbox.module.ts
 *
 * Full inbox feature module: REST API, realtime (WebSocket) stream, sync, upload.
 * Imports InboxEventsModule (shared) instead of redeclaring InboxEventEmitter.
 *
 * CHANGES (realtime upgrade):
 *   - InboxWsGateway replaces InboxSseController as the realtime transport
 *     (see gateways/inbox-sse.gateway.ts header for the rollback path).
 *   - AiSuggestionService added — powers the reply-suggestion button, called
 *     from InboxWsGateway's `request_ai_suggestion` handler.
 *   - JwtService is required by InboxWsGateway to authenticate the WebSocket
 *     handshake. This assumes JwtModule is registered globally at the
 *     AppModule level (the common pattern already used for the REST JWT
 *     guards) — if it isn't, add `JwtModule.register({...})` to the imports
 *     array below with the same secret as JwtAuthGuard.
 */

import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import * as path from 'path';
import { PrismaModule } from '../../database/prisma.module.js';
import { FacebookModule } from '../facebook/facebook.module.js';
import { TokenEncryptionService } from '../facebook/security/token-encryption.service.js';
import { QueueModule } from '../queue/queue.module.js';
import { InboxController } from './controllers/inbox.controller.js';
import { InboxWsGateway } from './gateways/inbox-ws.gateway.js';
import { InboxEventsModule } from './inbox-events.module.js';
import { AiSuggestionService } from './services/ai-suggestion.service.js';
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
  // InboxSseController intentionally NOT registered here anymore —
  // InboxWsGateway (a provider, not a controller) is the realtime transport.
  controllers: [InboxController],
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
    AiSuggestionService,
    InboxWsGateway,
  ],
  exports: [InboxSyncService],
})
export class InboxModule {}
