/**
 * @file features/dashboard/types/dashboard.types.ts
 */

export interface DailyActivity {
  date:         string;
  day:          string;
  messages:     number;
  aiReplies:    number;
  humanReplies: number;
  comments:     number;
}

export interface AiStats {
  repliesToday:         number;
  repliesThisMonth:     number;
  conversationsHandled: number;
  commentsHandled:      number;
}

export interface ResponseRate {
  globalRate:      number;
  aiRate:          number;
  humanRate:       number;
  unansweredCount: number;
}

export interface ActivityToday {
  messagesReceived:   number;
  commentsReceived:   number;
  aiRepliesSent:      number;
  humanInterventions: number;
}

export interface SubscriptionUsage {
  planName:           string;
  planId:             string;
  creditBalance:      number;
  creditsGranted:     number | null;
  creditRemainingPct: number;
  creditIsLow:        boolean;
  creditIsCritical:   boolean;
  creditIsDepleted:   boolean;
  periodEnd:          string | null;
  daysRemaining:      number | null;
  pagesUsed:          number;
  pagesLimit:         number | null;
  postsManaged:       number;
  postsLimit:         number | null;
  referenceImages:    number;
  imagesLimit:        number | null;
}

export type NotificationSeverity = 'INFO' | 'WARNING' | 'CRITICAL' | 'SUCCESS';

export interface Notification {
  id:                 string;
  type:               string;
  severity:           NotificationSeverity;
  title:              string;
  message:            string;
  isRead:             boolean;
  createdAt:          string;
  conversationId:     string | null;
  postId:             string | null;
  commentId:          string | null;
  clientName:         string | null;
  conversationUrl:    string | null;
  facebookProfileUrl: string | null;
  postUrl:            string | null;
  commentUrl:         string | null;
  actionLabel:        string | null;
  actionUrl:          string | null;
}

export interface DashboardData {
  subscription:  SubscriptionUsage;
  aiStats:       AiStats;
  responseRate:  ResponseRate;
  activityToday: ActivityToday;
  weeklyChart:   DailyActivity[];
  notifications: Notification[];
  unreadCount:   number;
  criticalCount: number;
  generatedAt:   string;
}

export interface NotificationsPage {
  data:        Notification[];
  unreadCount: number;
  pagination:  { page: number; pageSize: number; total: number; totalPages: number };
}
