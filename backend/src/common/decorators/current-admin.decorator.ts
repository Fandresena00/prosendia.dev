// src/common/decorators/current-admin.decorator.ts

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedAdmin } from '../../features/admin/strategies/admin-jwt.strategy.js';

export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedAdmin => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.user as AuthenticatedAdmin;
  },
);
