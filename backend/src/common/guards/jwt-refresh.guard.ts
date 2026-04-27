/**
 * @file src/common/guards/jwt-refresh.guard.ts
 * @description Guard for long-lived refresh tokens.
 * Apply ONLY to POST /auth/refresh and POST /auth/logout.
 * Uses a separate Passport strategy ('jwt-refresh') with its own secret,
 * ensuring refresh tokens cannot be used as access tokens.
 */

import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {}
