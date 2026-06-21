// src/features/admin/controllers/admin-dashboard.controller.ts

import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminJwtAuthGuard } from '../../../common/guards/admin-jwt-auth.guard.js';
import { PrismaService } from '../../../database/prisma.service.js';

@UseGuards(AdminJwtAuthGuard)
@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(private readonly prisma: PrismaService) {}

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
}
