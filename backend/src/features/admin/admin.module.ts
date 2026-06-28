// src/features/admin/admin.module.ts
// Version finale — tous les services et controllers inclus.

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../../database/prisma.module.js';
import { BillingModule } from '../billing/billing.module.js';
import { AdminCustomPlanTemplateBillingService } from '../billing/services/admin-custom-plan-template-billing.service.js';
import { AdminAuthController } from './controllers/admin-auth.controller.js';
import { AdminCustomPlanTemplateController } from './controllers/admin-custom-plan-template.controller.js';
import { AdminDashboardController } from './controllers/admin-dashboard.controller.js';
import { AdminLogsController } from './controllers/admin-logs.controller.js';
import { AdminManagementController } from './controllers/admin-management.controller.js';
import { AdminUsersController } from './controllers/admin-users.controller.js';
import { AdminAuthService } from './services/admin-auth.service.js';
import { AdminCustomPlanTemplateService } from './services/admin-custom-plan-template.service.js';
import { AdminCustomSubscriptionService } from './services/admin-custom-subscription.service.js';
import { AdminDashboardChartsService } from './services/admin-dashboard-charts.service.js';
import { AdminLogsService } from './services/admin-logs.service.js';
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
    AdminLogsController,
    AdminCustomPlanTemplateController,
  ],
  providers: [
    AdminAuthService,
    AdminUsersService,
    AdminManagementService,
    AdminUserStatsService,
    AdminDashboardChartsService,
    AdminCustomSubscriptionService,
    AdminCustomPlanTemplateService,
    AdminCustomPlanTemplateBillingService,
    AdminLogsService,
    AdminJwtStrategy,
  ],
  exports: [
    AdminCustomPlanTemplateService,
    AdminCustomPlanTemplateBillingService,
  ],
})
export class AdminModule {}
