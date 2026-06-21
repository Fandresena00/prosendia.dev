// src/features/admin/services/admin-management.service.ts

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import bcrypt from 'bcrypt';
import { PrismaService } from '../../../database/prisma.service.js';
import { CreateAdminDto } from '../dto/admin-management.dto.js';

const PASSWORD_HASH_ROUNDS = 12;

@Injectable()
export class AdminManagementService {
  constructor(private readonly prisma: PrismaService) {}

  async listAdmins() {
    const admins = await this.prisma.admin.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    return admins;
  }

  /**
   * Crée un admin ADMIN (jamais SUPER_ADMIN — un seul super admin existe,
   * créé exclusivement via le script de seed).
   */
  async createAdmin(dto: CreateAdminDto, actingAdminId: string) {
    const existing = await this.prisma.admin.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException(
        'Un administrateur avec cet email existe déjà.',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, PASSWORD_HASH_ROUNDS);

    const admin = await this.prisma.admin.create({
      data: {
        email: dto.email,
        passwordHash,
        role: 'ADMIN', // forcé — jamais SUPER_ADMIN via cet endpoint
      },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    await this.prisma.adminAuditLog.create({
      data: {
        adminId: actingAdminId,
        action: 'CREATE_ADMIN',
        targetType: 'ADMIN',
        targetId: admin.id,
        metadata: { email: admin.email },
      },
    });

    return admin;
  }

  /**
   * Supprime un admin.
   * Protections :
   *   - Impossible de supprimer un SUPER_ADMIN.
   *   - Impossible de se supprimer soi-même (évite de se locker dehors).
   */
  async deleteAdmin(targetId: string, actingAdminId: string) {
    if (targetId === actingAdminId) {
      throw new BadRequestException(
        'Vous ne pouvez pas supprimer votre propre compte.',
      );
    }

    const target = await this.prisma.admin.findUnique({
      where: { id: targetId },
    });
    if (!target) {
      throw new NotFoundException('Administrateur introuvable.');
    }

    if (target.role === 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'Le super administrateur ne peut pas être supprimé.',
      );
    }

    await this.prisma.admin.delete({ where: { id: targetId } });

    await this.prisma.adminAuditLog.create({
      data: {
        adminId: actingAdminId,
        action: 'DELETE_ADMIN',
        targetType: 'ADMIN',
        targetId,
        metadata: { email: target.email },
      },
    });

    return { deleted: true };
  }

  async toggleActive(
    targetId: string,
    isActive: boolean,
    actingAdminId: string,
  ) {
    const target = await this.prisma.admin.findUnique({
      where: { id: targetId },
    });
    if (!target) throw new NotFoundException('Administrateur introuvable.');
    if (target.role === 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'Le super administrateur ne peut pas être désactivé.',
      );
    }

    return this.prisma.admin.update({
      where: { id: targetId },
      data: { isActive },
      select: { id: true, email: true, role: true, isActive: true },
    });
  }
}
