// src/features/admin/services/admin-logs.service.ts
//
// Fournit les logs d'audit avec filtrabilité complète.
// Rétention : 3 mois max — cron hebdomadaire de nettoyage.

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../database/prisma.service.js';

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

    const where: Record<string, unknown> = {};
    if (adminId)    where.adminId    = adminId;
    if (action)     where.action     = action;
    if (targetType) where.targetType = targetType;
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to   ? { lte: new Date(to)   } : {}),
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
        id:          log.id,
        adminId:     log.adminId,
        adminEmail:  log.admin?.email ?? 'Inconnu',
        action:      log.action,
        targetType:  log.targetType,
        targetId:    log.targetId,
        metadata:    log.metadata,
        createdAt:   log.createdAt,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  // ─── Liste des admins distincts pour le filtre ────────────────────────────

  async getDistinctAdmins() {
    const logs = await this.prisma.adminAuditLog.findMany({
      distinct: ['adminId'],
      select: {
        adminId: true,
        admin:   { select: { email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return logs.map((l) => ({
      id:    l.adminId,
      email: l.admin?.email ?? 'Inconnu',
    }));
  }

  // ─── Nettoyage automatique (cron dimanche 03:00) ──────────────────────────
  // Supprime les logs de plus de 3 mois (90 jours)

  @Cron('0 3 * * 0')
  async cleanOldLogs(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);

    this.logger.log(
      `[AUDIT_LOG_CLEANUP] Deleting logs older than ${cutoff.toISOString()}`,
    );

    try {
      const result = await this.prisma.adminAuditLog.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });

      this.logger.log(
        `[AUDIT_LOG_CLEANUP] Deleted ${result.count} logs`,
      );
    } catch (err: unknown) {
      this.logger.error(
        `[AUDIT_LOG_CLEANUP_ERROR] ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
