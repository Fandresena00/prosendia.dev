/**
 * @file src/features/auth/strategies/jwt.strategy.ts
 * @description Passport strategy for short-lived access tokens.
 * Reads the token from the HttpOnly cookie `vendeo_access_token`.
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ACCESS_TOKEN_COOKIE } from '../auth.constants.js';
import type { AuthenticatedUser } from '../types/authenticated-user.types.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) =>
          (req?.cookies as Record<string, string> | undefined)?.[
            ACCESS_TOKEN_COOKIE
          ] ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('jwtSecret'),
    });
  }

  validate(payload: AuthenticatedUser): AuthenticatedUser {
    return payload;
  }
}
