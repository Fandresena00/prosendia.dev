/**
 * @file src/features/email/email.service.ts
 * @description Centralized email service using Resend.
 * All outgoing emails in the application go through this service.
 *
 * Install: pnpm add resend
 * Env:     RESEND_API_KEY, EMAIL_FROM (e.g. "VendeoAI <noreply@vendeoai.com>")
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

// ─── Payload types ────────────────────────────────────────────────────────────

export interface VerificationEmailPayload {
  to: string;
  username: string;
  code: string;
  expiresInMinutes?: number;
}

export interface WelcomeEmailPayload {
  to: string;
  username: string;
}

export interface PasswordResetEmailPayload {
  to: string;
  username: string;
  resetUrl: string;
  expiresInMinutes?: number;
}

export interface BillingEmailPayload {
  to: string;
  username: string;
  planName: string;
  amount: string;
  nextBillingDate?: string;
  invoiceUrl?: string;
}

export interface SystemNotificationEmailPayload {
  to: string;
  username: string;
  subject: string;
  title: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
}

// ─── Design tokens (mirror globals.css OKLCH → approximate hex for email) ─────
// Email clients don't support oklch() — we use closest hex equivalents.
const COLORS = {
  primary: '#4F5BD5',        // oklch(0.52 0.24 256) ≈ indigo-blue
  primaryLight: '#E8EAFB',   // primary / 10%
  primaryDark: '#3A45B8',
  background: '#0F1117',     // dark bg
  surface: '#1C1F2E',        // card bg dark
  surfaceBorder: '#2A2D3E',
  foreground: '#F5F5FA',
  mutedFg: '#8B8FA8',
  success: '#34D399',        // emerald
  successLight: '#0D2E24',
  warning: '#FB923C',        // orange
  destructive: '#F87171',    // rose
  white: '#FFFFFF',
} as const;

// ─── Base layout ──────────────────────────────────────────────────────────────

function baseTemplate(content: string, previewText: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>VendeoAI</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background-color: ${COLORS.background};
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      -webkit-font-smoothing: antialiased;
      color: ${COLORS.foreground};
    }
    .wrapper {
      width: 100%;
      background-color: ${COLORS.background};
      padding: 40px 16px;
    }
    .container {
      max-width: 520px;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      margin-bottom: 32px;
    }
    .logo-mark {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      text-decoration: none;
    }
    .logo-icon {
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryDark});
      border-radius: 10px;
      display: inline-block;
    }
    .logo-text {
      font-size: 16px;
      font-weight: 700;
      color: ${COLORS.foreground};
      letter-spacing: -0.3px;
    }
    .card {
      background-color: ${COLORS.surface};
      border: 1px solid ${COLORS.surfaceBorder};
      border-radius: 16px;
      padding: 40px 36px;
      margin-bottom: 24px;
    }
    .card-title {
      font-size: 22px;
      font-weight: 700;
      color: ${COLORS.foreground};
      letter-spacing: -0.4px;
      margin-bottom: 8px;
      line-height: 1.3;
    }
    .card-subtitle {
      font-size: 14px;
      color: ${COLORS.mutedFg};
      line-height: 1.6;
      margin-bottom: 28px;
    }
    .code-block {
      background: linear-gradient(135deg, #1a1d2e, #0f1117);
      border: 1px solid ${COLORS.primary}40;
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      margin: 24px 0;
      box-shadow: 0 0 0 1px ${COLORS.primary}20, inset 0 1px 0 ${COLORS.primary}15;
    }
    .code-value {
      font-size: 36px;
      font-weight: 700;
      letter-spacing: 10px;
      color: ${COLORS.white};
      font-family: 'Courier New', Courier, monospace;
    }
    .code-label {
      font-size: 11px;
      color: ${COLORS.mutedFg};
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin-top: 8px;
    }
    .btn {
      display: block;
      background: linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryDark});
      color: ${COLORS.white} !important;
      text-decoration: none;
      padding: 14px 28px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      text-align: center;
      margin: 24px 0;
      box-shadow: 0 4px 16px ${COLORS.primary}40;
    }
    .divider {
      height: 1px;
      background: ${COLORS.surfaceBorder};
      margin: 24px 0;
    }
    .info-row {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid ${COLORS.surfaceBorder};
      font-size: 13px;
    }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: ${COLORS.mutedFg}; min-width: 120px; }
    .info-value { color: ${COLORS.foreground}; font-weight: 500; }
    .badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 99px;
      font-size: 11px;
      font-weight: 600;
    }
    .badge-primary {
      background: ${COLORS.primaryLight};
      color: ${COLORS.primary};
    }
    .badge-success {
      background: ${COLORS.successLight};
      color: ${COLORS.success};
    }
    .alert-box {
      background: rgba(79,91,213,0.08);
      border: 1px solid ${COLORS.primary}30;
      border-left: 3px solid ${COLORS.primary};
      border-radius: 8px;
      padding: 12px 16px;
      font-size: 13px;
      color: ${COLORS.mutedFg};
      line-height: 1.6;
      margin: 16px 0;
    }
    .alert-box strong { color: ${COLORS.foreground}; }
    .footer {
      text-align: center;
      font-size: 12px;
      color: ${COLORS.mutedFg};
      line-height: 1.7;
    }
    .footer a {
      color: ${COLORS.primary};
      text-decoration: none;
    }
  </style>
</head>
<body>
  <span style="display:none;max-height:0;overflow:hidden;">${previewText}</span>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="logo-mark">
          <div class="logo-icon"></div>
          <span class="logo-text">VendeoAI</span>
        </div>
      </div>
      ${content}
      <div class="footer">
        <p>© ${new Date().getFullYear()} VendeoAI · Automatisation IA pour vendeurs Facebook</p>
        <p style="margin-top:6px;">
          <a href="https://vendeoai.com/privacy">Confidentialité</a> ·
          <a href="https://vendeoai.com/terms">CGU</a> ·
          <a href="https://vendeoai.com/unsubscribe">Se désabonner</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ─── Templates ────────────────────────────────────────────────────────────────

function verificationTemplate(username: string, code: string, expiresIn: number): string {
  return baseTemplate(`
    <div class="card">
      <div style="width:48px;height:48px;background:${COLORS.primaryLight};border-radius:14px;display:flex;align-items:center;justify-content:center;margin-bottom:20px;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${COLORS.primary}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.75a16 16 0 006.29 6.29l1.1-1.1a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
        </svg>
      </div>
      <h1 class="card-title">Vérifiez votre email</h1>
      <p class="card-subtitle">
        Bonjour <strong style="color:${COLORS.foreground};">${username}</strong>,<br/>
        Utilisez ce code à 6 chiffres pour confirmer votre adresse email et activer votre compte VendeoAI.
      </p>

      <div class="code-block">
        <div class="code-value">${code}</div>
        <div class="code-label">Code de vérification</div>
      </div>

      <div class="alert-box">
        <strong>⏱ Expire dans ${expiresIn} minutes.</strong> Si vous n'avez pas demandé ce code, ignorez cet email.
      </div>

      <div class="divider"></div>

      <p style="font-size:13px;color:${COLORS.mutedFg};line-height:1.7;">
        Ce code est à usage unique et ne peut pas être partagé. Ne le communiquez jamais à quelqu'un d'autre, même s'il prétend être de l'équipe VendeoAI.
      </p>
    </div>
  `, `Votre code de vérification VendeoAI : ${code}`);
}

function welcomeTemplate(username: string): string {
  return baseTemplate(`
    <div class="card">
      <div style="width:48px;height:48px;background:${COLORS.successLight};border-radius:14px;display:flex;align-items:center;justify-content:center;margin-bottom:20px;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${COLORS.success}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      </div>
      <h1 class="card-title">Bienvenue sur VendeoAI 🎉</h1>
      <p class="card-subtitle">
        Bonjour <strong style="color:${COLORS.foreground};">${username}</strong>,<br/>
        Votre compte est activé. Vous pouvez maintenant connecter vos pages Facebook et laisser l'IA répondre à vos clients automatiquement.
      </p>

      <a class="btn" href="https://vendeoai.com/dashboard">
        Accéder à mon tableau de bord →
      </a>

      <div class="divider"></div>

      <p style="font-size:13px;font-weight:600;color:${COLORS.foreground};margin-bottom:14px;">Pour bien démarrer :</p>
      ${[
        ['1', 'Connectez votre page Facebook', 'Paramètres → Pages Facebook'],
        ['2', 'Configurez votre assistant IA', 'Profil business → Description'],
        ['3', 'Activez les réponses automatiques', 'Inbox → Mode IA'],
      ].map(([n, title, sub]) => `
      <div style="display:flex;gap:14px;align-items:flex-start;margin-bottom:14px;">
        <div style="min-width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,${COLORS.primary},${COLORS.primaryDark});display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:white;">${n}</div>
        <div>
          <div style="font-size:13px;font-weight:600;color:${COLORS.foreground};">${title}</div>
          <div style="font-size:12px;color:${COLORS.mutedFg};">${sub}</div>
        </div>
      </div>`).join('')}
    </div>
  `, 'Bienvenue sur VendeoAI — votre compte est activé !');
}

function passwordResetTemplate(username: string, resetUrl: string, expiresIn: number): string {
  return baseTemplate(`
    <div class="card">
      <div style="width:48px;height:48px;background:${COLORS.primaryLight};border-radius:14px;display:flex;align-items:center;justify-content:center;margin-bottom:20px;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${COLORS.primary}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
        </svg>
      </div>
      <h1 class="card-title">Réinitialisez votre mot de passe</h1>
      <p class="card-subtitle">
        Bonjour <strong style="color:${COLORS.foreground};">${username}</strong>,<br/>
        Nous avons reçu une demande de réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour en créer un nouveau.
      </p>

      <a class="btn" href="${resetUrl}">
        Réinitialiser mon mot de passe →
      </a>

      <div class="alert-box">
        <strong>⏱ Ce lien expire dans ${expiresIn} minutes.</strong> Si vous n'avez pas fait cette demande, ignorez cet email — votre mot de passe ne sera pas modifié.
      </div>

      <div class="divider"></div>

      <p style="font-size:12px;color:${COLORS.mutedFg};line-height:1.7;word-break:break-all;">
        Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br/>
        <span style="color:${COLORS.primary};">${resetUrl}</span>
      </p>
    </div>
  `, 'Réinitialisez votre mot de passe VendeoAI');
}

function billingTemplate(p: BillingEmailPayload): string {
  return baseTemplate(`
    <div class="card">
      <div style="width:48px;height:48px;background:${COLORS.successLight};border-radius:14px;display:flex;align-items:center;justify-content:center;margin-bottom:20px;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${COLORS.success}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
        </svg>
      </div>
      <h1 class="card-title">Confirmation d'abonnement</h1>
      <p class="card-subtitle">
        Bonjour <strong style="color:${COLORS.foreground};">${p.username}</strong>, votre paiement a bien été traité.
      </p>

      <div style="background:#12151f;border:1px solid ${COLORS.surfaceBorder};border-radius:12px;padding:20px;margin:20px 0;">
        <div class="info-row">
          <span class="info-label">Plan</span>
          <span class="info-value"><span class="badge badge-primary">${p.planName}</span></span>
        </div>
        <div class="info-row">
          <span class="info-label">Montant</span>
          <span class="info-value" style="color:${COLORS.success};font-weight:700;">${p.amount}</span>
        </div>
        ${p.nextBillingDate ? `
        <div class="info-row">
          <span class="info-label">Prochain débit</span>
          <span class="info-value">${p.nextBillingDate}</span>
        </div>` : ''}
        <div class="info-row">
          <span class="info-label">Statut</span>
          <span class="info-value"><span class="badge badge-success">✓ Payé</span></span>
        </div>
      </div>

      ${p.invoiceUrl ? `<a class="btn" href="${p.invoiceUrl}">Télécharger ma facture →</a>` : ''}
    </div>
  `, `Confirmation paiement ${p.planName} — ${p.amount}`);
}

function systemNotificationTemplate(p: SystemNotificationEmailPayload): string {
  return baseTemplate(`
    <div class="card">
      <h1 class="card-title">${p.title}</h1>
      <p class="card-subtitle">
        Bonjour <strong style="color:#f5f5fa;">${p.username}</strong>,
      </p>
      <div style="font-size:14px;color:#c4c7d8;line-height:1.8;margin-bottom:24px;">
        ${p.body}
      </div>
      ${p.ctaLabel && p.ctaUrl ? `<a class="btn" href="${p.ctaUrl}">${p.ctaLabel} →</a>` : ''}
    </div>
  `, p.subject);
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.getOrThrow<string>('resendApiKey');
    this.resend = new Resend(apiKey);
    this.from = this.config.get<string>('emailFrom') ?? 'VendeoAI <noreply@vendeoai.com>';
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
        this.logger.error(`[EMAIL_SEND_FAILED] to=${to} subject="${subject}" err="${error.message}"`);
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
      'Votre code de vérification VendeoAI',
      verificationTemplate(payload.username, payload.code, expiresIn),
    );
  }

  async sendWelcomeEmail(payload: WelcomeEmailPayload): Promise<void> {
    await this.send(
      payload.to,
      'Bienvenue sur VendeoAI 🎉',
      welcomeTemplate(payload.username),
    );
  }

  async sendPasswordResetEmail(payload: PasswordResetEmailPayload): Promise<void> {
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

  async sendSystemNotification(payload: SystemNotificationEmailPayload): Promise<void> {
    await this.send(
      payload.to,
      payload.subject,
      systemNotificationTemplate(payload),
    );
  }
}
