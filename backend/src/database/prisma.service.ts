/**
 * @file src/database/prisma.service.ts
 * @description PrismaClient wrapper for NestJS.
 *
 * Lifecycle:
 * - onModuleInit: establishes the DB connection when the module is loaded
 * - NestJS handles connection pooling; do not call $connect() manually elsewhere
 *
 * Uses the PrismaPg adapter for native PostgreSQL connection pooling
 * (required when using Prisma with @prisma/adapter-pg).
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  constructor(configService: ConfigService) {
    // Read via the typed alias defined in env.config.ts, not the raw env var name.
    // configService.getOrThrow('databaseUrl') → process.env.DATABASE_URL (already validated)
    const connectionString = configService.getOrThrow<string>('databaseUrl');
    const adapter = new PrismaPg({ connectionString });

    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Database connected');
  }
}
