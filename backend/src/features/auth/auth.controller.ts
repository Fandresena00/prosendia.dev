/**
 * @file src/features/auth/auth.controller.ts
 * @description Auth endpoints. Sets HttpOnly cookies — never returns tokens in body.
 *
 * Response body always contains only { user }.
 * Tokens travel exclusively through Set-Cookie / Cookie HTTP headers.
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { JwtRefreshGuard } from '../../common/guards/jwt-refresh.guard.js';
import { UserResponseDto } from '../users/dto/user-response.dto.js';
import { UsersService } from '../users/services/users.service.js';
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE_MS,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_MAX_AGE_MS,
} from './auth.constants.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { AuthService, AuthServiceResult } from './services/auth.service.js';
import type { JwtRefreshPayload } from './strategies/jwt-refresh.strategy.js';
import type { AuthenticatedUser } from './types/authenticated-user.types.js';

interface PublicAuthResponse {
  user: UserResponseDto;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  // ─── Cookie helpers ──────────────────────────────────────────────────────────

  private get isProduction(): boolean {
    return this.configService.get<string>('nodeEnv') === 'production';
  }

  private get baseCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'none',
    };
  }

  private setAuthCookies(res: Response, result: AuthServiceResult): void {
    res.cookie(ACCESS_TOKEN_COOKIE, result.accessToken, {
      ...this.baseCookieOptions,
      maxAge: ACCESS_TOKEN_MAX_AGE_MS,
      path: '/',
    });

    // Refresh token scoped to /api/auth — only sent to auth endpoints
    res.cookie(REFRESH_TOKEN_COOKIE, result.refreshToken, {
      ...this.baseCookieOptions,
      maxAge: REFRESH_TOKEN_MAX_AGE_MS,
      path: '/api/auth',
    });
  }

  private clearAuthCookies(res: Response): void {
    res.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/api/auth' });
  }

  // ─── Endpoints ───────────────────────────────────────────────────────────────

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PublicAuthResponse> {
    const result = await this.authService.register(dto);
    this.setAuthCookies(res, result);
    return { user: result.user };
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PublicAuthResponse> {
    const result = await this.authService.login(dto);
    this.setAuthCookies(res, result);
    return { user: result.user };
  }

  @UseGuards(JwtRefreshGuard)
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @CurrentUser() payload: JwtRefreshPayload,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PublicAuthResponse> {
    const result = await this.authService.refresh(payload);
    this.setAuthCookies(res, result);
    return { user: result.user };
  }

  @UseGuards(JwtRefreshGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(
    @CurrentUser() payload: JwtRefreshPayload,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.logout(payload);
    this.clearAuthCookies(res);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    return this.usersService.findUserById({ id: user.sub });
  }
}
