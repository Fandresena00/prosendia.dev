/**
 * @file src/app.controller.ts
 * @description Root controller. Exposes a single health-check endpoint
 * used by load balancers, uptime monitors, and deployment pipelines.
 *
 * GET /api/health → { status: "ok", timestamp: "…", uptime: 42 }
 */

import { Controller, Get } from '@nestjs/common';
import { AppService, type HealthStatus } from './app.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  getHealth(): HealthStatus {
    return this.appService.getHealth();
  }
}
