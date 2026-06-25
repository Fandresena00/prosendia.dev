// src/features/admin/controllers/admin-users.controller.ts
//
// CHANGE: Ajout de GET /:id/stats → AdminUserStatsService.getUserStats()

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
import { AdminUserStatsService } from '../services/admin-user-stats.service.js';
import { AdminUsersService } from '../services/admin-users.service.js';
import type { AuthenticatedAdmin } from '../strategies/admin-jwt.strategy.js';

@UseGuards(AdminJwtAuthGuard)
@Controller('admin/users')
export class AdminUsersController {
  constructor(
    private readonly usersService: AdminUsersService,
    private readonly statsService: AdminUserStatsService,
  ) {}

  // ─── Liste & détail ───────────────────────────────────────────────────────

  @Get()
  list(@Query() query: AdminListUsersQueryDto) {
    return this.usersService.list(query);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.usersService.getDetail(id);
  }

  // ─── Stats dashboard (nouveau endpoint) ───────────────────────────────────
  //
  // GET /admin/users/:id/stats
  // Retourne les statistiques complètes d'un utilisateur :
  // abonnement, usage IA, taux de réponse, activité du jour,
  // graphique hebdomadaire et graphique crédits 30j.

  @Get(':id/stats')
  getUserStats(@Param('id') id: string) {
    return this.statsService.getUserStats(id);
  }

  // ─── Actions ──────────────────────────────────────────────────────────────

  @Post(':id/suspend')
  suspend(
    @Param('id') id: string,
    @Body() dto: SuspendUserDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return this.usersService.suspend(id, dto, admin.sub);
  }

  @Post(':id/reactivate')
  reactivate(
    @Param('id') id: string,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return this.usersService.reactivate(id, admin.sub);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return this.usersService.delete(id, admin.sub);
  }

  @Patch(':id/plan')
  changePlan(
    @Param('id') id: string,
    @Body() dto: ChangeUserPlanDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return this.usersService.changePlan(id, dto, admin.sub);
  }

  @Post(':id/credits/adjust')
  adjustCredits(
    @Param('id') id: string,
    @Body() dto: AdjustCreditsDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return this.usersService.adjustCredits(id, dto, admin.sub);
  }
}
