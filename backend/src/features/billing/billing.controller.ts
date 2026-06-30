/**
 * @file features/billing/billing.controller.ts
 *
 * CHANGE: GET /billing/custom-plan (singulier) retourne la config custom
 * propre à CET utilisateur authentifié (pas une liste globale).
 * Retourne null si l'user n'a pas de config custom visible.
 */

import {
  Body, Controller, Get,
  HttpCode, HttpStatus, Post, Query, UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.types.js';
import { AdminCustomPlanTemplateService } from '../admin/services/admin-custom-plan-template.service.js';
import { InitiatePaymentDto } from './dto/billing.dto.js';
import { BillingService } from './services/billing.service.js';
import { CreditService } from './services/credit.service.js';
import { SubscriptionService } from './services/subscription.service.js';

@UseGuards(JwtAuthGuard)
@Controller('billing')
export class BillingController {
  constructor(
    private readonly billing:           BillingService,
    private readonly credits:           CreditService,
    private readonly subscription:      SubscriptionService,
    private readonly customPlanService: AdminCustomPlanTemplateService,
  ) {}

  @Get('plans')
  getPlans() {
    return this.billing.getPlans();
  }

  /**
   * GET /billing/custom-plan
   * Retourne la config custom de CET user (null si aucune).
   * L'user ne voit que sa propre config — jamais celle d'un autre.
   */
  @Get('custom-plan')
  getMyCustomPlan(@CurrentUser() user: AuthenticatedUser) {
    return this.customPlanService.getConfigForCurrentUser(user.sub);
  }

  @Get('status')
  getCreditStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.billing.getCreditStatus(user.sub);
  }

  @Get('subscription')
  getSubscription(@CurrentUser() user: AuthenticatedUser) {
    return this.subscription.getActiveSubscription(user.sub);
  }

  @Post('payments/initiate')
  @HttpCode(HttpStatus.CREATED)
  initiatePayment(
    @Body() dto: InitiatePaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.billing.initiatePayment(user.sub, dto);
  }

  @Get('payments/history')
  getPaymentHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
  ) {
    return this.billing.getPaymentHistory(user.sub, +page, +pageSize);
  }

  @Get('credits/history')
  getCreditHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
  ) {
    return this.credits.getLedgerHistory(user.sub, +page, +pageSize);
  }
}
