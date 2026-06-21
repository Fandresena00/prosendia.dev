// src/features/admin/controllers/admin-management.controller.ts

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentAdmin } from '../../../common/decorators/current-admin.decorator.js';
import { AdminJwtAuthGuard } from '../../../common/guards/admin-jwt-auth.guard.js';
import { SuperAdminGuard } from '../../../common/guards/super-admin.guard.js';
import { CreateAdminDto } from '../dto/admin-management.dto.js';
import { AdminManagementService } from '../services/admin-management.service.js';
import type { AuthenticatedAdmin } from '../strategies/admin-jwt.strategy.js';

/** Toutes les routes ici exigent le rôle SUPER_ADMIN. */
@UseGuards(AdminJwtAuthGuard, SuperAdminGuard)
@Controller('admin/admins')
export class AdminManagementController {
  constructor(private readonly service: AdminManagementService) {}

  @Get()
  list() {
    return this.service.listAdmins();
  }

  @Post()
  create(
    @Body() dto: CreateAdminDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return this.service.createAdmin(dto, admin.sub);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentAdmin() admin: AuthenticatedAdmin) {
    return this.service.deleteAdmin(id, admin.sub);
  }

  @Patch(':id/activate')
  activate(@Param('id') id: string, @CurrentAdmin() admin: AuthenticatedAdmin) {
    return this.service.toggleActive(id, true, admin.sub);
  }

  @Patch(':id/deactivate')
  deactivate(
    @Param('id') id: string,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return this.service.toggleActive(id, false, admin.sub);
  }
}
