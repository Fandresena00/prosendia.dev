import type { SystemNotificationEmailPayload } from '../email.types.js';
import { baseTemplate } from './base-template.js';

export function systemNotificationTemplate(
  p: SystemNotificationEmailPayload,
): string {
  return baseTemplate(
    `
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
  `,
    p.subject,
  );
}
