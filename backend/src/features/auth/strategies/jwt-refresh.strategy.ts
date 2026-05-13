/**
 * @file src/features/auth/strategies/jwt-refresh.strategy.ts
 * @description Passport strategy for long-lived refresh tokens.
 * Reads the token from the HttpOnly cookie `vendeo_refresh_token`.
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { REFRESH_TOKEN_COOKIE } from '../auth.constants.js';
import { TokenSessionService } from '../services/token-session.service.js';

export interface JwtRefreshClaims {
  sub: string;
  email: string;
  jti: string;
  iat?: number;
  exp?: number;
}

export interface JwtRefreshPayload extends JwtRefreshClaims {
  sessionTokenId: string;
  sessionTokenHash: string;
  /** Raw refresh token from the cookie — compared against stored bcrypt hash. */
  refreshToken: string;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    configService: ConfigService,
    private readonly tokenSessionService: TokenSessionService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) =>
          (req?.cookies as Record<string, string> | undefined)?.[
            REFRESH_TOKEN_COOKIE
          ] ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('jwtRefreshSecret'),
      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    payload: JwtRefreshClaims,
  ): Promise<JwtRefreshPayload> {
    const cookies = req.cookies as Record<string, string> | undefined;
    const refreshToken = cookies?.[REFRESH_TOKEN_COOKIE];

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token cookie is missing');
    }

    const session = await this.tokenSessionService.validateRefreshSession(
      payload.sub,
      payload.jti,
    );

    return {
      ...payload,
      refreshToken,
      sessionTokenId: session.id,
      sessionTokenHash: session.tokenHash,
    };
  }
}
