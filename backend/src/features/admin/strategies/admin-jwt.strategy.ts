// src/features/admin/strategies/admin-jwt.strategy.ts

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ADMIN_ACCESS_TOKEN_COOKIE } from '../admin.constants.js';

export interface AuthenticatedAdmin {
  sub: string;
  email: string;
  role: 'SUPER_ADMIN' | 'ADMIN';
}

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) =>
          (req?.cookies as Record<string, string> | undefined)?.[
            ADMIN_ACCESS_TOKEN_COOKIE
          ] ?? null,
      ]),
      ignoreExpiration: false,
      // Secret DÉDIÉ — jamais le même que jwtSecret (séparation totale des espaces de confiance)
      secretOrKey: configService.getOrThrow<string>('adminJwtSecret'),
    });
  }

  validate(payload: AuthenticatedAdmin): AuthenticatedAdmin {
    return payload;
  }
}
