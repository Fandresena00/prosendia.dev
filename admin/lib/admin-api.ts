// lib/admin-api.ts
// Client API complet — toutes les fonctions correspondent à des endpoints réels

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL}/admin`;

export class AdminApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function adminFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new AdminApiError(res.status, body.message ?? `Erreur ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AdminMe {
  sub: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN";
}

export const adminAuthApi = {
  login: (email: string, password: string) =>
    adminFetch<{ admin: AdminMe }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me:     () => adminFetch<{ admin: AdminMe }>("/auth/me"),
  logout: () => adminFetch<void>("/auth/logout", { method: "POST" }),
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface AdminDashboardStats {
  totalUsers: number;
  activeSubscriptions: number;
  suspendedUsers: number;
  newUsersToday: number;
  totalRevenue: number;
}

export interface ChartDataPoint {
  date: string;
  label: string;
  value: number;
}

export interface AdminDashboardCharts {
  newUsers: ChartDataPoint[];
  revenue: ChartDataPoint[];
  creditConsumption: ChartDataPoint[];
  planDistribution: { plan: string; count: number; pct: number }[];
  period: ChartPeriod;
  generatedAt: string;
}

export type ChartPeriod = "7d" | "30d" | "90d";

export const adminDashboardApi = {
  getStats:  () => adminFetch<AdminDashboardStats>("/dashboard"),
  getCharts: (period: ChartPeriod = "30d") =>
    adminFetch<AdminDashboardCharts>(`/dashboard/charts?period=${period}`),
};

// ─── Users ────────────────────────────────────────────────────────────────────

export interface AdminUserListItem {
  id: string;
  email: string;
  username: string;
  activePlan: string;
  creditBalance: number;
  isSuspended: boolean;
  emailVerified: boolean;
  createdAt: string;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface AdminUserDetail {
  user: AdminUserListItem & {
    suspendedAt: string | null;
    suspendedReason: string | null;
    provider: string;
    updatedAt: string;
  };
  subscription: {
    id: string;
    plan: string;
    status: string;
    periodStart: string;
    periodEnd: string;
    creditsGranted: number;
  } | null;
  businessProfiles: { id: string; name: string; businessType: string }[];
  usage: {
    aiRepliesTotal: number;
    postsManaged: number;
    conversationsTotal: number;
  };
  recentLedger: {
    id: string;
    type: string;
    amount: number;
    description: string | null;
    createdAt: string;
  }[];
  recentPayments: {
    id: string;
    amount: number;
    status: string;
    provider: string;
    createdAt: string;
  }[];
}

// ─── User stats ───────────────────────────────────────────────────────────────

export interface AdminUserSubscriptionStats {
  planId: string;
  planName: string;
  creditBalance: number;
  creditsGranted: number;
  creditRemainingPct: number;
  periodEnd: string | null;
  daysRemaining: number | null;
  pagesUsed: number;
  pagesLimit: number | null;
  postsManaged: number;
  postsLimit: number | null;
  referenceImages: number;
  imagesLimit: number | null;
}

export interface AdminUserAiStats {
  repliesToday: number;
  repliesThisMonth: number;
  repliesTotal: number;
  conversationsHandled: number;
  commentsHandled: number;
}

export interface AdminUserResponseRate {
  totalConversations: number;
  globalRate: number;
  aiRate: number;
  humanRate: number;
  unansweredCount: number;
}

export interface AdminUserActivityToday {
  messagesReceived: number;
  commentsReceived: number;
  aiRepliesSent: number;
  humanInterventions: number;
}

export interface AdminUserDailyActivity {
  date: string;
  day: string;
  messages: number;
  aiReplies: number;
  humanReplies: number;
  comments: number;
}

export interface AdminUserCreditDataPoint {
  date: string;
  day: string;
  creditsConsumed: number;
  aiReplies: number;
}

export interface AdminUserStatsResponse {
  subscription: AdminUserSubscriptionStats;
  aiStats: AdminUserAiStats;
  responseRate: AdminUserResponseRate;
  activityToday: AdminUserActivityToday;
  weeklyChart: AdminUserDailyActivity[];
  creditChart: AdminUserCreditDataPoint[];
  generatedAt: string;
}

export const adminUsersApi = {
  list: (params: {
    page?: number;
    pageSize?: number;
    search?: string;
    plan?: string;
    suspended?: boolean;
  }) => {
    const qs = new URLSearchParams();
    if (params.page)     qs.set("page",      String(params.page));
    if (params.pageSize) qs.set("pageSize",   String(params.pageSize));
    if (params.search)   qs.set("search",     params.search);
    if (params.plan)     qs.set("plan",       params.plan);
    if (params.suspended !== undefined)
      qs.set("suspended", String(params.suspended));
    return adminFetch<PaginatedResult<AdminUserListItem>>(`/users?${qs.toString()}`);
  },

  detail:       (id: string) => adminFetch<AdminUserDetail>(`/users/${id}`),
  getUserStats: (id: string) => adminFetch<AdminUserStatsResponse>(`/users/${id}/stats`),

  suspend:    (id: string, reason?: string) =>
    adminFetch(`/users/${id}/suspend`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  reactivate: (id: string) =>
    adminFetch(`/users/${id}/reactivate`, { method: "POST" }),
  remove:     (id: string) =>
    adminFetch(`/users/${id}`, { method: "DELETE" }),
  changePlan: (id: string, plan: string) =>
    adminFetch(`/users/${id}/plan`, {
      method: "PATCH",
      body: JSON.stringify({ plan }),
    }),
  adjustCredits: (id: string, amount: number, reason: string) =>
    adminFetch<{
      previousBalance: number;
      newBalance: number;
      applied: number;
    }>(`/users/${id}/credits/adjust`, {
      method: "POST",
      body: JSON.stringify({ amount, reason }),
    }),

  createCustomSubscription: (
    id: string,
    data: {
      credits: number;
      durationDays: number;
      priceAriary: number;
      maxPages: number;
      maxManagedPosts: number;
      maxReferenceImages: number;
      note?: string;
    },
  ) =>
    adminFetch<{
      subscriptionId: string;
      plan: string;
      credits: number;
      periodEnd: string;
      userId: string;
    }>(`/users/${id}/subscription/custom`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// ─── Admins management ────────────────────────────────────────────────────────

export interface AdminAccount {
  id: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN";
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export const adminManagementApi = {
  list:       () => adminFetch<AdminAccount[]>("/admins"),
  create:     (email: string, password: string) =>
    adminFetch<AdminAccount>("/admins", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  remove:     (id: string) => adminFetch(`/admins/${id}`, { method: "DELETE" }),
  activate:   (id: string) => adminFetch(`/admins/${id}/activate`,   { method: "PATCH" }),
  deactivate: (id: string) => adminFetch(`/admins/${id}/deactivate`, { method: "PATCH" }),
};

// ─── Admin audit logs ─────────────────────────────────────────────────────────

export interface AdminAuditLog {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AdminLogsQuery {
  page?: number;
  pageSize?: number;
  adminId?: string;
  action?: string;
  targetType?: string;
  from?: string;
  to?: string;
}

export const adminLogsApi = {
  list: (params: AdminLogsQuery = {}) => {
    const qs = new URLSearchParams();
    if (params.page)       qs.set("page",       String(params.page));
    if (params.pageSize)   qs.set("pageSize",    String(params.pageSize));
    if (params.adminId)    qs.set("adminId",     params.adminId);
    if (params.action)     qs.set("action",      params.action);
    if (params.targetType) qs.set("targetType",  params.targetType);
    if (params.from)       qs.set("from",        params.from);
    if (params.to)         qs.set("to",          params.to);
    return adminFetch<PaginatedResult<AdminAuditLog>>(`/logs?${qs.toString()}`);
  },
  listAdmins: () => adminFetch<{ id: string; email: string }[]>("/logs/admins"),
};

// ─── Custom plan templates ────────────────────────────────────────────────────

export interface CustomPlanTemplate {
  id: string;
  name: string;
  description: string | null;
  priceAriary: number;
  durationDays: number;
  credits: number;
  maxPages: number;
  maxManagedPosts: number;
  maxReferenceImages: number;
  isPublic: boolean;
  isActive: boolean;
  note: string | null;
  createdByAdminId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomPlanTemplatePayload {
  name: string;
  description?: string;
  priceAriary: number;
  durationDays?: number;
  credits: number;
  maxPages: number;
  maxManagedPosts: number;
  maxReferenceImages: number;
  isPublic?: boolean;
  note?: string;
}

export type UpdateCustomPlanTemplatePayload = Partial<CreateCustomPlanTemplatePayload>;

export const adminCustomPlansApi = {
  list: (includeInactive = false) =>
    adminFetch<CustomPlanTemplate[]>(
      `/custom-plans${includeInactive ? "?includeInactive=true" : ""}`,
    ),

  create: (data: CreateCustomPlanTemplatePayload) =>
    adminFetch<CustomPlanTemplate>("/custom-plans", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateCustomPlanTemplatePayload) =>
    adminFetch<CustomPlanTemplate>(`/custom-plans/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  toggle: (id: string) =>
    adminFetch<CustomPlanTemplate>(`/custom-plans/${id}/toggle`, {
      method: "PATCH",
    }),

  remove: (id: string) =>
    adminFetch<{ deleted: boolean; id: string }>(`/custom-plans/${id}`, {
      method: "DELETE",
    }),
};
