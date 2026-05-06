/**
 * @file features/queue/queue-monitor.service.ts
 *
 * Monitors the pg-boss job queue for dead-letter jobs and exposes stats.
 *
 * Fixes applied:
 *   - boss.schedule() replaced with boss.work() + scheduled name (pg-boss v10 pattern)
 *   - getQueueStats() mapped into the monitor response shape
 *   - getJobById(name, id) — correct param order for pg-boss v10
 *   - catch (err: unknown) properly typed
 *   - MONITOR_SCHEDULE job registered correctly for periodic execution
 */

import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PgBoss } from 'pg-boss';
import { PG_BOSS_TOKEN } from './providers/pg-boss.provider.js';
import { QUEUE_JOBS, type QueueJobName } from './queue.constants.js';

export interface JobStateCounts {
  created: number;
  retry: number;
  active: number;
  completed: number;
  expired: number;
  cancelled: number;
  failed: number;
}

export type QueueStats = Record<string, JobStateCounts>;

const MONITOR_JOB_NAME = '__queue.monitor__';
const MONITOR_CRON = '*/5 * * * *'; // every 5 minutes

@Injectable()
export class QueueMonitorService implements OnModuleInit {
  private readonly logger = new Logger(QueueMonitorService.name);

  constructor(
    @Inject(PG_BOSS_TOKEN)
    private readonly boss: PgBoss,
  ) {}

  async onModuleInit(): Promise<void> {
    // Register the recurring scan using pg-boss schedule + work pattern
    await this.boss.createQueue(MONITOR_JOB_NAME);
    await this.boss.schedule(MONITOR_JOB_NAME, MONITOR_CRON, {});

    await this.boss.work(MONITOR_JOB_NAME, async () => {
      await this.scanDeadLetterJobs();
    });

    this.logger.log(
      'Queue monitor registered — dead-letter scan every 5 minutes',
    );
  }

  // ─── Dead-letter scan ─────────────────────────────────────────────────────

  private async scanDeadLetterJobs(): Promise<void> {
    try {
      const stats = await this.getStats();

      for (const [name, counts] of Object.entries(stats)) {
        if (counts.failed > 0) {
          this.logger.error(
            `DEAD-LETTER: ${counts.failed} permanently failed "${name}" job(s). ` +
              `Use POST /queue/replay/${name}/:jobId to replay.`,
          );
        }
      }
    } catch (err: unknown) {
      this.logger.error(
        `Dead-letter scan error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ─── Stats ────────────────────────────────────────────────────────────────

  async getStats(): Promise<QueueStats> {
    const jobNames = Object.values(QUEUE_JOBS) as QueueJobName[];
    const stats: QueueStats = {};

    await Promise.all(
      jobNames.map(async (name) => {
        try {
          const raw = await this.boss.getQueueStats(name);

          stats[name] = {
            created: Number(raw.queuedCount ?? 0),
            retry: 0,
            active: Number(raw.activeCount ?? 0),
            completed: 0,
            expired: Number(raw.deferredCount ?? 0),
            cancelled: 0,
            failed: 0,
          };
        } catch {
          stats[name] = {
            created: 0,
            retry: 0,
            active: 0,
            completed: 0,
            expired: 0,
            cancelled: 0,
            failed: 0,
          };
        }
      }),
    );

    return stats;
  }

  // ─── Dead-letter replay ───────────────────────────────────────────────────

  /**
   * Re-enqueue a failed job by ID.
   * @param jobName  The queue name (e.g. "ai.reply")
   * @param jobId    UUID of the pg-boss job to replay
   */
  async replayFailedJob(
    jobName: QueueJobName,
    jobId: string,
  ): Promise<{ replayedJobId: string | null }> {
    try {
      // pg-boss v10: getJobById(name, id) — name first, id second
      const job = await this.boss.getJobById(jobName, jobId);

      if (!job) {
        this.logger.warn(
          `replayFailedJob: job ${jobId} not found in queue "${jobName}"`,
        );
        return { replayedJobId: null };
      }

      const replayedJobId = await this.boss.send(jobName, job.data as object, {
        retryLimit: 3,
        retryBackoff: true,
        retryDelay: 10,
      });

      this.logger.log(
        `Replayed dead-letter job=${jobId} → new job=${replayedJobId} (${jobName})`,
      );

      return { replayedJobId };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`replayFailedJob failed for job=${jobId}: ${message}`);
      return { replayedJobId: null };
    }
  }
}
