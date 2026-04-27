/**
 * @file src/common/decorators/current-user.decorator.ts
 * @description Parameter decorator that extracts the authenticated user
 * injected by Passport from the Express request object.
 *
 * Replaces the verbose `@Request() req` + `req.user` pattern in every
 * controller method, and provides full TypeScript typing.
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard)
 *   @Get('me')
 *   getMe(@CurrentUser() user: AuthenticatedUser) { ... }
 */

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export const CurrentUser = createParamDecorator(
  <T = Express.User>(_data: unknown, ctx: ExecutionContext): T => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.user as T;
  },
);
