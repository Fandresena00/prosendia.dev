import { baseTemplate, EMAIL_COLORS } from './base-template.js';

export function welcomeTemplate(username: string): string {
  return baseTemplate(
    `
    <div class="card">
      <div style="width:48px;height:48px;background:${EMAIL_COLORS.successLight};border-radius:14px;display:flex;align-items:center;justify-content:center;margin-bottom:20px;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${EMAIL_COLORS.success}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      </div>
      <h1 class="card-title">Bienvenue sur Prosendia 🎉</h1>
      <p class="card-subtitle">
        Bonjour <strong style="color:${EMAIL_COLORS.foreground};">${username}</strong>,<br/>
        Votre compte est activé. Vous pouvez maintenant connecter vos pages Facebook et laisser l'IA répondre à vos clients automatiquement.
      </p>

      <a class="btn" href="https://Prosendia.com/dashboard">
        Accéder à mon tableau de bord →
      </a>

      <div class="divider"></div>

      <p style="font-size:13px;font-weight:600;color:${EMAIL_COLORS.foreground};margin-bottom:14px;">Pour bien démarrer :</p>
      ${[
        ['1', 'Connectez votre page Facebook', 'Paramètres → Pages Facebook'],
        ['2', 'Configurez votre assistant IA', 'Profil business → Description'],
        ['3', 'Activez les réponses automatiques', 'Inbox → Mode IA'],
      ]
        .map(
          ([n, title, sub]) => `
      <div style="display:flex;gap:14px;align-items:flex-start;margin-bottom:14px;">
        <div style="min-width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,${EMAIL_COLORS.primary},${EMAIL_COLORS.primaryDark});display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:white;">${n}</div>
        <div>
          <div style="font-size:13px;font-weight:600;color:${EMAIL_COLORS.foreground};">${title}</div>
          <div style="font-size:12px;color:${EMAIL_COLORS.mutedFg};">${sub}</div>
        </div>
      </div>`,
        )
        .join('')}
    </div>
  `,
    'Bienvenue sur Prosendia — votre compte est activé !',
  );
}
