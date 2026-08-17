/**
 * @file src/features/email/email.service.ts
 * @description Centralized email service using Resend.
 * All outgoing emails in the application go through this service.
 *
 * Install: pnpm add resend
 * Env:     RESEND_API_KEY, EMAIL_FROM (e.g. "Prosendia <noreply@Prosendia.com>")
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

import {
  type BillingEmailPayload,
  type PasswordResetEmailPayload,
  type SystemNotificationEmailPayload,
  type VerificationEmailPayload,
  type WelcomeEmailPayload,
} from './email.types.js';
import { billingTemplate } from './templates/billing-email.template.js';
import { passwordResetTemplate } from './templates/password-reset-email.template.js';
import { systemNotificationTemplate } from './templates/system-notification-email.template.js';
import { verificationTemplate } from './templates/verification-email.template.js';
import { welcomeTemplate } from './templates/welcome-email.template.js';

export type {
  BillingEmailPayload,
  PasswordResetEmailPayload,
  SystemNotificationEmailPayload,
  VerificationEmailPayload,
  WelcomeEmailPayload,
} from './email.types.js';

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.getOrThrow<string>('resendApiKey');
    this.resend = new Resend(apiKey);
    this.from =
      this.config.get<string>('emailFrom') ??
      'Prosendia <noreply@Prosendia.com>';
  }

  // ─── Core send ─────────────────────────────────────────────────────────────

  private async send(to: string, subject: string, html: string): Promise<void> {
    try {
      const { error } = await this.resend.emails.send({
        from: this.from,
        to,
        subject,
        html,
      });
      if (error) {
        this.logger.error(
          `[EMAIL_SEND_FAILED] to=${to} subject="${subject}" err="${error.message}"`,
        );
        throw new Error(`Email send failed: ${error.message}`);
      }
      this.logger.log(`[EMAIL_SENT] to=${to} subject="${subject}"`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`[EMAIL_EXCEPTION] to=${to} err="${msg}"`);
      throw err;
    }
  }

  // ─── Public methods ────────────────────────────────────────────────────────

  async sendVerificationCode(payload: VerificationEmailPayload): Promise<void> {
    const expiresIn = payload.expiresInMinutes ?? 30;
    await this.send(
      payload.to,
      'Votre code de vérification Prosendia',
      verificationTemplate(payload.username, payload.code, expiresIn),
    );
  }

  async sendWelcomeEmail(payload: WelcomeEmailPayload): Promise<void> {
    await this.send(
      payload.to,
      'Bienvenue sur Prosendia 🎉',
      welcomeTemplate(payload.username),
    );
  }

  async sendPasswordResetEmail(
    payload: PasswordResetEmailPayload,
  ): Promise<void> {
    const expiresIn = payload.expiresInMinutes ?? 30;
    await this.send(
      payload.to,
      'Réinitialisation de votre mot de passe',
      passwordResetTemplate(payload.username, payload.resetUrl, expiresIn),
    );
  }

  async sendBillingConfirmation(payload: BillingEmailPayload): Promise<void> {
    await this.send(
      payload.to,
      `Confirmation de paiement — ${payload.planName}`,
      billingTemplate(payload),
    );
  }

  async sendSystemNotification(
    payload: SystemNotificationEmailPayload,
  ): Promise<void> {
    await this.send(
      payload.to,
      payload.subject,
      systemNotificationTemplate(payload),
    );
  }
}
