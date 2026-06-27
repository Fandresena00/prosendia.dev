// src/features/admin/services/admin-users.service.ts
//
// CHANGE: audit logs enrichis avec previousBalance/previousPlan pour
// permettre l'affichage "avant → après" dans la page des logs.

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import { Prisma } from '../../../generated/prisma/client.js';
import { CreditService } from '../../billing/services/credit.service.js';
import {
  AdjustCreditsDto,
  AdminListUsersQueryDto,
  ChangeUserPlanDto,
  SuspendUserDto,
} from '../dto/admin-users.dto.js';

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credits: CreditService,
  ) {}

  // ─── Liste ────────────────────────────────────────────────────────────────

  async list(query: AdminListUsersQueryDto) {
    const { page = 1, pageSize = 20, search, plan, suspended } = query;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {
      ...(plan ? { activePlan: plan } : {}),
      ...(suspended !== undefined ? { isSuspended: suspended } : {}),
      ...(search?.trim() ? {
        OR: [
          { email:    { contains: search, mode: 'insensitive' } },
          { username: { contains: search, mode: 'insensitive' } },
        ],
      } : {}),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true, email: true, username: true,
          activePlan: true, creditBalance: true,
          isSuspended: true, emailVerified: true, createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  // ─── Détail ───────────────────────────────────────────────────────────────

  async getDetail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, username: true, activePlan: true,
        creditBalance: true, isSuspended: true, suspendedAt: true,
        suspendedReason: true, emailVerified: true, provider: true,
        createdAt: true, updatedAt: true,
      },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');

    const [activeSub, businessProfiles, recentLedger, recentPayments] =
      await Promise.all([
        this.prisma.subscription.findFirst({
          where: { userId, status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.businessProfile.findMany({
          where: { userId },
          select: { id: true, name: true, businessType: true },
        }),
        this.prisma.creditLedger.findMany({
          where: { userId }, orderBy: { createdAt: 'desc' }, take: 20,
        }),
        this.prisma.payment.findMany({
          where: { userId }, orderBy: { createdAt: 'desc' }, take: 10,
        }),
      ]);

    const profileIds = businessProfiles.map((p) => p.id);
    const [aiRepliesTotal, postsManaged, conversationsTotal] = await Promise.all([
      this.prisma.message.count({
        where: { sender: 'AI', conversation: { businessProfileId: { in: profileIds } } },
      }),
      this.prisma.facebookPost.count({
        where: { businessProfileId: { in: profileIds }, postAiConfig: { isNot: null } },
      }),
      this.prisma.conversation.count({
        where: { businessProfileId: { in: profileIds } },
      }),
    ]);

    return {
      user, subscription: activeSub, businessProfiles,
      usage: { aiRepliesTotal, postsManaged, conversationsTotal },
      recentLedger, recentPayments,
    };
  }

  // ─── Suspension ───────────────────────────────────────────────────────────

  async suspend(userId: string, dto: SuspendUserDto, adminId: string) {
    const user = await this.ensureUserExists(userId);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        isSuspended: true,
        suspendedAt: new Date(),
        suspendedReason: dto.reason ?? null,
      },
    });
    await this.audit(adminId, 'SUSPEND_USER', userId, {
      previousState: { isSuspended: user.isSuspended },
      reason: dto.reason,
    });
    return updated;
  }

  async reactivate(userId: string, adminId: string) {
    await this.ensureUserExists(userId);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { isSuspended: false, suspendedAt: null, suspendedReason: null },
    });
    await this.audit(adminId, 'REACTIVATE_USER', userId, {
      previousState: { isSuspended: true },
      newState:      { isSuspended: false },
    });
    return updated;
  }

  async delete(userId: string, adminId: string) {
    const user = await this.ensureUserExists(userId);
    await this.prisma.user.delete({ where: { id: userId } });
    await this.audit(adminId, 'DELETE_USER', userId, {
      email:       user.email,
      activePlan:  user.activePlan,
    });
    return { deleted: true };
  }

  // ─── Plan ─────────────────────────────────────────────────────────────────

  async changePlan(userId: string, dto: ChangeUserPlanDto, adminId: string) {
    const user = await this.ensureUserExists(userId);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { activePlan: dto.plan },
    });
    await this.audit(adminId, 'CHANGE_PLAN', userId, {
      previousPlan: user.activePlan,
      plan:         dto.plan,
    });
    return updated;
  }

  // ─── Crédits ──────────────────────────────────────────────────────────────

  async adjustCredits(userId: string, dto: AdjustCreditsDto, adminId: string) {
    await this.ensureUserExists(userId);

    const result = await this.credits.adminAdjustCredits(
      userId, dto.amount, dto.reason,
    );

    await this.audit(
      adminId,
      dto.amount > 0 ? 'ADD_CREDITS' : 'REMOVE_CREDITS',
      userId,
      {
        amount:          dto.amount,
        applied:         result.applied,
        reason:          dto.reason,
        previousBalance: result.previousBalance,
        newBalance:      result.newBalance,
      },
    );

    return result;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async ensureUserExists(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, activePlan: true, isSuspended: true, creditBalance: true },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');
    return user;
  }

  private async audit(
    adminId:    string,
    action:     string,
    targetId:   string,
    metadata:   Prisma.InputJsonValue,
  ) {
    await this.prisma.adminAuditLog.create({
      data: {
        adminId,
        action,
        targetType: 'USER',
        targetId,
        metadata,
      },
    });
  }
}
