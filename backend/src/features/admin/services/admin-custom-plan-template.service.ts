// src/features/admin/services/admin-custom-plan-config.service.ts
//
// REFACTOR: CustomPlanConfig est maintenant associé à un user UNIQUE.
// Remplace le concept de "template global" par une "config par user".
//
// Un admin crée une config custom pour un user spécifique.
// Cette config est visible dans /billing de ce user (si isVisible=true).
// L'user peut l'acheter via Papi (si isPurchasable=true) ou l'admin l'attribue manuellement.
//
// 1 user = au plus 1 CustomPlanConfig (relation @unique userId).

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import type {
  CreateCustomPlanConfigDto,
  UpdateCustomPlanConfigDto,
} from '../dto/admin-custom-plan-template.dto.js';

@Injectable()
export class AdminCustomPlanTemplateService {
  private readonly logger = new Logger(AdminCustomPlanTemplateService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Liste toutes les configs (vue admin) ────────────────────────────────

  async listTemplates(includeInvisible = false) {
    const configs = await this.prisma.customPlanConfig.findMany({
      where: includeInvisible ? undefined : { isVisible: true },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, username: true } },
      },
    });

    return configs.map((c) => ({
      id: c.id,
      userId: c.userId,
      userEmail: c.user.email,
      userName: c.user.username,
      name: c.name,
      description: c.description,
      priceAriary: c.priceAriary,
      durationDays: c.durationDays,
      credits: c.credits,
      maxPages: c.maxPages,
      maxManagedPosts: c.maxManagedPosts,
      maxReferenceImages: c.maxReferenceImages,
      isVisible: c.isVisible,
      isPurchasable: c.isPurchasable,
      createdByAdminId: c.createdByAdminId,
      note: c.note,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  }

  // ─── Récupère la config d'un user spécifique ─────────────────────────────

  async getConfigForUser(userId: string) {
    return this.prisma.customPlanConfig.findUnique({
      where: { userId },
    });
  }

  // ─── Crée ou remplace la config d'un user ────────────────────────────────

  async createTemplate(dto: CreateCustomPlanConfigDto, adminId: string) {
    this.validateLimits(dto);

    // Vérifie que le user existe
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, email: true },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');

    // Upsert : remplace si une config existe déjà pour ce user
    const config = await this.prisma.customPlanConfig.upsert({
      where: { userId: dto.userId },
      create: {
        userId: dto.userId,
        name: dto.name ?? 'Plan Custom',
        description: dto.description,
        priceAriary: dto.priceAriary,
        durationDays: dto.durationDays ?? 30,
        credits: dto.credits,
        maxPages: dto.maxPages,
        maxManagedPosts: dto.maxManagedPosts,
        maxReferenceImages: dto.maxReferenceImages,
        isVisible: dto.isVisible ?? true,
        isPurchasable: dto.isPurchasable ?? true,
        createdByAdminId: adminId,
        note: dto.note,
      },
      update: {
        name: dto.name ?? 'Plan Custom',
        description: dto.description,
        priceAriary: dto.priceAriary,
        durationDays: dto.durationDays ?? 30,
        credits: dto.credits,
        maxPages: dto.maxPages,
        maxManagedPosts: dto.maxManagedPosts,
        maxReferenceImages: dto.maxReferenceImages,
        isVisible: dto.isVisible ?? true,
        isPurchasable: dto.isPurchasable ?? true,
        note: dto.note,
      },
    });

    this.logger.log(
      `[CUSTOM_PLAN_UPSERTED] configId=${config.id} userId=${dto.userId} admin=${adminId}`,
    );

    return config;
  }

  // ─── Modifie partiellement une config ────────────────────────────────────

  async updateTemplate(id: string, dto: UpdateCustomPlanConfigDto) {
    const config = await this.prisma.customPlanConfig.findUnique({
      where: { id },
    });
    if (!config) throw new NotFoundException('Config introuvable.');
    if (dto.credits !== undefined)
      this.validateLimits({ credits: dto.credits, priceAriary: 0 });

    return this.prisma.customPlanConfig.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.priceAriary !== undefined && { priceAriary: dto.priceAriary }),
        ...(dto.durationDays !== undefined && {
          durationDays: dto.durationDays,
        }),
        ...(dto.credits !== undefined && { credits: dto.credits }),
        ...(dto.maxPages !== undefined && { maxPages: dto.maxPages }),
        ...(dto.maxManagedPosts !== undefined && {
          maxManagedPosts: dto.maxManagedPosts,
        }),
        ...(dto.maxReferenceImages !== undefined && {
          maxReferenceImages: dto.maxReferenceImages,
        }),
        ...(dto.isVisible !== undefined && { isVisible: dto.isVisible }),
        ...(dto.isPurchasable !== undefined && {
          isPurchasable: dto.isPurchasable,
        }),
        ...(dto.note !== undefined && { note: dto.note }),
      },
    });
  }

  // ─── Toggle visibilité ────────────────────────────────────────────────────

  async toggleActive(id: string) {
    const config = await this.prisma.customPlanConfig.findUnique({
      where: { id },
    });
    if (!config) throw new NotFoundException('Config introuvable.');
    return this.prisma.customPlanConfig.update({
      where: { id },
      data: { isVisible: !config.isVisible },
    });
  }

  // ─── Supprime la config d'un user ────────────────────────────────────────

  async deleteTemplate(id: string) {
    const config = await this.prisma.customPlanConfig.findUnique({
      where: { id },
    });
    if (!config) throw new NotFoundException('Config introuvable.');
    await this.prisma.customPlanConfig.delete({ where: { id } });
    return { deleted: true, userId: config.userId };
  }

  // ─── Pour /billing/custom-plan (côté user authentifié) ───────────────────
  // Retourne la config custom de CET user uniquement (si visible).

  async getConfigForCurrentUser(userId: string) {
    const config = await this.prisma.customPlanConfig.findUnique({
      where: { userId },
    });
    // Le user ne doit voir sa config que si elle est visible
    if (!config || !config.isVisible) return null;
    return config;
  }

  // ─── Méthode maintenue pour compatibilité avec BillingController ─────────
  async listPublicTemplates() {
    // Non utilisé dans la nouvelle architecture user-specific
    // Gardé pour ne pas casser BillingController
    return [];
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private validateLimits(dto: { credits: number; priceAriary: number }) {
    if (dto.credits <= 0)
      throw new BadRequestException('Crédits doit être > 0.');
    if (dto.priceAriary < 0)
      throw new BadRequestException('Prix ne peut pas être négatif.');
  }
}
