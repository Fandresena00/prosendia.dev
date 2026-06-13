/**
 * @file src/features/auth/strategies/google.strategy.ts
 * @description Passport strategy for Google OAuth 2.0.
 *
 * Install:
 *   pnpm add passport-google-oauth20
 *   pnpm add -D @types/passport-google-oauth20
 *
 * Flow:
 *   1. GET /auth/google           → Passport redirige vers Google consent screen
 *   2. Google callback            → GET /auth/google/callback
 *   3. validate() s'exécute       → findOrCreateOAuthUser() → UserResponseDto
 *   4. AuthController.googleCallback() → loginWithGoogle() → cookies → redirect
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';
import { AuthProvider } from '../../../generated/prisma/client.js';
import { UsersService } from '../../users/services/users.service.js';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      clientID: configService.getOrThrow<string>('googleClientId'),
      clientSecret: configService.getOrThrow<string>('googleClientSecret'),
      callbackURL: configService.getOrThrow<string>('googleCallbackUrl'),
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    const email = profile.emails?.[0]?.value;

    if (!email) {
      return done(
        new Error('Aucune adresse email associée au compte Google.'),
        undefined,
      );
    }

    try {
      const user = await this.usersService.findOrCreateOAuthUser({
        email,
        username: profile.displayName ?? email.split('@')[0],
        avatarUrl: profile.photos?.[0]?.value,
        provider: AuthProvider.GOOGLE,
      });

      done(null, user);
    } catch (error) {
      done(error as Error, undefined);
    }
  }
}
