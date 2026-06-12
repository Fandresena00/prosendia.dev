/**
 * @file src/features/auth/auth.controller.ts
 *
 * CHANGE: Two-step registration:
 *   POST /auth/register            → initiateRegistration (send verification code)
 *   POST /auth/verify-email        → completeRegistration (verify code, create user, set cookies)
 *   POST /auth/resend-verification → resend code
 *
 * All other endpoints unchanged.
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
import { ResendVerificationDto } from './dto/resend-verification.dto.js';
import { VerifyEmailDto } from './dto/verify-email.dto.js';
import {
  AuthService,
  AuthServiceResult,
  RegistrationInitiated,
} from './services/auth.service.js';
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
    return { httpOnly: true, secure: this.isProduction, sameSite: 'none' };
  }

  private setAuthCookies(res: Response, result: AuthServiceResult): void {
    res.cookie(ACCESS_TOKEN_COOKIE, result.accessToken, {
      ...this.baseCookieOptions,
      maxAge: ACCESS_TOKEN_MAX_AGE_MS,
      path: '/',
    });
    res.cookie(REFRESH_TOKEN_COOKIE, result.refreshToken, {
      ...this.baseCookieOptions,
      maxAge: REFRESH_TOKEN_MAX_AGE_MS,
      path: '/',
    });
  }

  private clearAuthCookies(res: Response): void {
    res.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/' });
  }

  // ─── Step 1: Initiate registration ──────────────────────────────────────────

  /**
   * POST /auth/register
   * Validates the signup form, stores pending verification, sends code.
   * Returns 200 + { email, message } — NO cookies yet.
   */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('register')
  async register(@Body() dto: RegisterDto): Promise<RegistrationInitiated> {
    return this.authService.initiateRegistration(dto);
  }

  // ─── Step 2: Verify email & complete registration ────────────────────────────

  /**
   * POST /auth/verify-email
   * Validates the 6-digit code, creates the user, sets auth cookies.
   */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('verify-email')
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PublicAuthResponse> {
    const result = await this.authService.completeRegistration(dto);
    this.setAuthCookies(res, result);
    return { user: result.user };
  }

  // ─── Resend verification code ────────────────────────────────────────────────

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('resend-verification')
  async resendVerification(
    @Body() dto: ResendVerificationDto,
  ): Promise<{ message: string }> {
    return this.authService.resendVerificationCode(dto.email);
  }

  // ─── Login ───────────────────────────────────────────────────────────────────

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

  // ─── Refresh ─────────────────────────────────────────────────────────────────

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

  // ─── Logout ──────────────────────────────────────────────────────────────────

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

  // ─── Me ──────────────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@CurrentUser() user: AuthenticatedUser): Promise<UserResponseDto> {
    return this.usersService.findUserById({ id: user.sub });
  }
}
