/**
 * @file src/features/auth/token-session.service.ts
 * @description Centralized JWT session validation and revocation helpers.
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import type { RefreshToken } from '../../../generated/prisma/client.js';

interface RefreshSessionInput {
  userId: string;
  jti: string;
  tokenHash: string;
  expiresAt: Date;
}

type CachedSession = Pick<
  RefreshToken,
  'id' | 'userId' | 'jti' | 'tokenHash' | 'expiresAt' | 'revokedAt'
>;

@Injectable()
export class TokenSessionService {
  constructor(private readonly prisma: PrismaService) {}

  private toCachedSession(session: RefreshToken): CachedSession {
    return {
      id: session.id,
      userId: session.userId,
      jti: session.jti,
      tokenHash: session.tokenHash,
      expiresAt: session.expiresAt,
      revokedAt: session.revokedAt,
    };
  }

  async createRefreshSession(input: RefreshSessionInput): Promise<void> {
    await this.prisma.refreshToken.create({
      data: {
        userId: input.userId,
        jti: input.jti,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      },
    });
  }

  async validateRefreshSession(
    userId: string,
    jti?: string,
  ): Promise<CachedSession> {
    if (!jti) {
      throw new UnauthorizedException('Token identifier is missing');
    }

    const session = await this.prisma.refreshToken.findUnique({
      where: { jti },
    });

    if (!session || session.userId !== userId) {
      throw new UnauthorizedException('Session invalid. Please log in again.');
    }

    if (session.revokedAt || session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Session invalid. Please log in again.');
    }

    const normalized = this.toCachedSession(session);
    return normalized;
  }

  async revokeSessionByJti(userId: string, jti?: string): Promise<void> {
    if (!jti) {
      return;
    }

    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        jti,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllActiveSessions(userId: string): Promise<void> {
    const activeSessions = await this.prisma.refreshToken.findMany({
      where: {
        userId,
        revokedAt: null,
      },
      select: { jti: true },
    });

    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }
}
