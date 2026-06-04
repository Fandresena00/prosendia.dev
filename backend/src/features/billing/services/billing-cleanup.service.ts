/**
 * @file features/billing/services/billing-cleanup.service.ts
 *
 * Supprime les transactions de paiement de plus de 3 ans.
 * Tourne chaque dimanche à 04:00.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../database/prisma.service.js';
import { PAYMENT_RETENTION_YEARS } from '../billing.constants.js';

@Injectable()
export class BillingCleanupService {
  private readonly logger = new Logger(BillingCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 4 * * 0')
  async cleanOldTransactions(): Promise<void> {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - PAYMENT_RETENTION_YEARS);

    this.logger.log(`Billing cleanup: removing records before ${cutoff.toISOString()}`);

    try {
      const [payments, ledger, subs] = await Promise.all([
        this.prisma.payment.deleteMany({
          where: {
            createdAt: { lt: cutoff },
            status:    { in: ['SUCCESS', 'FAILED', 'REFUNDED'] },
          },
        }),
        this.prisma.creditLedger.deleteMany({
          where: { createdAt: { lt: cutoff } },
        }),
        this.prisma.subscription.deleteMany({
          where: {
            createdAt: { lt: cutoff },
            status:    { in: ['EXPIRED', 'CANCELLED'] },
          },
        }),
      ]);

      this.logger.log(
        `Cleanup done — payments: ${payments.count}, ledger: ${ledger.count}, subs: ${subs.count}`,
      );
    } catch (err: unknown) {
      this.logger.error(`Cleanup failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async runNow(): Promise<{ paymentsDeleted: number; ledgerDeleted: number; subsDeleted: number }> {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - PAYMENT_RETENTION_YEARS);

    const [p, l, s] = await Promise.all([
      this.prisma.payment.deleteMany({
        where: { createdAt: { lt: cutoff }, status: { in: ['SUCCESS', 'FAILED', 'REFUNDED'] } },
      }),
      this.prisma.creditLedger.deleteMany({ where: { createdAt: { lt: cutoff } } }),
      this.prisma.subscription.deleteMany({
        where: { createdAt: { lt: cutoff }, status: { in: ['EXPIRED', 'CANCELLED'] } },
      }),
    ]);

    return { paymentsDeleted: p.count, ledgerDeleted: l.count, subsDeleted: s.count };
  }
}
