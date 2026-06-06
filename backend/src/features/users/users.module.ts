/**
 * @file src/features/users/users.module.ts
 *
 * FIX: Added BillingModule import so CreditService can be injected
 * into UsersService.createUser() to initialize FREE credits on registration.
 *
 * forwardRef() protège contre la dépendance circulaire potentielle :
 *   UsersModule → BillingModule → (pas de retour vers UsersModule)
 *
 * Si BillingModule n'importe pas UsersModule, forwardRef n'est pas nécessaire
 * mais ne fait pas de mal non plus.
 */

import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module.js';
import { BillingModule } from '../billing/billing.module.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './services/users.service.js';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => BillingModule), // ← FIX: pour CreditService dans createUser()
  ],
  controllers: [UsersController],
  providers:   [UsersService],
  exports:     [UsersService],
})
export class UsersModule {}
