// lib/admin-api.ts

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

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
  me: () => adminFetch<{ admin: AdminMe }>("/auth/me"),
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

export const adminDashboardApi = {
  getStats: () => adminFetch<AdminDashboardStats>("/dashboard"),
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

export const adminUsersApi = {
  list: (params: {
    page?: number;
    pageSize?: number;
    search?: string;
    plan?: string;
    suspended?: boolean;
  }) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.pageSize) qs.set("pageSize", String(params.pageSize));
    if (params.search) qs.set("search", params.search);
    if (params.plan) qs.set("plan", params.plan);
    if (params.suspended !== undefined)
      qs.set("suspended", String(params.suspended));
    return adminFetch<PaginatedResult<AdminUserListItem>>(
      `/users?${qs.toString()}`,
    );
  },
  detail: (id: string) => adminFetch<AdminUserDetail>(`/users/${id}`),
  suspend: (id: string, reason?: string) =>
    adminFetch(`/users/${id}/suspend`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  reactivate: (id: string) =>
    adminFetch(`/users/${id}/reactivate`, { method: "POST" }),
  remove: (id: string) => adminFetch(`/users/${id}`, { method: "DELETE" }),
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
};

// ─── Admins ───────────────────────────────────────────────────────────────────

export interface AdminAccount {
  id: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN";
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export const adminManagementApi = {
  list: () => adminFetch<AdminAccount[]>("/admins"),
  create: (email: string, password: string) =>
    adminFetch<AdminAccount>("/admins", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  remove: (id: string) => adminFetch(`/admins/${id}`, { method: "DELETE" }),
  activate: (id: string) =>
    adminFetch(`/admins/${id}/activate`, { method: "PATCH" }),
  deactivate: (id: string) =>
    adminFetch(`/admins/${id}/deactivate`, { method: "PATCH" }),
};

// ─── Plans (lecture seule — source = BILLING_PLANS backend) ───────────────────

export interface AdminPlan {
  id: string;
  name: string;
  priceAriary: number | null;
  durationDays: number;
  credits: number | null;
  maxPages: number | null;
  maxManagedPosts: number | null;
  maxReferenceImages: number | null;
  features: string[];
}

export const adminPlansApi = {
  list: () => adminFetch<AdminPlan[]>("/billing/plans"),
};
