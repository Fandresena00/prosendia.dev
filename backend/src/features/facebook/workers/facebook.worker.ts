/**
 * @file features/facebook/workers/facebook.worker.ts
 *
 * Workers for Facebook background jobs.
 * Lives in FacebookModule (see architecture note in ai-reply.worker.ts).
 *
 * Fixes applied:
 *   - Moved out of QueueModule to avoid circular dependency
 *   - job.retrycount (lowercase 'c') — correct pg-boss v10 property
 *   - catch (err: unknown) properly typed and re-thrown
 *   - InboxSyncService import path verified
 *   - localConcurrency used for pg-boss v12 worker concurrency
 */

import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PgBoss, type JobWithMetadata } from 'pg-boss';
import { PrismaService } from '../../../database/prisma.service.js';
import { InboxSyncService } from '../../inbox/services/inbox-sync.service.js';
import { PG_BOSS_TOKEN } from '../../queue/providers/pg-boss.provider.js';
import {
  QUEUE_JOBS,
  type FacebookSyncPayload,
  type TokenValidatePayload,
} from '../../queue/queue.constants.js';
import { TokenService } from '../services/token.service.js';

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

// ─── Facebook Sync Worker ─────────────────────────────────────────────────────

@Injectable()
export class FacebookSyncWorker implements OnModuleInit {
  private readonly logger = new Logger(FacebookSyncWorker.name);

  constructor(
    @Inject(PG_BOSS_TOKEN)
    private readonly boss:       PgBoss,
    private readonly inboxSync:  InboxSyncService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.boss.work<FacebookSyncPayload>(
      QUEUE_JOBS.FACEBOOK_SYNC,
      { includeMetadata: true, localConcurrency: 2 },
      async (jobs) => {
        for (const job of jobs) await this.handle(job);
      },
    );
    this.logger.log(`Worker registered: ${QUEUE_JOBS.FACEBOOK_SYNC} (localConcurrency: 2)`);
  }

  private async handle(job: JobWithMetadata<FacebookSyncPayload>): Promise<void> {
    const { businessProfileId, userId } = job.data;
    const start = Date.now();

    this.logger.log(
      `Processing facebook.sync — profile=${businessProfileId} job=${job.id}`,
    );

    try {
      await this.inboxSync.syncProfile(businessProfileId, userId);
      this.logger.log(
        `facebook.sync completed — profile=${businessProfileId} in ${Date.now() - start}ms`,
      );
    } catch (err: unknown) {
      const error = toError(err);
      this.logger.error(
        `facebook.sync failed — profile=${businessProfileId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}

// ─── Token Validate Worker ────────────────────────────────────────────────────

@Injectable()
export class TokenValidateWorker implements OnModuleInit {
  private readonly logger = new Logger(TokenValidateWorker.name);

  constructor(
    @Inject(PG_BOSS_TOKEN)
    private readonly boss:          PgBoss,
    private readonly tokenService:  TokenService,
    private readonly prisma:        PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.boss.work<TokenValidatePayload>(
      QUEUE_JOBS.TOKEN_VALIDATE,
      { includeMetadata: true, localConcurrency: 5 },
      async (jobs) => {
        for (const job of jobs) await this.handle(job);
      },
    );
    this.logger.log(`Worker registered: ${QUEUE_JOBS.TOKEN_VALIDATE} (localConcurrency: 5)`);
  }

  private async handle(job: JobWithMetadata<TokenValidatePayload>): Promise<void> {
    const { connectionId, pageId } = job.data;

    this.logger.debug(
      `Processing token.validate — page=${pageId} job=${job.id}`,
    );

    try {
      const connection = await this.prisma.facebookConnection.findUnique({
        where: { id: connectionId },
      });

      if (!connection) {
        // Connection deleted — skip silently, no retry needed
        this.logger.debug(
          `token.validate skipped — connection ${connectionId} no longer exists`,
        );
        return;
      }

      const result = await this.tokenService.validateToken(connection);

      if (result.status === 'INVALID') {
        this.logger.warn(
          `token.validate: INVALID — page=${pageId} connection=${connectionId}`,
        );
      } else if (result.networkError) {
        this.logger.warn(
          `token.validate: network error — page=${pageId}, status unchanged`,
        );
      } else {
        this.logger.debug(
          `token.validate: ${result.status} — page=${pageId}`,
        );
      }
    } catch (err: unknown) {
      const error = toError(err);
      this.logger.error(
        `token.validate failed — page=${pageId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
