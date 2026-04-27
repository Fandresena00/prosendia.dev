/**
 * @file src/app.service.ts
 * @description Application-level service.
 * Provides the health check payload used by GET /api/health.
 */

import { Injectable } from '@nestjs/common';

export interface HealthStatus {
  status: 'ok';
  timestamp: string;
  uptime: number;
}

@Injectable()
export class AppService {
  getHealth(): HealthStatus {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      /** process.uptime() returns seconds since the Node process started */
      uptime: Math.floor(process.uptime()),
    };
  }
}
