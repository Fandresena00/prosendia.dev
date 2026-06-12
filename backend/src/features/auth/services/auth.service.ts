/**
 * @file src/features/auth/services/auth.service.ts
 *
 * CHANGE: Two-step registration flow.
 *
 * Before: register() → creates user immediately
 * After:
 *   1. initiateRegistration() → stores pending verification, sends code
 *   2. completeRegistration() → validates code, creates user, returns tokens
 *
 * The old register() method is removed. AuthController now exposes:
 *   POST /auth/register           → initiateRegistration (send code)
 *   POST /auth/verify-email       → completeRegistration (confirm code)
 *   POST /auth/resend-verification → resendVerificationCode
 */

import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { EmailService } from '../../email/email.service.js';
import { UserResponseDto } from '../../users/dto/user-response.dto.js';
import { UsersService } from '../../users/services/users.service.js';
import { LoginDto } from '../dto/login.dto.js';
import { RegisterDto } from '../dto/register.dto.js';
import { VerifyEmailDto } from '../dto/verify-email.dto.js';
import { JwtRefreshPayload } from '../strategies/jwt-refresh.strategy.js';
import { EmailVerificationService } from './email-verification.service.js';
import { TokenSessionService } from './token-session.service.js';

const REGISTER_HASH_ROUNDS = 12;
const REFRESH_HASH_ROUNDS = 10;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface AuthServiceResult {
  user: UserResponseDto;
  accessToken: string;
  refreshToken: string;
}

/** Returned by initiateRegistration — no tokens yet */
export interface RegistrationInitiated {
  email: string;
  message: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly tokenSessionService: TokenSessionService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly emailService: EmailService,
  ) {}

  // ─── Token generation ────────────────────────────────────────────────────────

  private generateAccessToken(
    userId: string,
    email: string,
    sessionId: string,
  ): string {
    return this.jwtService.sign(
      { sub: userId, email, jti: randomUUID(), sessionId },
      {
        secret: this.configService.getOrThrow<string>('jwtSecret'),
        expiresIn:
          (this.configService.get<string>('jwtExpiration') as any) || '15m',
      },
    );
  }

  private generateRefreshToken(
    userId: string,
    email: string,
    jti: string,
  ): string {
    return this.jwtService.sign(
      { sub: userId, email, jti },
      {
        secret: this.configService.getOrThrow<string>('jwtRefreshSecret'),
        expiresIn:
          (this.configService.get<string>('jwtRefreshExpiration') as any) ||
          '7d',
      },
    );
  }

  private async persistRefreshToken(
    userId: string,
    jti: string,
    rawToken: string,
  ): Promise<void> {
    const tokenHash = await bcrypt.hash(rawToken, REFRESH_HASH_ROUNDS);
    await this.tokenSessionService.createRefreshSession({
      userId,
      jti,
      tokenHash,
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    });
  }

  private async buildResult(
    userId: string,
    email: string,
  ): Promise<AuthServiceResult> {
    const refreshJti = randomUUID();
    const [user, refreshToken] = await Promise.all([
      this.usersService.findUserById({ id: userId }),
      Promise.resolve(this.generateRefreshToken(userId, email, refreshJti)),
    ]);
    await this.persistRefreshToken(userId, refreshJti, refreshToken);
    const accessToken = this.generateAccessToken(userId, email, refreshJti);
    return { user, accessToken, refreshToken };
  }

  // ─── Step 1: Initiate registration ──────────────────────────────────────────

  /**
   * Validates that email is not taken, hashes the password,
   * stores a pending verification record, and sends the code.
   * Does NOT create a User record.
   */
  async initiateRegistration(dto: RegisterDto): Promise<RegistrationInitiated> {
    const existing = await this.usersService.findUserByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Un compte avec cet email existe déjà.');
    }

    const passwordHash = await bcrypt.hash(dto.password, REGISTER_HASH_ROUNDS);

    await this.emailVerificationService.sendVerificationCode({
      email: dto.email,
      username: dto.username,
      passwordHash,
    });

    return {
      email: dto.email,
      message: 'Code de vérification envoyé. Vérifiez votre boîte email.',
    };
  }

  // ─── Step 2: Complete registration (verify code) ─────────────────────────────

  /**
   * Validates the code, creates the user with stored credentials,
   * and returns a full auth session.
   */
  async completeRegistration(dto: VerifyEmailDto): Promise<AuthServiceResult> {
    const pending = await this.emailVerificationService.verifyCode(
      dto.email,
      dto.code,
    );

    // Double-check: no race-condition duplicate
    const existing = await this.usersService.findUserByEmail(pending.email);
    if (existing) {
      throw new ConflictException('Un compte avec cet email existe déjà.');
    }

    // Create the user with the pre-hashed password
    // UsersService.createUser() hashes password — we need a version that accepts a hash.
    // We call prisma directly via a dedicated internal method:
    const user = await this.usersService.createVerifiedUser({
      email: pending.email,
      username: pending.username,
      passwordHash: pending.passwordHash,
    });

    // Send welcome email (non-blocking)
    this.emailService
      .sendWelcomeEmail({
        to: user.email,
        username: user.username,
      })
      .catch((err: unknown) => {
        // Non-critical — log but don't fail registration
      });

    return this.buildResult(user.id, user.email);
  }

  // ─── Resend verification code ────────────────────────────────────────────────

  async resendVerificationCode(email: string): Promise<{ message: string }> {
    await this.emailVerificationService.resendVerificationCode(email);
    return { message: 'Nouveau code envoyé.' };
  }

  // ─── Login ───────────────────────────────────────────────────────────────────

  async login(dto: LoginDto): Promise<AuthServiceResult> {
    const user = await this.usersService.findUserByEmailWithPassword(dto.email);
    if (!user)
      throw new UnauthorizedException('Email ou mot de passe incorrect.');

    const isValid = await bcrypt.compare(dto.password, user.password);
    if (!isValid)
      throw new UnauthorizedException('Email ou mot de passe incorrect.');

    return this.buildResult(user.id, user.email);
  }

  // ─── Refresh ─────────────────────────────────────────────────────────────────

  async refresh(payload: JwtRefreshPayload): Promise<AuthServiceResult> {
    const isMatch = await bcrypt.compare(
      payload.refreshToken,
      payload.sessionTokenHash,
    );
    if (!isMatch)
      throw new UnauthorizedException('Session invalide. Reconnectez-vous.');
    await this.tokenSessionService.revokeSessionByJti(payload.sub, payload.jti);
    return this.buildResult(payload.sub, payload.email);
  }

  // ─── Logout ──────────────────────────────────────────────────────────────────

  async logout(payload: JwtRefreshPayload): Promise<void> {
    const isMatch = await bcrypt.compare(
      payload.refreshToken,
      payload.sessionTokenHash,
    );
    if (!isMatch)
      throw new UnauthorizedException('Session invalide. Reconnectez-vous.');
    await this.tokenSessionService.revokeSessionByJti(payload.sub, payload.jti);
  }
}
