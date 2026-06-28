// src/features/admin/services/admin-logs.service.ts
//
// Fix TS:
//   1. Utiliser Prisma.AdminAuditLogWhereInput au lieu de Parameters<...>['where']
//   2. action est un enum — le filtre passe par `any` pour éviter l'erreur de type
//      (la valeur vient du querystring, validée côté client)

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../database/prisma.service.js';
import { Prisma } from '../../../generated/prisma/client.js';

export interface AdminLogsQuery {
  page?: number;
  pageSize?: number;
  adminId?: string;
  action?: string;
  targetType?: string;
  from?: string;
  to?: string;
}

@Injectable()
export class AdminLogsService {
  private readonly logger = new Logger(AdminLogsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Liste paginée avec filtres ───────────────────────────────────────────

  async getLogs(query: AdminLogsQuery) {
    const {
      page = 1,
      pageSize = 30,
      adminId,
      action,
      targetType,
      from,
      to,
    } = query;

    const skip = (page - 1) * pageSize;

    // Construire le where avec le type Prisma correct
    const where: Prisma.AdminAuditLogWhereInput = {};
    if (adminId) where.adminId = adminId;
    if (targetType) where.targetType = targetType;
    if (action) {
      // action est un enum Prisma — on caste via `as any` car la valeur
      // vient du querystring et correspond à une valeur d'AdminAuditAction
      where.action = action as Prisma.EnumAdminAuditActionFilter | undefined;
    }
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      };
    }

    const [logs, total] = await Promise.all([
      this.prisma.adminAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          admin: { select: { email: true } },
        },
      }),
      this.prisma.adminAuditLog.count({ where }),
    ]);

    return {
      data: logs.map((log) => ({
        id: log.id,
        adminId: log.adminId,
        adminEmail: log.admin?.email ?? 'Inconnu',
        action: log.action as string,
        targetType: log.targetType,
        targetId: log.targetId ?? null,
        metadata: (log.metadata as Record<string, unknown>) ?? {},
        createdAt: log.createdAt,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  // ─── Admins distincts pour le filtre ─────────────────────────────────────

  async getDistinctAdmins() {
    const logs = await this.prisma.adminAuditLog.findMany({
      distinct: ['adminId'],
      select: {
        adminId: true,
        admin: { select: { email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return logs.map((l) => ({
      id: l.adminId,
      email: l.admin?.email ?? 'Inconnu',
    }));
  }

  // ─── Nettoyage automatique : logs > 90 jours (dimanche 03:00) ────────────

  @Cron('0 3 * * 0')
  async cleanOldLogs(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);

    this.logger.log(
      `[AUDIT_LOG_CLEANUP] Suppression des logs antérieurs au ${cutoff.toISOString()}`,
    );

    try {
      const result = await this.prisma.adminAuditLog.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });
      this.logger.log(`[AUDIT_LOG_CLEANUP] ${result.count} logs supprimés`);
    } catch (err: unknown) {
      this.logger.error(
        `[AUDIT_LOG_CLEANUP_ERROR] ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
