// src/features/admin/controllers/admin-users.controller.ts

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentAdmin } from '../../../common/decorators/current-admin.decorator.js';
import { AdminJwtAuthGuard } from '../../../common/guards/admin-jwt-auth.guard.js';
import {
  AdjustCreditsDto,
  AdminListUsersQueryDto,
  ChangeUserPlanDto,
  SuspendUserDto,
} from '../dto/admin-users.dto.js';
import { AdminUsersService } from '../services/admin-users.service.js';
import type { AuthenticatedAdmin } from '../strategies/admin-jwt.strategy.js';

@UseGuards(AdminJwtAuthGuard)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly service: AdminUsersService) {}

  @Get()
  list(@Query() query: AdminListUsersQueryDto) {
    return this.service.list(query);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.service.getDetail(id);
  }

  @Post(':id/suspend')
  suspend(
    @Param('id') id: string,
    @Body() dto: SuspendUserDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return this.service.suspend(id, dto, admin.sub);
  }

  @Post(':id/reactivate')
  reactivate(
    @Param('id') id: string,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return this.service.reactivate(id, admin.sub);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentAdmin() admin: AuthenticatedAdmin) {
    return this.service.delete(id, admin.sub);
  }

  @Patch(':id/plan')
  changePlan(
    @Param('id') id: string,
    @Body() dto: ChangeUserPlanDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return this.service.changePlan(id, dto, admin.sub);
  }

  @Post(':id/credits/adjust')
  adjustCredits(
    @Param('id') id: string,
    @Body() dto: AdjustCreditsDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return this.service.adjustCredits(id, dto, admin.sub);
  }
}
