// src/features/admin/services/admin-dashboard-charts.service.ts
//
// Génère les données de graphiques du dashboard admin global.
// Données réelles — aucune valeur fictive.
// Trois périodes supportées : 7d | 30d | 90d

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';

export type ChartPeriod = '7d' | '30d' | '90d';

export interface ChartDataPoint {
  date: string;   // "YYYY-MM-DD"
  label: string;  // "Lun", "01 Jan", etc.
  value: number;
}

export interface PlanDistribution {
  plan: string;
  count: number;
  pct: number;
}

export interface AdminDashboardChartsResponse {
  newUsers: ChartDataPoint[];
  revenue: ChartDataPoint[];
  creditConsumption: ChartDataPoint[];
  planDistribution: PlanDistribution[];
  period: ChartPeriod;
  generatedAt: Date;
}

const DAY_LABELS_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MONTH_LABELS_SHORT = [
  'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun',
  'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc',
];

function dayLabel(date: Date, period: ChartPeriod): string {
  if (period === '7d') return DAY_LABELS_SHORT[date.getDay()];
  return `${String(date.getDate()).padStart(2, '0')} ${MONTH_LABELS_SHORT[date.getMonth()]}`;
}

@Injectable()
export class AdminDashboardChartsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCharts(period: ChartPeriod): Promise<AdminDashboardChartsResponse> {
    const daysCount = period === '7d' ? 7 : period === '30d' ? 30 : 90;

    const [newUsers, revenue, creditConsumption, planDistribution] =
      await Promise.all([
        this.getNewUsersChart(daysCount, period),
        this.getRevenueChart(daysCount, period),
        this.getCreditConsumptionChart(daysCount, period),
        this.getPlanDistribution(),
      ]);

    return {
      newUsers,
      revenue,
      creditConsumption,
      planDistribution,
      period,
      generatedAt: new Date(),
    };
  }

  // ─── Nouveaux utilisateurs par jour ──────────────────────────────────────

  private async getNewUsersChart(
    daysCount: number,
    period: ChartPeriod,
  ): Promise<ChartDataPoint[]> {
    const result: ChartDataPoint[] = [];

    for (let daysAgo = daysCount - 1; daysAgo >= 0; daysAgo--) {
      const dayStart = new Date();
      dayStart.setDate(dayStart.getDate() - daysAgo);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const count = await this.prisma.user.count({
        where: { createdAt: { gte: dayStart, lt: dayEnd } },
      });

      result.push({
        date: dayStart.toISOString().slice(0, 10),
        label: dayLabel(dayStart, period),
        value: count,
      });
    }

    return result;
  }

  // ─── Revenus par jour (paiements SUCCESS) ─────────────────────────────────

  private async getRevenueChart(
    daysCount: number,
    period: ChartPeriod,
  ): Promise<ChartDataPoint[]> {
    const result: ChartDataPoint[] = [];

    for (let daysAgo = daysCount - 1; daysAgo >= 0; daysAgo--) {
      const dayStart = new Date();
      dayStart.setDate(dayStart.getDate() - daysAgo);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const agg = await this.prisma.payment.aggregate({
        where: {
          status: 'SUCCESS',
          createdAt: { gte: dayStart, lt: dayEnd },
        },
        _sum: { amount: true },
      });

      result.push({
        date: dayStart.toISOString().slice(0, 10),
        label: dayLabel(dayStart, period),
        value: agg._sum.amount ?? 0,
      });
    }

    return result;
  }

  // ─── Consommation de crédits par jour ────────────────────────────────────

  private async getCreditConsumptionChart(
    daysCount: number,
    period: ChartPeriod,
  ): Promise<ChartDataPoint[]> {
    const result: ChartDataPoint[] = [];

    for (let daysAgo = daysCount - 1; daysAgo >= 0; daysAgo--) {
      const dayStart = new Date();
      dayStart.setDate(dayStart.getDate() - daysAgo);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const agg = await this.prisma.creditLedger.aggregate({
        where: {
          createdAt: { gte: dayStart, lt: dayEnd },
          amount: { lt: 0 }, // débits uniquement
        },
        _sum: { amount: true },
      });

      result.push({
        date: dayStart.toISOString().slice(0, 10),
        label: dayLabel(dayStart, period),
        value: Math.abs(agg._sum.amount ?? 0),
      });
    }

    return result;
  }

  // ─── Distribution des plans ───────────────────────────────────────────────

  private async getPlanDistribution(): Promise<PlanDistribution[]> {
    const groups = await this.prisma.user.groupBy({
      by: ['activePlan'],
      _count: { activePlan: true },
    });

    const total = groups.reduce((sum, g) => sum + g._count.activePlan, 0) || 1;

    return groups
      .map((g) => ({
        plan: g.activePlan,
        count: g._count.activePlan,
        pct: Math.round((g._count.activePlan / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }
}
