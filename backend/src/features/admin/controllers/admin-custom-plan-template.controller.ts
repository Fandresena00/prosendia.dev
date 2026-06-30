// src/features/admin/controllers/admin-custom-plan-config.controller.ts
//
// Endpoints admin pour gérer les configs custom (user-specific).
//
// GET    /admin/custom-plans                    → liste toutes les configs (avec user info)
// GET    /admin/custom-plans/user/:userId       → config d'un user spécifique
// POST   /admin/custom-plans                    → crée/remplace la config d'un user
// PATCH  /admin/custom-plans/:id               → modifie partiellement
// PATCH  /admin/custom-plans/:id/toggle        → toggle visibilité
// DELETE /admin/custom-plans/:id               → supprime la config

import {
  Body, Controller, Delete, Get, Param, Patch, Post,
  Query, UseGuards,
} from '@nestjs/common';
import { CurrentAdmin } from '../../../common/decorators/current-admin.decorator.js';
import { AdminJwtAuthGuard } from '../../../common/guards/admin-jwt-auth.guard.js';
import {
  CreateCustomPlanConfigDto,
  UpdateCustomPlanConfigDto,
} from '../dto/admin-custom-plan-template.dto.js';
import { AdminCustomPlanTemplateService } from '../services/admin-custom-plan-template.service.js';
import type { AuthenticatedAdmin } from '../strategies/admin-jwt.strategy.js';

@UseGuards(AdminJwtAuthGuard)
@Controller('admin/custom-plans')
export class AdminCustomPlanTemplateController {
  constructor(private readonly service: AdminCustomPlanTemplateService) {}

  // Toutes les configs (vue admin globale)
  @Get()
  list(@Query('includeInvisible') includeInvisible?: string) {
    return this.service.listTemplates(includeInvisible === 'true');
  }

  // Config d'un user spécifique
  @Get('user/:userId')
  getForUser(@Param('userId') userId: string) {
    return this.service.getConfigForUser(userId);
  }

  // Crée ou remplace la config d'un user
  @Post()
  create(
    @Body() dto: CreateCustomPlanConfigDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return this.service.createTemplate(dto, admin.sub);
  }

  // Modification partielle
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomPlanConfigDto,
  ) {
    return this.service.updateTemplate(id, dto);
  }

  // Toggle visibilité (visible/caché côté user)
  @Patch(':id/toggle')
  toggle(@Param('id') id: string) {
    return this.service.toggleActive(id);
  }

  // Suppression de la config
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.deleteTemplate(id);
  }
}
