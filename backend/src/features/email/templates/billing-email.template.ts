import type { BillingEmailPayload } from '../email.types.js';
import { baseTemplate, EMAIL_COLORS } from './base-template.js';

export function billingTemplate(p: BillingEmailPayload): string {
  return baseTemplate(
    `
    <div class="card">
      <div style="width:48px;height:48px;background:${EMAIL_COLORS.successLight};border-radius:14px;display:flex;align-items:center;justify-content:center;margin-bottom:20px;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${EMAIL_COLORS.success}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
        </svg>
      </div>
      <h1 class="card-title">Confirmation d'abonnement</h1>
      <p class="card-subtitle">
        Bonjour <strong style="color:${EMAIL_COLORS.foreground};">${p.username}</strong>, votre paiement a bien été traité.
      </p>

      <div style="background:#12151f;border:1px solid ${EMAIL_COLORS.surfaceBorder};border-radius:12px;padding:20px;margin:20px 0;">
        <div class="info-row">
          <span class="info-label">Plan</span>
          <span class="info-value"><span class="badge badge-primary">${p.planName}</span></span>
        </div>
        <div class="info-row">
          <span class="info-label">Montant</span>
          <span class="info-value" style="color:${EMAIL_COLORS.success};font-weight:700;">${p.amount}</span>
        </div>
        ${
          p.nextBillingDate
            ? `
        <div class="info-row">
          <span class="info-label">Prochain débit</span>
          <span class="info-value">${p.nextBillingDate}</span>
        </div>`
            : ''
        }
        <div class="info-row">
          <span class="info-label">Statut</span>
          <span class="info-value"><span class="badge badge-success">✓ Payé</span></span>
        </div>
      </div>

      ${p.invoiceUrl ? `<a class="btn" href="${p.invoiceUrl}">Télécharger ma facture →</a>` : ''}
    </div>
  `,
    `Confirmation paiement ${p.planName} — ${p.amount}`,
  );
}
