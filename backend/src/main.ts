/**
 * @file src/main.ts
 * @description Application bootstrap.
 *
 * Cookie-based auth requires:
 *   1. cookie-parser  — parses Cookie header into req.cookies
 *   2. credentials: true in CORS — allows browser to send/receive cookies cross-origin
 *
 * Global infrastructure (ValidationPipe, ExceptionFilter, ThrottlerGuard)
 * is registered in AppModule via DI tokens — not here.
 */

import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn', 'log']
        : ['error', 'warn', 'log', 'debug', 'verbose'],
    rawBody: true, // ⭐ IMPORTANT
  });

  const configService = app.get(ConfigService);
  const port = configService.getOrThrow<number>('port');
  const frontendUrl = configService.getOrThrow<string>('frontendUrl');
  const nodeEnv = configService.getOrThrow<string>('nodeEnv');
  const isProduction = nodeEnv === 'production';

  // ── Trust proxy ──────────────────────────────────────────────────────────────
  // Required before any middleware that reads req.ip / req.ips.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // ── Cookie parser ────────────────────────────────────────────────────────────
  // Must be registered BEFORE route handlers so req.cookies is populated
  // when JWT strategies read the access/refresh token cookies.
  app.use(cookieParser());

  // ── Graceful shutdown ────────────────────────────────────────────────────────
  app.enableShutdownHooks();

  (app as NestExpressApplication).useStaticAssets(
    join(process.cwd(), 'uploads'),
    { prefix: '/uploads/' },
  );

  // ── Security headers ─────────────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          fontSrc: ["'self'", 'https:', 'data:'],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          imgSrc: ["'self'", 'data:'],
          objectSrc: ["'none'"],
          scriptSrc: ["'self'"],
          scriptSrcAttr: ["'none'"],
          styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
          upgradeInsecureRequests: isProduction ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: 'same-site' },
      frameguard: { action: 'deny' },
      hsts: isProduction
        ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
        : false,
      noSniff: true,
      originAgentCluster: true,
      referrerPolicy: { policy: 'no-referrer' },
      xDnsPrefetchControl: { allow: false },
      xDownloadOptions: true,
      xPermittedCrossDomainPolicies: { permittedPolicies: 'none' },
      xXssProtection: false,
    }),
  );

  // ── CORS ─────────────────────────────────────────────────────────────────────
  // credentials: true is REQUIRED for the browser to send/receive HttpOnly cookies.
  // Without this, Set-Cookie is silently ignored and cookies are never sent.
  app.enableCors({
    origin: frontendUrl,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    credentials: true,
  });

  await app.listen(port);

  logger.log(`🚀 Server at http://localhost:${port}`);
  logger.log(`🌍 Environment: ${nodeEnv}`);
  logger.log(`🔒 CORS origin: ${frontendUrl}`);
  logger.log(`🍪 Cookie auth: enabled`);
}

bootstrap().catch((error: unknown) => {
  const logger = new Logger('Bootstrap');
  logger.error(
    'Failed to start application',
    error instanceof Error ? error.stack : String(error),
  );
  process.exit(1);
});
