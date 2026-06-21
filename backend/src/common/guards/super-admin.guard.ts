// src/common/guards/super-admin.guard.ts

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthenticatedAdmin } from '../../features/admin/strategies/admin-jwt.strategy.js';

/**
 * À utiliser TOUJOURS après AdminJwtAuthGuard (qui peuple req.user).
 * Bloque tout accès si le rôle n'est pas SUPER_ADMIN.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedAdmin }>();
    if (req.user?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Action réservée au super administrateur.');
    }
    return true;
  }
}
