/**
 * @file features/billing/guards/credit.guard.ts
 *
 * Bloque les appels IA quand les crédits sont à 0.
 * Utiliser sur les controllers IA ou appeler CreditService.hasCredits()
 * directement dans les workers pg-boss.
 */

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.types.js';
import { CreditService } from '../services/credit.service.js';

@Injectable()
export class CreditGuard implements CanActivate {
  constructor(private readonly creditService: CreditService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req  = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = req.user;
    if (!user?.sub) return false;

    const hasCredits = await this.creditService.hasCredits(user.sub);
    if (!hasCredits) {
      throw new ForbiddenException(
        'Crédits IA épuisés. Votre compte a été repassé en plan Gratuit. ' +
        "Souscrivez à un abonnement pour continuer à utiliser l'IA.",
      );
    }
    return true;
  }
}
