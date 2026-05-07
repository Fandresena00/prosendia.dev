/**
 * @file features/queue/providers/pg-boss.provider.ts
 *
 * Singleton PgBoss instance for the entire application.
 * pg-boss manages the "pgboss" schema inside the application's PostgreSQL database.
 *
 * FIX: `config.getOrThrow('DATABASE_URL')` changed to `config.getOrThrow('databaseUrl')`.
 *      ConfigService resolves keys via the typed factory in env.config.ts, not raw env var names.
 *      Using the raw name bypassed Joi validation and could silently use an unvalidated URL.
 */

import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PgBoss } from 'pg-boss';
import { QUEUE_JOBS } from '../queue.constants.js';

export const PG_BOSS_TOKEN = 'PG_BOSS';

@Injectable()
export class PgBossProvider implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(PgBossProvider.name);
  private pgBossInstance:  PgBoss | null       = null;
  private initPromise:     Promise<PgBoss> | null = null;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.init();
  }

  async init(): Promise<PgBoss> {
    if (this.pgBossInstance) return this.pgBossInstance;
    if (this.initPromise)    return this.initPromise;

    this.initPromise = this.startPgBoss();
    return this.initPromise;
  }

  private async startPgBoss(): Promise<PgBoss> {
    // FIX: use the typed alias 'databaseUrl' (env.config.ts) instead of the raw
    //      env var name 'DATABASE_URL'. Both resolve to the same value, but the
    //      alias goes through Joi validation and ConfigService's typed cache.
    const databaseConnectionString = this.config.getOrThrow<string>('databaseUrl');

    const boss = new PgBoss({
      connectionString:        databaseConnectionString,
      monitorIntervalSeconds:  30,
      supervise:               true,
    });

    // pg-boss emits Error objects — use a typed handler
    boss.on('error', (err: Error) => {
      this.logger.error(`PgBoss internal error: ${err.message}`, err.stack);
    });

    await boss.start();

    // Ensure all queues exist before workers try to register
    for (const queueName of Object.values(QUEUE_JOBS)) {
      await boss.createQueue(queueName);
    }

    this.pgBossInstance = boss;
    this.logger.log('PgBoss started — PostgreSQL job queue ready');
    return boss;
  }

  async onApplicationShutdown(signal?: string): Promise<void> {
    if (!this.pgBossInstance) return;
    this.logger.log(`Shutting down PgBoss (signal: ${signal ?? 'SIGTERM'})`);
    await this.pgBossInstance.stop({ graceful: true, timeout: 10_000 });
    this.logger.log('PgBoss stopped gracefully');
  }

  getInstance(): PgBoss {
    if (!this.pgBossInstance) {
      throw new Error(
        'PgBoss is not initialised. Ensure PgBossProvider.onModuleInit() has run.',
      );
    }
    return this.pgBossInstance;
  }
}

/**
 * Factory provider — lets any provider inject PgBoss by token.
 *
 * Usage: @Inject(PG_BOSS_TOKEN) private readonly boss: PgBoss
 */
export const pgBossFactory = {
  provide:    PG_BOSS_TOKEN,
  inject:     [PgBossProvider],
  useFactory: (provider: PgBossProvider): Promise<PgBoss> => provider.init(),
};
