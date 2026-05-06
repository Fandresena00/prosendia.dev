/**
 * @file features/queue/queue.controller.ts
 *
 * Admin endpoints for queue visibility and dead-letter replay.
 * Protect with a role guard in production.
 *
 * Fixes applied:
 *   - replayFailedJob(jobName, jobId) — correct param order to match service
 *   - +page / +pageSize removed (not used here)
 */

import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { QueueMonitorService, type QueueStats } from './queue-monitor.service.js';
import type { QueueJobName } from './queue.constants.js';

@UseGuards(JwtAuthGuard)
@Controller('queue')
export class QueueController {
  constructor(private readonly monitor: QueueMonitorService) {}

  /**
   * GET /queue/stats
   * Returns job counts per state for every registered job type.
   */
  @Get('stats')
  getStats(): Promise<QueueStats> {
    return this.monitor.getStats();
  }

  /**
   * POST /queue/replay/:name/:jobId
   * Re-enqueue a permanently-failed (dead-letter) job.
   */
  @Post('replay/:name/:jobId')
  @HttpCode(HttpStatus.OK)
  replayJob(
    @Param('name')  jobName: string,
    @Param('jobId') jobId:   string,
  ): Promise<{ replayedJobId: string | null }> {
    // Cast is safe — unknown job names are handled gracefully in replayFailedJob
    return this.monitor.replayFailedJob(jobName as QueueJobName, jobId);
  }
}
