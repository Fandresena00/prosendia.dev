/**
 * @file features/billing/billing-admin.controller.ts
 *
 * Endpoints admin pour la maintenance et réparation des crédits.
 *
 * Routes :
 *   POST /billing/admin/repair-credits/:userId    → réparer les crédits d'un user
 *   POST /billing/admin/repair-credits/all        → réparer tous les users avec 0 crédit
 *   GET  /billing/admin/inconsistencies           → lister les comptes incohérents
 *
 * ⚠️  Protéger avec un guard admin en production.
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CreditService } from './services/credit.service.js';
import { BILLING_PLANS } from './billing.constants.js';

@UseGuards(JwtAuthGuard) // TODO: remplacer par AdminGuard en prod
@Controller('billing/admin')
export class BillingAdminController {
  private readonly logger = new Logger(BillingAdminController.name);

  constructor(
    private readonly creditService: CreditService,
    private readonly prisma:        PrismaService,
  ) {}

  /**
   * POST /billing/admin/repair-credits/:userId
   * Répare le solde d'un utilisateur spécifique.
   */
  @Post('repair-credits/:userId')
  @HttpCode(HttpStatus.OK)
  async repairOne(@Param('userId') userId: string) {
    const result = await this.creditService.repairBalance(userId);
    return {
      userId,
      ...result,
      fixed: result.before !== result.after,
    };
  }

  /**
   * POST /billing/admin/repair-credits/all
   * Répare tous les comptes avec un solde incohérent ou à 0.
   * Utile après déploiement du fix pour corriger les anciens comptes.
   */
  @Post('repair-credits/all')
  @HttpCode(HttpStatus.OK)
  async repairAll() {
    this.logger.log('[ADMIN] Starting bulk credit repair for all users with 0 balance');

    const usersWithZero = await this.prisma.user.findMany({
      where:  { creditBalance: 0 },
      select: { id: true, activePlan: true, email: true },
    });

    this.logger.log(`[ADMIN] Found ${usersWithZero.length} users with 0 credits`);

    const results: Array<{
      userId:  string;
      email:   string;
      plan:    string;
      action:  string;
      credits: number;
    }> = [];

    for (const user of usersWithZero) {
      try {
        // Vérifier s'il y a un abonnement actif
        const activeSub = await this.prisma.subscription.findFirst({
          where:   { userId: user.id, status: 'ACTIVE' },
          select:  { id: true, creditsGranted: true },
          orderBy: { createdAt: 'desc' },
        });

        if (activeSub && activeSub.creditsGranted > 0) {
          // Abonnement actif → juste attribuer les crédits manquants
          await this.creditService.grantCredits(
            user.id,
            activeSub.id,
            activeSub.creditsGranted,
            'Admin repair — subscription existed',
          );
          results.push({
            userId:  user.id,
            email:   user.email,
            plan:    user.activePlan,
            action:  'credits_granted_from_existing_sub',
            credits: activeSub.creditsGranted,
          });
        } else {
          // Aucun abonnement → initialiser FREE complet
          await this.creditService.initializeFreeUser(user.id);
          results.push({
            userId:  user.id,
            email:   user.email,
            plan:    user.activePlan,
            action:  'free_initialized',
            credits: BILLING_PLANS.FREE.credits,
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`[ADMIN] Failed to repair user=${user.id}: ${msg}`);
        results.push({
          userId:  user.id,
          email:   user.email,
          plan:    user.activePlan,
          action:  `error: ${msg}`,
          credits: 0,
        });
      }
    }

    const fixed  = results.filter((r) => !r.action.startsWith('error')).length;
    const errors = results.filter((r) =>  r.action.startsWith('error')).length;

    this.logger.log(
      `[ADMIN] Bulk repair complete — fixed: ${fixed}, errors: ${errors}`,
    );

    return {
      total:   usersWithZero.length,
      fixed,
      errors,
      results,
    };
  }

  /**
   * GET /billing/admin/inconsistencies
   * Liste les comptes dont le solde ne correspond pas au ledger.
   */
  @Get('inconsistencies')
  async findInconsistencies() {
    const users = await this.prisma.user.findMany({
      select: { id: true, email: true, creditBalance: true, activePlan: true },
    });

    const inconsistencies: Array<{
      userId:       string;
      email:        string;
      plan:         string;
      userBalance:  number;
      ledgerSum:    number;
      delta:        number;
    }> = [];

    for (const user of users) {
      const ledgerEntries = await this.prisma.creditLedger.findMany({
        where:  { userId: user.id },
        select: { amount: true },
      });

      const ledgerSum = ledgerEntries.reduce((s, e) => s + e.amount, 0);

      if (ledgerSum !== user.creditBalance) {
        inconsistencies.push({
          userId:      user.id,
          email:       user.email,
          plan:        user.activePlan,
          userBalance: user.creditBalance,
          ledgerSum,
          delta:       user.creditBalance - ledgerSum,
        });
      }
    }

    this.logger.log(
      `[ADMIN] Found ${inconsistencies.length} inconsistent accounts out of ${users.length}`,
    );

    return {
      total:            users.length,
      inconsistentCount: inconsistencies.length,
      inconsistencies,
    };
  }
}
