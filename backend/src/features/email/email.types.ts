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
