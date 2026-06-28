// src/features/admin/controllers/admin-custom-plan-template.controller.ts
//
// CRUD des templates de plans custom.
// Accessible à tous les admins authentifiés (pas SUPER_ADMIN only).

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
  CreateCustomPlanTemplateDto,
  UpdateCustomPlanTemplateDto,
} from '../dto/admin-custom-plan-template.dto.js';
import { AdminCustomPlanTemplateService } from '../services/admin-custom-plan-template.service.js';
import type { AuthenticatedAdmin } from '../strategies/admin-jwt.strategy.js';

@UseGuards(AdminJwtAuthGuard)
@Controller('admin/custom-plans')
export class AdminCustomPlanTemplateController {
  constructor(private readonly service: AdminCustomPlanTemplateService) {}

  // GET /admin/custom-plans?includeInactive=true
  @Get()
  list(@Query('includeInactive') includeInactive?: string) {
    return this.service.listTemplates(includeInactive === 'true');
  }

  // POST /admin/custom-plans
  @Post()
  create(
    @Body() dto: CreateCustomPlanTemplateDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return this.service.createTemplate(dto, admin.sub);
  }

  // PATCH /admin/custom-plans/:id
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCustomPlanTemplateDto) {
    return this.service.updateTemplate(id, dto);
  }

  // PATCH /admin/custom-plans/:id/toggle
  @Patch(':id/toggle')
  toggle(@Param('id') id: string) {
    return this.service.toggleActive(id);
  }

  // DELETE /admin/custom-plans/:id
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.deleteTemplate(id);
  }
}
