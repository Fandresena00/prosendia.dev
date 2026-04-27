/**
 * @file src/features/users/users.module.ts
 * @description Users feature module.
 * Exports UsersService so AuthModule can inject it without importing the
 * full module (avoids circular dependency risks).
 */

import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module.js';
import { UsersService } from './services/users.service.js';
import { UsersController } from './users.controller.js';

@Module({
  imports: [PrismaModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
