/**
 * @file src/features/auth/services/email-verification.service.ts
 * @description Manages pending email verifications before account creation.
 *
 * Flow:
 *   1. User submits signup form → sendVerificationCode() stores pending record
 *   2. User enters code → verifyCode() validates, returns stored credentials
 *   3. AuthService creates the user with the stored credentials
 *
 * Security:
 *   - Code is 6-digit random, stored as bcrypt hash
 *   - Expires after 30 minutes
 *   - Single-use (usedAt is set on consumption)
 *   - Max 3 active pending verifications per email (abuse prevention)
 */

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { randomInt } from 'node:crypto';
import { PrismaService } from '../../../database/prisma.service.js';
import { EmailService } from '../../email/email.service.js';

const CODE_TTL_MINUTES = 30;
const CODE_HASH_ROUNDS = 10;
const MAX_PENDING_PER_EMAIL = 3;

export interface PendingVerification {
  email: string;
  username: string;
  passwordHash: string;
}

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  // ─── Generate & send ───────────────────────────────────────────────────────

  /**
   * Creates a pending verification record and sends the code by email.
   * Called when user submits the signup form.
   */
  async sendVerificationCode(data: {
    email: string;
    username: string;
    /** Already bcrypt-hashed password from AuthService */
    passwordHash: string;
  }): Promise<void> {
    // Abuse check: block if too many pending verifications for this email
    const pendingCount = await this.prisma.emailVerification.count({
      where: {
        email: data.email,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (pendingCount >= MAX_PENDING_PER_EMAIL) {
      throw new BadRequestException(
        'Trop de codes envoyés. Attendez quelques minutes avant de réessayer.',
      );
    }

    // Generate 6-digit code
    const code = String(randomInt(100_000, 999_999));
    const codeHash = await bcrypt.hash(code, CODE_HASH_ROUNDS);
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

    await this.prisma.emailVerification.create({
      data: {
        email: data.email,
        username: data.username,
        passwordHash: data.passwordHash,
        codeHash,
        expiresAt,
      },
    });

    await this.emailService.sendVerificationCode({
      to: data.email,
      username: data.username,
      code,
      expiresInMinutes: CODE_TTL_MINUTES,
    });

    this.logger.log(
      `[VERIFICATION_SENT] email=${data.email} expiresAt=${expiresAt.toISOString()}`,
    );
  }

  // ─── Verify ────────────────────────────────────────────────────────────────

  /**
   * Validates the code and returns the pending credentials for account creation.
   * Marks the record as used (single-use guarantee).
   */
  async verifyCode(email: string, code: string): Promise<PendingVerification> {
    // Find the most recent unexpired, unused record for this email
    const record = await this.prisma.emailVerification.findFirst({
      where: {
        email,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw new BadRequestException(
        'Code expiré ou invalide. Demandez un nouveau code.',
      );
    }

    const isValid = await bcrypt.compare(code, record.codeHash);

    if (!isValid) {
      throw new BadRequestException('Code incorrect.');
    }

    // Consume the record immediately to prevent replay
    await this.prisma.emailVerification.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    this.logger.log(
      `[VERIFICATION_SUCCESS] email=${email} recordId=${record.id}`,
    );

    return {
      email: record.email,
      username: record.username,
      passwordHash: record.passwordHash,
    };
  }

  // ─── Resend ────────────────────────────────────────────────────────────────

  /**
   * Invalidates existing pending codes for the email and sends a new one.
   * Reuses the passwordHash from the most recent pending record.
   */
  async resendVerificationCode(email: string): Promise<void> {
    // Fetch the most recent pending record to get stored username + password hash
    const existing = await this.prisma.emailVerification.findFirst({
      where: {
        email,
        usedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!existing) {
      throw new BadRequestException(
        'Aucune inscription en attente pour cet email.',
      );
    }

    // Expire all current pending codes for this email
    await this.prisma.emailVerification.updateMany({
      where: {
        email,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { expiresAt: new Date() }, // force expire
    });

    await this.sendVerificationCode({
      email,
      username: existing.username,
      passwordHash: existing.passwordHash,
    });
  }

  // ─── Cleanup (cron-friendly) ──────────────────────────────────────────────

  /** Deletes expired & used records. Call from a scheduled job. */
  async cleanupExpiredCodes(): Promise<void> {
    const result = await this.prisma.emailVerification.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }],
      },
    });
    if (result.count > 0) {
      this.logger.log(`[VERIFICATION_CLEANUP] deleted=${result.count} records`);
    }
  }
}
