// src/features/admin/services/admin-auth.service.ts

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { PrismaService } from '../../../database/prisma.service.js';
import { AdminLoginDto } from '../dto/admin-auth.dto.js';

const PASSWORD_HASH_ROUNDS = 12;

export interface AdminAuthResult {
  admin: { id: string; email: string; role: string };
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: AdminLoginDto, ip: string): Promise<AdminAuthResult> {
    const admin = await this.prisma.admin.findUnique({
      where: { email: dto.email },
    });

    if (!admin || !admin.isActive) {
      this.logger.warn(
        `[ADMIN_LOGIN_FAILED] email=${dto.email} ip=${ip} — not found/inactive`,
      );
      throw new UnauthorizedException('Identifiants invalides.');
    }

    const isValid = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!isValid) {
      this.logger.warn(
        `[ADMIN_LOGIN_FAILED] email=${dto.email} ip=${ip} — wrong password`,
      );
      throw new UnauthorizedException('Identifiants invalides.');
    }

    await this.prisma.admin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    await this.prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'LOGIN',
        targetType: 'ADMIN',
        targetId: admin.id,
        metadata: { ip },
      },
    });

    this.logger.log(
      `[ADMIN_LOGIN_SUCCESS] email=${admin.email} role=${admin.role}`,
    );

    return this.buildTokens(admin.id, admin.email, admin.role);
  }

  private buildTokens(
    id: string,
    email: string,
    role: string,
  ): AdminAuthResult {
    const payload = { sub: id, email, role };

    const accessToken = this.jwt.sign(payload, {
      secret: this.config.getOrThrow<string>('adminJwtSecret'),
      expiresIn: '30m',
    });

    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.getOrThrow<string>('adminJwtRefreshSecret'),
      expiresIn: '24h',
    });

    return { admin: { id, email, role }, accessToken, refreshToken };
  }

  async refresh(refreshToken: string): Promise<AdminAuthResult> {
    try {
      const payload = this.jwt.verify<{
        sub: string;
        email: string;
        role: string;
      }>(refreshToken, {
        secret: this.config.getOrThrow<string>('adminJwtRefreshSecret'),
      });

      const admin = await this.prisma.admin.findUnique({
        where: { id: payload.sub },
      });
      if (!admin || !admin.isActive) {
        throw new UnauthorizedException('Session invalide.');
      }

      return this.buildTokens(admin.id, admin.email, admin.role);
    } catch {
      throw new UnauthorizedException('Session invalide. Reconnectez-vous.');
    }
  }
}
