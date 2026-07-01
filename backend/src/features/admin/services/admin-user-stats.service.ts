// src/features/admin/services/admin-user-stats.service.ts
//
// Calcule les statistiques détaillées d'un utilisateur pour le panneau admin.
//
// INDÉPENDANCE : ce service n'importe RIEN depuis les features dashboard,
// billing ou notification. Il accède directement à Prisma et à BILLING_PLANS
// (constantes — pas de service externe).
//
// Calqué sur DashboardStatsService mais adapté au contexte admin :
//   - Prend un userId cible (pas l'utilisateur authentifié)
//   - Ajoute des métriques supplémentaires (totaux all-time, credit chart 30j)
//   - Aucune dépendance vers NotificationService, CreditService, InboxEventEmitter

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import {
  BILLING_PLANS,
  resolveCustomBillingPlan,
} from '../../billing/billing.constants.js';
import type {
  AdminUserActivityTodayDto,
  AdminUserAiStatsDto,
  AdminUserCreditDataPointDto,
  AdminUserDailyActivityDto,
  AdminUserResponseRateDto,
  AdminUserStatsResponseDto,
  AdminUserSubscriptionDto,
} from '../dto/admin-user-stats.dto.js';

const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

@Injectable()
export class AdminUserStatsService {
  private readonly logger = new Logger(AdminUserStatsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Agrégateur principal ─────────────────────────────────────────────────

  async getUserStats(targetUserId: string): Promise<AdminUserStatsResponseDto> {
    // Vérification existence de l'utilisateur
    const userExists = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });
    if (!userExists) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    const [
      subscription,
      aiStats,
      responseRate,
      activityToday,
      weeklyChart,
      creditChart,
    ] = await Promise.all([
      this.getSubscriptionStats(targetUserId),
      this.getAiStats(targetUserId),
      this.getResponseRate(targetUserId),
      this.getActivityToday(targetUserId),
      this.getWeeklyChart(targetUserId),
      this.getCreditChart(targetUserId),
    ]);

    this.logger.debug(
      `[ADMIN_USER_STATS] userId=${targetUserId} — stats generated`,
    );

    return {
      subscription,
      aiStats,
      responseRate,
      activityToday,
      weeklyChart,
      creditChart,
      generatedAt: new Date(),
    };
  }

  // ─── Abonnement & utilisation ─────────────────────────────────────────────

  private async getSubscriptionStats(
    userId: string,
  ): Promise<AdminUserSubscriptionDto> {
    // Récupérer l'utilisateur avec son plan et solde de crédits
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        activePlan: true,
        creditBalance: true,
        customPlanConfig: true,
      },
    });

    const planConfig =
      user.activePlan === 'CUSTOM' && user.customPlanConfig
        ? resolveCustomBillingPlan(user.customPlanConfig)
        : BILLING_PLANS[user.activePlan as keyof typeof BILLING_PLANS];
    const planName = planConfig?.name ?? user.activePlan;
    const activeSub = await this.prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE' },
      select: { periodEnd: true, creditsGranted: true },
      orderBy: { createdAt: 'desc' },
    });
    const creditsGranted = activeSub?.creditsGranted ?? planConfig?.credits ?? 0;

    // Calcul du pourcentage de crédits restants
    const creditRemainingPct =
      creditsGranted > 0
        ? Math.round((user.creditBalance / creditsGranted) * 100)
        : 0;

    const periodEnd = activeSub?.periodEnd ?? null;
    const daysRemaining = periodEnd
      ? Math.max(
          0,
          Math.ceil((periodEnd.getTime() - Date.now()) / 86_400_000),
        )
      : null;

    // Récupérer les IDs de profils une seule fois
    const profileIds = await this.getProfileIds(userId);

    // Pages actives, posts gérés, images de référence
    const [pagesUsed, postsManaged, referenceImages] = await Promise.all([
      this.prisma.facebookConnection.count({
        where: {
          businessProfile: { userId },
          isActive: true,
        },
      }),
      this.prisma.facebookPost.count({
        where: {
          businessProfileId: { in: profileIds },
          postAiConfig: { isNot: null },
        },
      }),
      this.prisma.chatResourceImage.count({
        where: {
          chatResource: {
            businessProfile: { userId },
            isActive: true,
          },
        },
      }),
    ]);

    return {
      planId: user.activePlan,
      planName,
      creditBalance: user.creditBalance,
      creditsGranted: activeSub?.creditsGranted ?? creditsGranted ?? 0,
      creditRemainingPct,
      periodEnd,
      daysRemaining,
      pagesUsed,
      pagesLimit: planConfig?.maxPages ?? null,
      postsManaged,
      postsLimit: planConfig?.maxManagedPosts ?? null,
      referenceImages,
      imagesLimit: planConfig?.maxReferenceImages ?? null,
    };
  }

  // ─── Stats IA ─────────────────────────────────────────────────────────────

  private async getAiStats(userId: string): Promise<AdminUserAiStatsDto> {
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const profileIds = await this.getProfileIds(userId);

    const [
      repliesToday,
      repliesThisMonth,
      repliesTotal,
      conversationsHandled,
      commentsHandled,
    ] = await Promise.all([
      // Réponses IA aujourd'hui
      this.prisma.message.count({
        where: {
          sender: 'AI',
          createdAt: { gte: startOfDay },
          conversation: { businessProfileId: { in: profileIds } },
        },
      }),

      // Réponses IA ce mois
      this.prisma.message.count({
        where: {
          sender: 'AI',
          createdAt: { gte: startOfMonth },
          conversation: { businessProfileId: { in: profileIds } },
        },
      }),

      // Réponses IA all-time (métrique supplémentaire vs dashboard user)
      this.prisma.message.count({
        where: {
          sender: 'AI',
          conversation: { businessProfileId: { in: profileIds } },
        },
      }),

      // Conversations où l'IA est intervenue au moins une fois
      this.prisma.conversation.count({
        where: {
          businessProfileId: { in: profileIds },
          messages: { some: { sender: 'AI' } },
        },
      }),

      // Commentaires traités par l'IA
      this.prisma.postComment.count({
        where: {
          repliedByAi: true,
          post: { businessProfileId: { in: profileIds } },
        },
      }),
    ]);

    return {
      repliesToday,
      repliesThisMonth,
      repliesTotal,
      conversationsHandled,
      commentsHandled,
    };
  }

  // ─── Taux de réponse ──────────────────────────────────────────────────────

  private async getResponseRate(
    userId: string,
  ): Promise<AdminUserResponseRateDto> {
    const profileIds = await this.getProfileIds(userId);

    const [
      totalConversations,
      aiHandled,
      humanHandled,
      unanswered,
    ] = await Promise.all([
      this.prisma.conversation.count({
        where: { businessProfileId: { in: profileIds } },
      }),
      this.prisma.conversation.count({
        where: {
          businessProfileId: { in: profileIds },
          messages: { some: { sender: 'AI' } },
        },
      }),
      this.prisma.conversation.count({
        where: {
          businessProfileId: { in: profileIds },
          messages: { some: { sender: 'PAGE' } },
          NOT: { messages: { some: { sender: 'AI' } } },
        },
      }),
      this.prisma.conversation.count({
        where: {
          businessProfileId: { in: profileIds },
          messages: { none: { sender: { in: ['AI', 'PAGE'] } } },
        },
      }),
    ]);

    const total = totalConversations || 1; // éviter division par 0
    const globalRate = Math.round(((aiHandled + humanHandled) / total) * 100);
    const aiRate     = Math.round((aiHandled / total) * 100);
    const humanRate  = Math.round((humanHandled / total) * 100);

    return {
      totalConversations,
      globalRate,
      aiRate,
      humanRate,
      unansweredCount: unanswered,
    };
  }

  // ─── Activité du jour ─────────────────────────────────────────────────────

  private async getActivityToday(
    userId: string,
  ): Promise<AdminUserActivityTodayDto> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const profileIds = await this.getProfileIds(userId);

    const [
      messagesReceived,
      commentsReceived,
      aiRepliesSent,
      humanInterventions,
    ] = await Promise.all([
      this.prisma.message.count({
        where: {
          sender: 'CLIENT',
          createdAt: { gte: startOfDay },
          conversation: { businessProfileId: { in: profileIds } },
        },
      }),
      this.prisma.postComment.count({
        where: {
          commentedAt: { gte: startOfDay },
          post: { businessProfileId: { in: profileIds } },
        },
      }),
      this.prisma.message.count({
        where: {
          sender: 'AI',
          createdAt: { gte: startOfDay },
          conversation: { businessProfileId: { in: profileIds } },
        },
      }),
      this.prisma.conversation.count({
        where: {
          businessProfileId: { in: profileIds },
          humanTookOverAt: { gte: startOfDay },
        },
      }),
    ]);

    return {
      messagesReceived,
      commentsReceived,
      aiRepliesSent,
      humanInterventions,
    };
  }

  // ─── Graphique 7 jours (même logique que DashboardStatsService) ───────────

  private async getWeeklyChart(
    userId: string,
  ): Promise<AdminUserDailyActivityDto[]> {
    const profileIds = await this.getProfileIds(userId);
    const result: AdminUserDailyActivityDto[] = [];

    for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
      const dayStart = new Date();
      dayStart.setDate(dayStart.getDate() - daysAgo);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const [messages, aiReplies, humanReplies, comments] = await Promise.all([
        this.prisma.message.count({
          where: {
            sender: 'CLIENT',
            createdAt: { gte: dayStart, lt: dayEnd },
            conversation: { businessProfileId: { in: profileIds } },
          },
        }),
        this.prisma.message.count({
          where: {
            sender: 'AI',
            createdAt: { gte: dayStart, lt: dayEnd },
            conversation: { businessProfileId: { in: profileIds } },
          },
        }),
        this.prisma.message.count({
          where: {
            sender: 'PAGE',
            createdAt: { gte: dayStart, lt: dayEnd },
            conversation: { businessProfileId: { in: profileIds } },
          },
        }),
        this.prisma.postComment.count({
          where: {
            commentedAt: { gte: dayStart, lt: dayEnd },
            post: { businessProfileId: { in: profileIds } },
          },
        }),
      ]);

      result.push({
        date: dayStart.toISOString().slice(0, 10),
        day:  DAY_LABELS[dayStart.getDay()],
        messages,
        aiReplies,
        humanReplies,
        comments,
      });
    }

    return result;
  }

  // ─── Graphique crédits 30 jours (spécifique admin) ───────────────────────
  //
  // Reconstitue la consommation de crédits jour par jour à partir des
  // entrées CreditLedger de type négatif (consommation IA).

  private async getCreditChart(
    userId: string,
  ): Promise<AdminUserCreditDataPointDto[]> {
    const profileIds = await this.getProfileIds(userId);
    const result: AdminUserCreditDataPointDto[] = [];

    for (let daysAgo = 29; daysAgo >= 0; daysAgo--) {
      const dayStart = new Date();
      dayStart.setDate(dayStart.getDate() - daysAgo);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      // Crédits consommés = somme des montants négatifs dans CreditLedger
      // (les montants sont stockés en positif mais représentent des débits
      //  quand le type est AI_REPLY, COMMENT_REPLY, etc.)
      const [ledgerAgg, aiRepliesCount] = await Promise.all([
        this.prisma.creditLedger.aggregate({
          where: {
            userId,
            createdAt: { gte: dayStart, lt: dayEnd },
            amount: { lt: 0 }, // débits uniquement
          },
          _sum: { amount: true },
        }),
        this.prisma.message.count({
          where: {
            sender: 'AI',
            createdAt: { gte: dayStart, lt: dayEnd },
            conversation: { businessProfileId: { in: profileIds } },
          },
        }),
      ]);

      // La somme des débits est négative — on la convertit en positif
      const consumed = Math.abs(ledgerAgg._sum.amount ?? 0);

      result.push({
        date:            dayStart.toISOString().slice(0, 10),
        day:             DAY_LABELS[dayStart.getDay()],
        creditsConsumed: consumed,
        aiReplies:       aiRepliesCount,
      });
    }

    return result;
  }

  // ─── Helper partagé ───────────────────────────────────────────────────────

  private async getProfileIds(userId: string): Promise<string[]> {
    const profiles = await this.prisma.businessProfile.findMany({
      where: { userId },
      select: { id: true },
    });
    return profiles.map((p) => p.id);
  }
}
