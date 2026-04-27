/**
 * @file src/features/auth/auth.module.ts
 * @description Auth feature module.
 *
 * JwtModule is registered with no global default secret — each jwtService.sign()
 * call in AuthService passes its own secret explicitly. This prevents the access
 * token secret from being accidentally reused for refresh token signing.
 */

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../../database/prisma.module.js';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { TokenSessionService } from './services/token-session.service.js';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { AuthService } from './services/auth.service.js';

@Module({
  imports: [
    // UsersModule exports UsersService, which both strategies and AuthService need
    UsersModule,
    // PrismaModule exports PrismaService, needed by AuthService for refresh token storage
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // No global secret — AuthService calls sign() with explicit secrets per token type
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
    // Access token strategy  — validates Bearer tokens on protected routes
    JwtStrategy,
    // Refresh token strategy — validates Bearer tokens on /refresh and /logout only
    JwtRefreshStrategy,
  ],
  exports: [AuthService],
})
export class AuthModule {}
