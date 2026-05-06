/**
 * @file features/queue/providers/pg-boss.provider.ts
 *
 * Singleton PgBoss instance for the entire application.
 * pg-boss manages the "pgboss" schema inside the application's PostgreSQL database.
 *
 * Install: npm install pg-boss
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
  private boss: PgBoss | null = null;
  private initPromise: Promise<PgBoss> | null = null;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.init();
  }

  async init(): Promise<PgBoss> {
    if (this.boss) return this.boss;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.startBoss();
    return this.initPromise;
  }

  private async startBoss(): Promise<PgBoss> {
    const connectionString = this.config.getOrThrow<string>('DATABASE_URL');

    const boss = new PgBoss({
      connectionString,
      monitorIntervalSeconds:      30,
      supervise:                   true,
    });

    // pg-boss emits Error objects — use typed handler
    boss.on('error', (err: Error) => {
      this.logger.error(`PgBoss internal error: ${err.message}`, err.stack);
    });

    await boss.start();

    for (const queueName of Object.values(QUEUE_JOBS)) {
      await boss.createQueue(queueName);
    }

    this.boss = boss;
    this.logger.log('PgBoss started — PostgreSQL job queue ready');
    return boss;
  }

  async onApplicationShutdown(signal?: string): Promise<void> {
    if (!this.boss) return;
    this.logger.log(`Shutting down PgBoss (signal: ${signal ?? 'SIGTERM'})`);
    // graceful: true — wait for in-flight jobs to finish (up to timeout)
    await this.boss.stop({ graceful: true, timeout: 10_000 });
    this.logger.log('PgBoss stopped gracefully');
  }

  getInstance(): PgBoss {
    if (!this.boss) {
      throw new Error(
        'PgBoss is not initialised. Ensure PgBossProvider.onModuleInit() has run.',
      );
    }
    return this.boss;
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
