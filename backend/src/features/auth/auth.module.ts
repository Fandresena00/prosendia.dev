/**
 * @file src/features/auth/auth.module.ts
 * CHANGE: Added EmailModule + EmailVerificationService.
 */

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../../database/prisma.module.js';
import { EmailModule } from '../email/email.module.js';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { EmailVerificationService } from './services/email-verification.service.js';
import { TokenSessionService } from './services/token-session.service.js';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { AuthService } from './services/auth.service.js';

@Module({
  imports: [
    UsersModule,
    PrismaModule,
    EmailModule,   // ← NEW: provides EmailService
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: () => ({ signOptions: { issuer: 'vendeoai-api' } }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenSessionService,
    EmailVerificationService,  // ← NEW
    JwtStrategy,
    JwtRefreshStrategy,
  ],
  exports: [AuthService],
})
export class AuthModule {}
