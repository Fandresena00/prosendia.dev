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
import { QueueModule } from '../queue/queue.module.js';
import { InboxController } from './controllers/inbox.controller.js';
import { InboxSseController } from './gateways/inbox-sse.gateway.js';
import { InboxEventsModule } from './inbox-events.module.js';
import { ConversationService } from './services/conversation.service.js';
import { InboxSyncService } from './services/inbox-sync.service.js';
import { MessageService } from './services/message.service.js';
import { UploadService } from './services/upload.service.js';

@Module({
  imports: [
    PrismaModule,
    FacebookModule,
    QueueModule,
    InboxEventsModule,
    ServeStaticModule.forRoot({
      rootPath:   path.join(process.cwd(), 'uploads', 'inbox', 'references'),
      serveRoot:  '/inbox/uploads',
      serveStaticOptions: { index: false },
    }),
  ],
  controllers: [
    InboxController,
    InboxSseController,
  ],
  providers: [
    ConversationService,
    MessageService,
    UploadService,
    InboxSyncService,
  ],
  exports: [
    InboxSyncService,
  ],
})
export class InboxModule {}
