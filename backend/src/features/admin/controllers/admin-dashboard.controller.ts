// src/features/admin/controllers/admin-dashboard.controller.ts
//
// CHANGE: Ajout de GET /admin/dashboard/charts avec AdminDashboardChartsService.
// AdminDashboardChartsService doit être ajouté aux providers de AdminModule.

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminJwtAuthGuard } from '../../../common/guards/admin-jwt-auth.guard.js';
import { PrismaService } from '../../../database/prisma.service.js';
import {
  AdminDashboardChartsService,
  type ChartPeriod,
} from '../services/admin-dashboard-charts.service.js';

@UseGuards(AdminJwtAuthGuard)
@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chartsService: AdminDashboardChartsService,
  ) {}

  // GET /admin/dashboard — Métriques globales
  @Get()
  async getStats() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [totalUsers, activeSubs, suspended, newToday, revenueAgg] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.subscription.count({ where: { status: 'ACTIVE' } }),
        this.prisma.user.count({ where: { isSuspended: true } }),
        this.prisma.user.count({ where: { createdAt: { gte: startOfDay } } }),
        this.prisma.payment.aggregate({
          where: { status: 'SUCCESS' },
          _sum: { amount: true },
        }),
      ]);

    return {
      totalUsers,
      activeSubscriptions: activeSubs,
      suspendedUsers: suspended,
      newUsersToday: newToday,
      totalRevenue: revenueAgg._sum.amount ?? 0,
    };
  }

  // GET /admin/dashboard/charts?period=7d|30d|90d
  @Get('charts')
  async getCharts(@Query('period') period: string = '30d') {
    const validPeriods: ChartPeriod[] = ['7d', '30d', '90d'];
    const safePeriod: ChartPeriod = validPeriods.includes(period as ChartPeriod)
      ? (period as ChartPeriod)
      : '30d';

    return this.chartsService.getCharts(safePeriod);
  }
}
