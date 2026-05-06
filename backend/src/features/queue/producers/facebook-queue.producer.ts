/**
 * @file features/queue/producers/facebook-queue.producer.ts
 *
 * Enqueues Facebook-related background jobs.
 *
 * Fixes applied:
 *   - boss.insert() replaced with boss.send() loop (pg-boss v10 insert signature changed)
 *   - catch (err: unknown) typed properly
 *   - singletonKey is a plain string via buildSingletonKey()
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { PgBoss } from 'pg-boss';
import {
  JOB_OPTIONS,
  QUEUE_JOBS,
  buildSingletonKey,
  type FacebookSyncPayload,
  type TokenValidatePayload,
} from '../queue.constants.js';
import { PG_BOSS_TOKEN } from '../providers/pg-boss.provider.js';

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

@Injectable()
export class FacebookQueueProducer {
  private readonly logger = new Logger(FacebookQueueProducer.name);

  constructor(
    @Inject(PG_BOSS_TOKEN)
    private readonly boss: PgBoss,
  ) {}

  /**
   * Enqueue a Facebook sync job.
   * Deduplicated per businessProfileId — safe to call on every webhook delivery.
   */
  async enqueueFacebookSync(payload: FacebookSyncPayload): Promise<string | null> {
    const opts = JOB_OPTIONS.FACEBOOK_SYNC;

    try {
      const jobId = await this.boss.send(QUEUE_JOBS.FACEBOOK_SYNC, payload, {
        retryLimit:      opts.retryLimit,
        retryDelay:      opts.retryDelay,
        retryBackoff:    opts.retryBackoff,
        expireInSeconds: opts.expireInSeconds,
        singletonKey:    buildSingletonKey(QUEUE_JOBS.FACEBOOK_SYNC, payload.businessProfileId),
        priority:        opts.priority,
      });

      if (jobId) {
        this.logger.log(
          `Enqueued facebook.sync — profile=${payload.businessProfileId} job=${jobId}`,
        );
      } else {
        this.logger.debug(
          `facebook.sync deduplicated — profile=${payload.businessProfileId}`,
        );
      }

      return jobId;
    } catch (err: unknown) {
      this.logger.error(
        `Failed to enqueue facebook.sync for profile=${payload.businessProfileId}: ${toErrorMessage(err)}`,
      );
      return null;
    }
  }

  /**
   * Enqueue a single token validation job.
   */
  async enqueueTokenValidation(payload: TokenValidatePayload): Promise<string | null> {
    const opts = JOB_OPTIONS.TOKEN_VALIDATE;

    try {
      const jobId = await this.boss.send(QUEUE_JOBS.TOKEN_VALIDATE, payload, {
        retryLimit:      opts.retryLimit,
        retryDelay:      opts.retryDelay,
        retryBackoff:    opts.retryBackoff,
        expireInSeconds: opts.expireInSeconds,
        priority:        opts.priority,
      });

      this.logger.debug(
        `Enqueued token.validate — page=${payload.pageId} job=${jobId ?? 'null'}`,
      );

      return jobId;
    } catch (err: unknown) {
      this.logger.error(
        `Failed to enqueue token.validate for page=${payload.pageId}: ${toErrorMessage(err)}`,
      );
      return null;
    }
  }

  /**
   * Bulk-enqueue token validations for all active connections.
   * Uses sequential sends (pg-boss v10 removed typed batch insert).
   *
   * Sends in batches of 50 to avoid overwhelming the event loop.
   */
  async enqueueAllTokenValidations(connections: TokenValidatePayload[]): Promise<void> {
    const BATCH = 50;
    let sent    = 0;

    for (let i = 0; i < connections.length; i += BATCH) {
      const slice = connections.slice(i, i + BATCH);

      await Promise.allSettled(
        slice.map((c) => this.enqueueTokenValidation(c)),
      );

      sent += slice.length;
      this.logger.debug(`Token validate batch: ${sent}/${connections.length} enqueued`);
    }

    this.logger.log(`Bulk-enqueued ${connections.length} token.validate jobs`);
  }
}
