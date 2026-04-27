/**
 * @file src/database/prisma.module.ts
 * @description Database module. Exports PrismaService so any feature module
 * that imports PrismaModule can inject PrismaService via its constructor.
 *
 * Usage in feature modules:
 *   @Module({ imports: [PrismaModule], ... })
 *   export class UsersModule {}
 */

import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
