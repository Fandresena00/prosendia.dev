// src/features/admin/controllers/admin-auth.controller.ts

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import { CurrentAdmin } from '../../../common/decorators/current-admin.decorator.js';
import { AdminJwtAuthGuard } from '../../../common/guards/admin-jwt-auth.guard.js';
import {
  ADMIN_ACCESS_TOKEN_COOKIE,
  ADMIN_ACCESS_TOKEN_MAX_AGE_MS,
  ADMIN_REFRESH_TOKEN_COOKIE,
  ADMIN_REFRESH_TOKEN_MAX_AGE_MS,
} from '../admin.constants.js';
import { AdminLoginDto } from '../dto/admin-auth.dto.js';
import {
  AdminAuthResult,
  AdminAuthService,
} from '../services/admin-auth.service.js';
import type { AuthenticatedAdmin } from '../strategies/admin-jwt.strategy.js';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    private readonly authService: AdminAuthService,
    private readonly config: ConfigService,
  ) {}

  private get isProduction(): boolean {
    return this.config.get<string>('nodeEnv') === 'production';
  }

  private setCookies(res: Response, result: AdminAuthResult): void {
    const base: CookieOptions = {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: this.isProduction ? 'none' : 'lax',
      path: '/',
    };
    res.cookie(ADMIN_ACCESS_TOKEN_COOKIE, result.accessToken, {
      ...base,
      maxAge: ADMIN_ACCESS_TOKEN_MAX_AGE_MS,
    });
    res.cookie(ADMIN_REFRESH_TOKEN_COOKIE, result.refreshToken, {
      ...base,
      maxAge: ADMIN_REFRESH_TOKEN_MAX_AGE_MS,
    });
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() dto: AdminLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto, req.ip ?? 'unknown');
    this.setCookies(res, result);
    return { admin: result.admin };
  }

  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookies = req.cookies as Record<string, string> | undefined;
    const token = cookies?.[ADMIN_REFRESH_TOKEN_COOKIE];
    if (!token) {
      res.status(HttpStatus.UNAUTHORIZED);
      return { message: 'Session expirée.' };
    }
    const result = await this.authService.refresh(token);
    this.setCookies(res, result);
    return { admin: result.admin };
  }

  @UseGuards(AdminJwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(ADMIN_ACCESS_TOKEN_COOKIE, { path: '/' });
    res.clearCookie(ADMIN_REFRESH_TOKEN_COOKIE, { path: '/' });
  }

  @UseGuards(AdminJwtAuthGuard)
  @Get('me')
  me(@CurrentAdmin() admin: AuthenticatedAdmin) {
    return { admin };
  }
}
