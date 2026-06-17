/**
 * @file src/features/auth/auth.controller.ts
 *
 * CHANGE: Ajout de POST /auth/logout-all — révoque toutes les sessions actives
 * de l'utilisateur (tous appareils) et efface les cookies de l'appareil courant.
 * Protégé par JwtAuthGuard (access token), pas besoin du refresh token pour
 * déclencher cette action depuis une session déjà authentifiée.
 *
 * Fichier complet — remplace l'ancien auth.controller.ts.
 */

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
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { GoogleAuthGuard } from '../../common/guards/google-auth.guard.js';
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

  // ─── Cookie helpers ──────────────────────────────────────────────────────

  private get isProduction(): boolean {
    return this.configService.get<string>('nodeEnv') === 'production';
  }

  private get baseCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.isProduction,
      // 'none' requis en prod pour cross-origin (frontend ≠ backend domain)
      // 'lax' en local (même origin via localhost)
      sameSite: this.isProduction ? 'none' : 'lax',
    };
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
    // Cookie de présence de session lu par l'Edge Middleware Next.js
    res.clearCookie('vendeo.session', { path: '/' });
  }

  // ─── Google OAuth ─────────────────────────────────────────────────────────

  /**
   * GET /auth/google
   * Passport intercepte cette route et redirige vers Google.
   * Le corps de la méthode ne s'exécute jamais.
   */
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleLogin(): void {
    // handled by Passport
  }

  /**
   * GET /auth/google/callback
   *
   * Google redirige ici après le consentement.
   * GoogleStrategy.validate() a déjà run → req.user = UserResponseDto
   *
   * Succès  → set cookies + redirect FRONTEND_URL/dashboard
   * Échec   → redirect FRONTEND_URL/sign-in?error=google_auth_failed
   */
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const frontendUrl = this.configService.getOrThrow<string>('frontendUrl');

    try {
      const user = req.user as UserResponseDto | undefined;

      if (!user) {
        return res.redirect(`${frontendUrl}/sign-in?error=google_auth_failed`);
      }

      const result = await this.authService.loginWithGoogle(user);
      this.setAuthCookies(res, result);

      // Cookie de présence de session pour Edge Middleware Next.js
      res.cookie('vendeo.session', '1', {
        maxAge: ACCESS_TOKEN_MAX_AGE_MS,
        sameSite: this.isProduction ? 'none' : 'lax',
        secure: this.isProduction,
        httpOnly: false, // lisible par Edge Middleware
        path: '/',
      });

      res.redirect(`${frontendUrl}/dashboard`);
    } catch {
      res.redirect(`${frontendUrl}/sign-in?error=google_auth_failed`);
    }
  }

  // ─── Inscription locale — Step 1 ─────────────────────────────────────────

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('register')
  async register(@Body() dto: RegisterDto): Promise<RegistrationInitiated> {
    return this.authService.initiateRegistration(dto);
  }

  // ─── Inscription locale — Step 2 ─────────────────────────────────────────

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

  // ─── Renvoi du code ───────────────────────────────────────────────────────

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('resend-verification')
  async resendVerification(
    @Body() dto: ResendVerificationDto,
  ): Promise<{ message: string }> {
    return this.authService.resendVerificationCode(dto.email);
  }

  // ─── Login local ──────────────────────────────────────────────────────────

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

  // ─── Refresh ──────────────────────────────────────────────────────────────

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

  // ─── Logout ───────────────────────────────────────────────────────────────

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

  // ─── Logout — tous les appareils ───────────────────────────────────────────

  /**
   * POST /auth/logout-all
   * Déclenché depuis Paramètres > Sécurité > "Se déconnecter de tous les appareils".
   * Protégé par le access token (JwtAuthGuard) — pas besoin du refresh token,
   * l'utilisateur est déjà authentifié pour accéder à cette page.
   */
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout-all')
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.revokeAllSessions(user.sub);
    this.clearAuthCookies(res);
  }

  // ─── Me ───────────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    return this.usersService.findUserById({ id: user.sub });
  }
}
