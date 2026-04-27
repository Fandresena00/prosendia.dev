/**
 * @file src/common/guards/jwt-auth.guard.ts
 * @description Guard for short-lived access tokens.
 * Apply to any route that requires an authenticated user.
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard)
 *   @Get('protected')
 */

import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
