import { baseTemplate, EMAIL_COLORS } from './base-template.js';

export function passwordResetTemplate(
  username: string,
  resetUrl: string,
  expiresIn: number,
): string {
  return baseTemplate(
    `
    <div class="card">
      <div style="width:48px;height:48px;background:${EMAIL_COLORS.primaryLight};border-radius:14px;display:flex;align-items:center;justify-content:center;margin-bottom:20px;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${EMAIL_COLORS.primary}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
        </svg>
      </div>
      <h1 class="card-title">Réinitialisez votre mot de passe</h1>
      <p class="card-subtitle">
        Bonjour <strong style="color:${EMAIL_COLORS.foreground};">${username}</strong>,<br/>
        Nous avons reçu une demande de réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour en créer un nouveau.
      </p>

      <a class="btn" href="${resetUrl}">
        Réinitialiser mon mot de passe →
      </a>

      <div class="alert-box">
        <strong>⏱ Ce lien expire dans ${expiresIn} minutes.</strong> Si vous n'avez pas fait cette demande, ignorez cet email — votre mot de passe ne sera pas modifié.
      </div>

      <div class="divider"></div>

      <p style="font-size:12px;color:${EMAIL_COLORS.mutedFg};line-height:1.7;word-break:break-all;">
        Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br/>
        <span style="color:${EMAIL_COLORS.primary};">${resetUrl}</span>
      </p>
    </div>
  `,
    'Réinitialisez votre mot de passe Prosendia',
  );
}
