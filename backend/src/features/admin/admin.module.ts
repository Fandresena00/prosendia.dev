// src/features/admin/admin.module.ts
//
// CHANGE: Ajout de AdminDashboardChartsService dans providers.

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../../database/prisma.module.js';
import { BillingModule } from '../billing/billing.module.js';
import { AdminAuthController } from './controllers/admin-auth.controller.js';
import { AdminDashboardController } from './controllers/admin-dashboard.controller.js';
import { AdminManagementController } from './controllers/admin-management.controller.js';
import { AdminUsersController } from './controllers/admin-users.controller.js';
import { AdminAuthService } from './services/admin-auth.service.js';

import { AdminDashboardChartsService } from './services/admin-dashboard-charts.service.js';
import { AdminManagementService } from './services/admin-management.service.js';
import { AdminUserStatsService } from './services/admin-user-stats.service.js';
import { AdminUsersService } from './services/admin-users.service.js';
import { AdminJwtStrategy } from './strategies/admin-jwt.strategy.js';

@Module({
  imports: [
    PrismaModule,
    BillingModule,
    PassportModule.register({ defaultStrategy: 'admin-jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: () => ({ signOptions: { issuer: 'vendeoai-admin' } }),
    }),
  ],
  controllers: [
    AdminAuthController,
    AdminUsersController,
    AdminManagementController,
    AdminDashboardController,
  ],
  providers: [
    AdminAuthService,
    AdminUsersService,
    AdminManagementService,
    AdminUserStatsService,
    AdminDashboardChartsService,
    AdminJwtStrategy,
  ],
})
export class AdminModule {}
