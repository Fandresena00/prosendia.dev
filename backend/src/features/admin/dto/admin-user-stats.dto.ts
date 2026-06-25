// src/features/admin/dto/admin-user-stats.dto.ts
//
// DTOs pour les statistiques détaillées d'un utilisateur côté admin.
// Calqués sur dashboard.dto.ts mais indépendants — le feature admin ne doit
// jamais importer depuis le feature dashboard.

// ─── Abonnement & crédits ─────────────────────────────────────────────────────

export interface AdminUserSubscriptionDto {
  planId: string;
  planName: string;
  creditBalance: number;
  creditsGranted: number;
  creditRemainingPct: number;
  periodEnd: Date | null;
  daysRemaining: number | null;
  // Limites du plan
  pagesUsed: number;
  pagesLimit: number | null;
  postsManaged: number;
  postsLimit: number | null;
  referenceImages: number;
  imagesLimit: number | null;
}

// ─── Stats IA ─────────────────────────────────────────────────────────────────

export interface AdminUserAiStatsDto {
  repliesToday: number;
  repliesThisMonth: number;
  repliesTotal: number;
  conversationsHandled: number;
  commentsHandled: number;
}

// ─── Taux de réponse ──────────────────────────────────────────────────────────

export interface AdminUserResponseRateDto {
  totalConversations: number;
  globalRate: number;   // % conversations avec au moins une réponse (AI ou human)
  aiRate: number;       // % conversations gérées par IA
  humanRate: number;    // % conversations gérées manuellement
  unansweredCount: number;
}

// ─── Activité du jour ─────────────────────────────────────────────────────────

export interface AdminUserActivityTodayDto {
  messagesReceived: number;
  commentsReceived: number;
  aiRepliesSent: number;
  humanInterventions: number;
}

// ─── Graphiques temporels ─────────────────────────────────────────────────────

export interface AdminUserDailyActivityDto {
  date: string;         // "YYYY-MM-DD"
  day: string;          // "Lun", "Mar"…
  messages: number;
  aiReplies: number;
  humanReplies: number;
  comments: number;
}

// ─── Graphiques crédits ───────────────────────────────────────────────────────

export interface AdminUserCreditDataPointDto {
  date: string;         // "YYYY-MM-DD"
  day: string;
  creditsConsumed: number;
  aiReplies: number;
}

// ─── Réponse complète stats ───────────────────────────────────────────────────

export interface AdminUserStatsResponseDto {
  subscription: AdminUserSubscriptionDto;
  aiStats: AdminUserAiStatsDto;
  responseRate: AdminUserResponseRateDto;
  activityToday: AdminUserActivityTodayDto;
  weeklyChart: AdminUserDailyActivityDto[];
  creditChart: AdminUserCreditDataPointDto[];  // 30 derniers jours
  generatedAt: Date;
}
