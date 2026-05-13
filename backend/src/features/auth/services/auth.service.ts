/**
 * @file src/features/auth/auth.service.ts
 * @description Authentication business logic.
 * Returns AuthServiceResult internally — the controller sets tokens as cookies.
 * Tokens are NEVER in the HTTP response body.
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
import { UserResponseDto } from '../../users/dto/user-response.dto.js';
import { UsersService } from '../../users/services/users.service.js';
import { LoginDto } from '../dto/login.dto.js';
import { RegisterDto } from '../dto/register.dto.js';
import { JwtRefreshPayload } from '../strategies/jwt-refresh.strategy.js';
import { TokenSessionService } from './token-session.service.js';

const REFRESH_HASH_ROUNDS = 10;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Internal result shape — only the controller receives this.
 * Tokens go into Set-Cookie headers, NOT the response body.
 */
export interface AuthServiceResult {
  user: UserResponseDto;
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly tokenSessionService: TokenSessionService,
  ) {}

  // ─── Token generation ────────────────────────────────────────────────────────

  private generateAccessToken(
    userId: string,
    email: string,
    sessionId: string,
  ): string {
    return this.jwtService.sign(
      {
        sub: userId,
        email,
        jti: randomUUID(),
        sessionId,
      },
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
      this.usersService.findUserById({
        id: userId,
      }),
      Promise.resolve(this.generateRefreshToken(userId, email, refreshJti)),
    ]);

    await this.persistRefreshToken(userId, refreshJti, refreshToken);

    const accessToken = this.generateAccessToken(userId, email, refreshJti);
    return { user, accessToken, refreshToken };
  }

  // ─── Public actions ──────────────────────────────────────────────────────────

  async register(dto: RegisterDto): Promise<AuthServiceResult> {
    const existing = await this.usersService.findUserByEmail(dto.email);

    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const user = await this.usersService.createUser(dto);
    return this.buildResult(user.id, user.email);
  }

  async login(dto: LoginDto): Promise<AuthServiceResult> {
    const user = await this.usersService.findUserByEmailWithPassword(dto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isValid = await bcrypt.compare(dto.password, user.password);

    if (!isValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.buildResult(user.id, user.email);
  }

  async refresh(payload: JwtRefreshPayload): Promise<AuthServiceResult> {
    const isMatch = await bcrypt.compare(
      payload.refreshToken,
      payload.sessionTokenHash,
    );

    if (!isMatch) {
      throw new UnauthorizedException('Session invalid. Please log in again.');
    }

    await this.tokenSessionService.revokeSessionByJti(payload.sub, payload.jti);

    return this.buildResult(payload.sub, payload.email);
  }

  async logout(payload: JwtRefreshPayload): Promise<void> {
    const isMatch = await bcrypt.compare(
      payload.refreshToken,
      payload.sessionTokenHash,
    );

    if (!isMatch) {
      throw new UnauthorizedException('Session invalid. Please log in again.');
    }

    await this.tokenSessionService.revokeSessionByJti(payload.sub, payload.jti);
  }
}
