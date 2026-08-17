import { baseTemplate, EMAIL_COLORS } from './base-template.js';

export function verificationTemplate(
  username: string,
  code: string,
  expiresIn: number,
): string {
  return baseTemplate(
    `
    <div class="card">
      <div style="width:48px;height:48px;background:${EMAIL_COLORS.primaryLight};border-radius:14px;display:flex;align-items:center;justify-content:center;margin-bottom:20px;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${EMAIL_COLORS.primary}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.75a16 16 0 006.29 6.29l1.1-1.1a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
        </svg>
      </div>
      <h1 class="card-title">Vérifiez votre email</h1>
      <p class="card-subtitle">
        Bonjour <strong style="color:${EMAIL_COLORS.foreground};">${username}</strong>,<br/>
        Utilisez ce code à 6 chiffres pour confirmer votre adresse email et activer votre compte Prosendia.
      </p>

      <div class="code-block">
        <div class="code-value">${code}</div>
        <div class="code-label">Code de vérification</div>
      </div>

      <div class="alert-box">
        <strong>⏱ Expire dans ${expiresIn} minutes.</strong> Si vous n'avez pas demandé ce code, ignorez cet email.
      </div>

      <div class="divider"></div>

      <p style="font-size:13px;color:${EMAIL_COLORS.mutedFg};line-height:1.7;">
        Ce code est à usage unique et ne peut pas être partagé. Ne le communiquez jamais à quelqu'un d'autre, même s'il prétend être de l'équipe Prosendia.
      </p>
    </div>
  `,
    `Votre code de vérification Prosendia : ${code}`,
  );
}
