/**
 * @file features/dashboard/services/dashboard-stats.service.ts
 *
 * Calcule toutes les statistiques du dashboard :
 *   - Abonnement & utilisation (crédits, pages, posts, images)
 *   - Stats IA (réponses aujourd'hui / ce mois, conversations, commentaires)
 *   - Taux de réponse (global, IA, humain, sans réponse)
 *   - Activité du jour
 *   - Graphique hebdomadaire (7 jours glissants)
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import { BILLING_PLANS } from '../../billing/billing.constants.js';
import { CreditService } from '../../billing/services/credit.service.js';
import type {
  ActivityTodayDto,
  AiStatsDto,
  DailyActivityDto,
  DashboardResponseDto,
  ResponseRateDto,
  SubscriptionUsageDto,
} from '../dto/dashboard.dto.js';

const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

@Injectable()
export class DashboardStatsService {
  private readonly logger = new Logger(DashboardStatsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly credits: CreditService,
  ) {}

  // ─── Main aggregator ─────────────────────────────────────────────────────

  async getDashboard(userId: string): Promise<DashboardResponseDto> {
    const [subscription, aiStats, responseRate, activityToday, weeklyChart] =
      await Promise.all([
        this.getSubscriptionUsage(userId),
        this.getAiStats(userId),
        this.getResponseRate(userId),
        this.getActivityToday(userId),
        this.getWeeklyChart(userId),
      ]);

    return {
      subscription,
      aiStats,
      responseRate,
      activityToday,
      weeklyChart,
      notifications: [], // rempli par DashboardController
      unreadCount: 0,
      criticalCount: 0,
      generatedAt: new Date(),
    };
  }

  // ─── Subscription usage ───────────────────────────────────────────────────

  async getSubscriptionUsage(userId: string): Promise<SubscriptionUsageDto> {
    const creditStatus = await this.credits.getCreditStatus(userId);

    const planConfig =
      BILLING_PLANS[creditStatus.plan as keyof typeof BILLING_PLANS];

    // Compter les pages actives
    const pagesUsed = await this.prisma.facebookConnection.count({
      where: { businessProfile: { userId }, isActive: true },
    });

    // Compter les posts gérés (ceux qui ont une PostAiConfig)
    const postsManaged = await this.prisma.facebookPost.count({
      where: {
        businessProfile: { userId },
        postAiConfig: { isNot: null },
      },
    });

    // Compter les images de référence
    const referenceImages = await this.prisma.chatResourceImage.count({
      where: { chatResource: { businessProfile: { userId }, isActive: true } },
    });

    // Abonnement actif
    const activeSub = await this.prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE' },
      select: { periodEnd: true },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    const periodEnd = activeSub?.periodEnd ?? null;
    const daysRemaining = periodEnd
      ? Math.max(
          0,
          Math.ceil((periodEnd.getTime() - now.getTime()) / 86_400_000),
        )
      : null;

    return {
      planName: creditStatus.planName,
      planId: creditStatus.plan,
      creditBalance: creditStatus.creditBalance,
      creditsGranted: creditStatus.creditsGranted,
      creditRemainingPct: creditStatus.remainingPercent,
      creditIsLow: creditStatus.isLow,
      creditIsCritical: creditStatus.isCritical,
      creditIsDepleted: creditStatus.isDepleted,
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

  // ─── AI stats ─────────────────────────────────────────────────────────────

  async getAiStats(userId: string): Promise<AiStatsDto> {
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
      conversationsHandled,
      commentsHandled,
    ] = await Promise.all([
      // Réponses IA dans l'inbox aujourd'hui
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

      // Conversations où l'IA a répondu au moins une fois
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
      conversationsHandled,
      commentsHandled,
    };
  }

  // ─── Response rate ────────────────────────────────────────────────────────

  async getResponseRate(userId: string): Promise<ResponseRateDto> {
    const profileIds = await this.getProfileIds(userId);

    const [totalConversations, aiHandled, humanHandled, unanswered] =
      await Promise.all([
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
            messages: { some: { sender: { in: ['PAGE', 'HUMAN'] as any } } },
            NOT: { messages: { some: { sender: 'AI' } } },
          },
        }),
        this.prisma.conversation.count({
          where: {
            businessProfileId: { in: profileIds },
            messages: {
              none: { sender: { in: ['AI', 'PAGE', 'HUMAN'] as any } },
            },
          },
        }),
      ]);

    const total = totalConversations || 1;
    const globalRate = Math.round(((aiHandled + humanHandled) / total) * 100);
    const aiRate = Math.round((aiHandled / total) * 100);
    const humanRate = Math.round((humanHandled / total) * 100);

    return { globalRate, aiRate, humanRate, unansweredCount: unanswered };
  }

  // ─── Activity today ───────────────────────────────────────────────────────

  async getActivityToday(userId: string): Promise<ActivityTodayDto> {
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

  // ─── Weekly chart (7 jours glissants) ────────────────────────────────────

  async getWeeklyChart(userId: string): Promise<DailyActivityDto[]> {
    const profileIds = await this.getProfileIds(userId);
    const result: DailyActivityDto[] = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const [messages, aiReplies, humanReplies, comments] = await Promise.all([
        this.prisma.message.count({
          where: {
            sender: 'CLIENT',
            createdAt: { gte: date, lt: nextDate },
            conversation: { businessProfileId: { in: profileIds } },
          },
        }),
        this.prisma.message.count({
          where: {
            sender: 'AI',
            createdAt: { gte: date, lt: nextDate },
            conversation: { businessProfileId: { in: profileIds } },
          },
        }),
        this.prisma.message.count({
          where: {
            sender: { in: ['PAGE', 'HUMAN'] as any },
            createdAt: { gte: date, lt: nextDate },
            conversation: { businessProfileId: { in: profileIds } },
          },
        }),
        this.prisma.postComment.count({
          where: {
            commentedAt: { gte: date, lt: nextDate },
            post: { businessProfileId: { in: profileIds } },
          },
        }),
      ]);

      result.push({
        date: date.toISOString().slice(0, 10),
        day: DAY_LABELS[date.getDay()],
        messages,
        aiReplies,
        humanReplies,
        comments,
      });
    }

    return result;
  }

  // ─── Helper ───────────────────────────────────────────────────────────────

  private async getProfileIds(userId: string): Promise<string[]> {
    const profiles = await this.prisma.businessProfile.findMany({
      where: { userId },
      select: { id: true },
    });
    return profiles.map((p) => p.id);
  }
}
