export const EMAIL_COLORS = {
  primary: '#4F5BD5',
  primaryLight: '#E8EAFB',
  primaryDark: '#3A45B8',
  background: '#0F1117',
  surface: '#1C1F2E',
  surfaceBorder: '#2A2D3E',
  foreground: '#F5F5FA',
  mutedFg: '#8B8FA8',
  success: '#34D399',
  successLight: '#0D2E24',
  warning: '#FB923C',
  destructive: '#F87171',
  white: '#FFFFFF',
} as const;

export function baseTemplate(content: string, previewText: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>Prosendia</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background-color: ${EMAIL_COLORS.background};
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      -webkit-font-smoothing: antialiased;
      color: ${EMAIL_COLORS.foreground};
    }
    .wrapper {
      width: 100%;
      background-color: ${EMAIL_COLORS.background};
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
      background: linear-gradient(135deg, ${EMAIL_COLORS.primary}, ${EMAIL_COLORS.primaryDark});
      border-radius: 10px;
      display: inline-block;
    }
    .logo-text {
      font-size: 16px;
      font-weight: 700;
      color: ${EMAIL_COLORS.foreground};
      letter-spacing: -0.3px;
    }
    .card {
      background-color: ${EMAIL_COLORS.surface};
      border: 1px solid ${EMAIL_COLORS.surfaceBorder};
      border-radius: 16px;
      padding: 40px 36px;
      margin-bottom: 24px;
    }
    .card-title {
      font-size: 22px;
      font-weight: 700;
      color: ${EMAIL_COLORS.foreground};
      letter-spacing: -0.4px;
      margin-bottom: 8px;
      line-height: 1.3;
    }
    .card-subtitle {
      font-size: 14px;
      color: ${EMAIL_COLORS.mutedFg};
      line-height: 1.6;
      margin-bottom: 28px;
    }
    .code-block {
      background: linear-gradient(135deg, #1a1d2e, #0f1117);
      border: 1px solid ${EMAIL_COLORS.primary}40;
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      margin: 24px 0;
      box-shadow: 0 0 0 1px ${EMAIL_COLORS.primary}20, inset 0 1px 0 ${EMAIL_COLORS.primary}15;
    }
    .code-value {
      font-size: 36px;
      font-weight: 700;
      letter-spacing: 10px;
      color: ${EMAIL_COLORS.white};
      font-family: 'Courier New', Courier, monospace;
    }
    .code-label {
      font-size: 11px;
      color: ${EMAIL_COLORS.mutedFg};
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin-top: 8px;
    }
    .btn {
      display: block;
      background: linear-gradient(135deg, ${EMAIL_COLORS.primary}, ${EMAIL_COLORS.primaryDark});
      color: ${EMAIL_COLORS.white} !important;
      text-decoration: none;
      padding: 14px 28px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      text-align: center;
      margin: 24px 0;
      box-shadow: 0 4px 16px ${EMAIL_COLORS.primary}40;
    }
    .divider {
      height: 1px;
      background: ${EMAIL_COLORS.surfaceBorder};
      margin: 24px 0;
    }
    .info-row {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid ${EMAIL_COLORS.surfaceBorder};
      font-size: 13px;
    }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: ${EMAIL_COLORS.mutedFg}; min-width: 120px; }
    .info-value { color: ${EMAIL_COLORS.foreground}; font-weight: 500; }
    .badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 99px;
      font-size: 11px;
      font-weight: 600;
    }
    .badge-primary {
      background: ${EMAIL_COLORS.primaryLight};
      color: ${EMAIL_COLORS.primary};
    }
    .badge-success {
      background: ${EMAIL_COLORS.successLight};
      color: ${EMAIL_COLORS.success};
    }
    .alert-box {
      background: rgba(79,91,213,0.08);
      border: 1px solid ${EMAIL_COLORS.primary}30;
      border-left: 3px solid ${EMAIL_COLORS.primary};
      border-radius: 8px;
      padding: 12px 16px;
      font-size: 13px;
      color: ${EMAIL_COLORS.mutedFg};
      line-height: 1.6;
      margin: 16px 0;
    }
    .alert-box strong { color: ${EMAIL_COLORS.foreground}; }
    .footer {
      text-align: center;
      font-size: 12px;
      color: ${EMAIL_COLORS.mutedFg};
      line-height: 1.7;
    }
    .footer a {
      color: ${EMAIL_COLORS.primary};
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
          <span class="logo-text">Prosendia</span>
        </div>
      </div>
      ${content}
      <div class="footer">
        <p>© ${new Date().getFullYear()} Prosendia · Automatisation IA pour vendeurs Facebook</p>
        <p style="margin-top:6px;">
          <a href="https://Prosendia.com/privacy">Confidentialité</a> ·
          <a href="https://Prosendia.com/terms">CGU</a> ·
          <a href="https://Prosendia.com/unsubscribe">Se désabonner</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}
