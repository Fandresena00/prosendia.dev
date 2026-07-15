/**
 * @file features/inbox/inbox.module.ts
 *
 * Full inbox feature module: REST API, realtime (WebSocket) stream, sync, upload.
 * Imports InboxEventsModule (shared) instead of redeclaring InboxEventEmitter.
 *
 * CHANGES (realtime upgrade):
 *   - InboxWsGateway replaces InboxSseController as the realtime transport
 *     (see gateways/inbox-sse.gateway.ts header for the rollback path).
 *   - AiModule is now imported so InboxWsGateway can inject AiSuggestionService
 *     (features/ai/services/ai-suggestion.service.ts) — it lives there, not
 *     here, so it can reuse OpenRouterClient / PromptBuilderService /
 *     CreditService instead of duplicating that wiring. No circular
 *     dependency: AiModule only imports InboxEventsModule (the lean shared
 *     module), never InboxModule itself.
 *   - JwtModule.registerAsync — CONFIRMED NEEDED: booting the app threw
 *     `UnknownDependenciesException` for InboxWsGateway's JwtService, which
 *     means JwtModule is NOT global in this app (unlike ConfigModule, which
 *     clearly is — every feature module injects ConfigService without
 *     importing ConfigModule anywhere). Registered here with the exact same
 *     config key (`jwtSecret`) JwtStrategy uses via
 *     `configService.getOrThrow<string>('jwtSecret')`, so token
 *     verification is guaranteed consistent between the REST 'jwt' Passport
 *     strategy and this WebSocket gateway's manual check. No new dependency
 *     — @nestjs/jwt is already installed (JwtStrategy already depends on
 *     the underlying `jsonwebtoken` it wraps).
 */

import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ServeStaticModule } from '@nestjs/serve-static';
import * as path from 'path';
import { PrismaModule } from '../../database/prisma.module.js';
import { AiModule } from '../ai/ai.module.js';
import { FacebookModule } from '../facebook/facebook.module.js';
import { TokenEncryptionService } from '../facebook/security/token-encryption.service.js';
import { QueueModule } from '../queue/queue.module.js';
import { InboxController } from './controllers/inbox.controller.js';
import { InboxWsGateway } from './gateways/inbox-ws.gateway.js';
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
    AiModule, // ← exposes AiSuggestionService to InboxWsGateway
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('jwtSecret'),
      }),
    }),
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
    InboxWsGateway,
  ],
  exports: [InboxSyncService],
})
export class InboxModule {}
