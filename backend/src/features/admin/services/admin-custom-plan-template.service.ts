// src/features/admin/services/admin-custom-plan-template.service.ts
//
// CRUD des templates de plans custom créés par les admins.
// Un template est distinct d'un abonnement :
//   - Template  = config tarifaire/limites définie par l'admin
//   - Attribution = création d'un abonnement CUSTOM basé sur ce template (ou manuellement)
//
// Endpoints produits :
//   GET    /admin/custom-plans              → liste tous les templates
//   POST   /admin/custom-plans              → crée un template
//   PATCH  /admin/custom-plans/:id          → modifie un template
//   DELETE /admin/custom-plans/:id          → supprime (ou désactive)
//   PATCH  /admin/custom-plans/:id/toggle   → active/désactive la visibilité
//
// Côté user (BillingController) :
//   GET /billing/plans  inclut les templates publics/actifs dans la liste des plans
//   L'attribution reste déclenchée :
//     a) par le user (achat via Papi) — souscription standard
//     b) par l'admin (POST /admin/users/:id/subscription/custom) — attribution manuelle

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import type { CreateCustomPlanTemplateDto, UpdateCustomPlanTemplateDto } from '../dto/admin-custom-plan-template.dto.js';

@Injectable()
export class AdminCustomPlanTemplateService {
  private readonly logger = new Logger(AdminCustomPlanTemplateService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Liste ────────────────────────────────────────────────────────────────

  async listTemplates(includeInactive = false) {
    return this.prisma.customPlanTemplate.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Création ─────────────────────────────────────────────────────────────

  async createTemplate(dto: CreateCustomPlanTemplateDto, adminId: string) {
    this.validateLimits(dto);

    const template = await this.prisma.customPlanTemplate.create({
      data: {
        name:               dto.name,
        description:        dto.description,
        priceAriary:        dto.priceAriary,
        durationDays:       dto.durationDays,
        credits:            dto.credits,
        maxPages:           dto.maxPages,
        maxManagedPosts:    dto.maxManagedPosts,
        maxReferenceImages: dto.maxReferenceImages,
        isPublic:           dto.isPublic ?? true,
        isActive:           true,
        createdByAdminId:   adminId,
        note:               dto.note,
      },
    });

    this.logger.log(
      `[CUSTOM_PLAN_CREATED] id=${template.id} name="${template.name}" admin=${adminId}`,
    );

    return template;
  }

  // ─── Modification ─────────────────────────────────────────────────────────

  async updateTemplate(id: string, dto: UpdateCustomPlanTemplateDto) {
    await this.ensureExists(id);
    if (dto.credits !== undefined || dto.priceAriary !== undefined) {
      this.validateLimits(dto);
    }

    return this.prisma.customPlanTemplate.update({
      where: { id },
      data: {
        ...(dto.name               !== undefined && { name:               dto.name }),
        ...(dto.description        !== undefined && { description:        dto.description }),
        ...(dto.priceAriary        !== undefined && { priceAriary:        dto.priceAriary }),
        ...(dto.durationDays       !== undefined && { durationDays:       dto.durationDays }),
        ...(dto.credits            !== undefined && { credits:            dto.credits }),
        ...(dto.maxPages           !== undefined && { maxPages:           dto.maxPages }),
        ...(dto.maxManagedPosts    !== undefined && { maxManagedPosts:    dto.maxManagedPosts }),
        ...(dto.maxReferenceImages !== undefined && { maxReferenceImages: dto.maxReferenceImages }),
        ...(dto.isPublic           !== undefined && { isPublic:           dto.isPublic }),
        ...(dto.note               !== undefined && { note:               dto.note }),
      },
    });
  }

  // ─── Toggle visibilité ────────────────────────────────────────────────────

  async toggleActive(id: string) {
    const template = await this.ensureExists(id);
    return this.prisma.customPlanTemplate.update({
      where: { id },
      data: { isActive: !template.isActive },
    });
  }

  // ─── Suppression ─────────────────────────────────────────────────────────

  async deleteTemplate(id: string) {
    await this.ensureExists(id);
    // Désactiver plutôt que supprimer pour préserver l'historique des abonnements
    await this.prisma.customPlanTemplate.update({
      where: { id },
      data: { isActive: false, isPublic: false },
    });
    return { deleted: true, id };
  }

  // ─── Liste publique (pour /billing/plans) ─────────────────────────────────

  async listPublicTemplates() {
    return this.prisma.customPlanTemplate.findMany({
      where: { isActive: true, isPublic: true },
      orderBy: [{ priceAriary: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true, name: true, description: true,
        priceAriary: true, durationDays: true, credits: true,
        maxPages: true, maxManagedPosts: true, maxReferenceImages: true,
      },
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async ensureExists(id: string) {
    const t = await this.prisma.customPlanTemplate.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Template introuvable.');
    return t;
  }

  private validateLimits(dto: Partial<CreateCustomPlanTemplateDto>) {
    if (dto.credits !== undefined && dto.credits <= 0) {
      throw new BadRequestException('Les crédits doivent être > 0.');
    }
    if (dto.priceAriary !== undefined && dto.priceAriary < 0) {
      throw new BadRequestException('Le prix ne peut pas être négatif.');
    }
  }
}
