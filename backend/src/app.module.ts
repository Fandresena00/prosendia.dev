/**
 * @file src/app.module.ts
 * @description Root application module.
 *
 * Global infrastructure via DI tokens (testable, overridable):
 *   APP_FILTER ×2 → AllExceptionsFilter (outer), HttpExceptionFilter (inner)
 *   APP_GUARD     → ThrottlerBehindProxyGuard
 *   APP_PIPE      → ValidationPipe
 */

import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { CacheModule } from './common/cache/cache.module.js';
import {
  AllExceptionsFilter,
  HttpExceptionFilter,
} from './common/filters/http-exception.filter.js';
import { ThrottlerBehindProxyGuard } from './common/guards/throttler-behind-proxy.guard.js';
import envConfig from './config/env.config.js';
import { ValidationSchema } from './config/validation.js';
import { PrismaModule } from './database/prisma.module.js';
import { AiModule } from './features/ai/ai.module.js';
import { AuthModule } from './features/auth/auth.module.js';
import { FacebookModule } from './features/facebook/facebook.module.js';
import { InboxEventsModule } from './features/inbox/inbox-events.module.js';
import { InboxModule } from './features/inbox/inbox.module.js';
import { QueueModule } from './features/queue/queue.module.js';
import { UsersModule } from './features/users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: '.env',
      load: [envConfig],
      validationSchema: ValidationSchema,
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'short', ttl: 60_000, limit: 100 },
        { name: 'medium', ttl: 600_000, limit: 500 },
      ],
      errorMessage: 'Too many requests, please try again later.',
    }),
    CacheModule,
    PrismaModule,
    UsersModule,
    AuthModule,
    FacebookModule,
    InboxEventsModule,
    QueueModule,
    FacebookModule,
    AiModule,
    InboxModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // LIFO order — AllExceptionsFilter is outer (registered first, runs last)
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerBehindProxyGuard },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    },
  ],
})
export class AppModule {}
