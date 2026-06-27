// src/features/admin/controllers/admin-logs.controller.ts
//
// Accessible uniquement aux SUPER_ADMIN.
// GET /admin/logs          → liste paginée avec filtres
// GET /admin/logs/admins   → liste des admins distincts pour le filtre

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminJwtAuthGuard } from '../../../common/guards/admin-jwt-auth.guard.js';
import { SuperAdminGuard } from '../../../common/guards/super-admin.guard.js';
import {
  AdminLogsQuery,
  AdminLogsService,
} from '../services/admin-logs.service.js';

@UseGuards(AdminJwtAuthGuard, SuperAdminGuard)
@Controller('admin/logs')
export class AdminLogsController {
  constructor(private readonly logsService: AdminLogsService) {}

  @Get()
  getLogs(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('adminId') adminId?: string,
    @Query('action') action?: string,
    @Query('targetType') targetType?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const query: AdminLogsQuery = {
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 30,
      adminId: adminId || undefined,
      action: action || undefined,
      targetType: targetType || undefined,
      from: from || undefined,
      to: to || undefined,
    };
    return this.logsService.getLogs(query);
  }

  @Get('admins')
  getAdmins() {
    return this.logsService.getDistinctAdmins();
  }
}
