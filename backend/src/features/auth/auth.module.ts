/**
 * @file src/features/auth/auth.module.ts
 *
 * CHANGE: Ajout de GoogleStrategy + GoogleAuthGuard.
 * Fichier complet — remplace l'ancien auth.module.ts.
 */

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { GoogleAuthGuard } from '../../common/guards/google-auth.guard.js';
import { PrismaModule } from '../../database/prisma.module.js';
import { EmailModule } from '../email/email.module.js';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { EmailVerificationService } from './services/email-verification.service.js';
import { AuthService } from './services/auth.service.js';
import { TokenSessionService } from './services/token-session.service.js';
import { GoogleStrategy } from './strategies/google.strategy.js';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';

@Module({
  imports: [
    UsersModule,
    PrismaModule,
    EmailModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: () => ({
        signOptions: { issuer: 'vendeoai-api' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenSessionService,
    EmailVerificationService,
    // Strategies JWT
    JwtStrategy,
    JwtRefreshStrategy,
    // Strategy + Guard Google
    GoogleStrategy,
    GoogleAuthGuard,
  ],
  exports: [AuthService],
})
export class AuthModule {}
