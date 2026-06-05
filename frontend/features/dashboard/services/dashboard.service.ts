/**
 * @file features/dashboard/services/dashboard.service.ts
 */

import { apiClient } from "@/lib/api-client";
import type { DashboardData, NotificationsPage } from "../types/dashboard.types";

interface NotifQuery {
  page?:       number;
  pageSize?:   number;
  severity?:   string;
  type?:       string;
  unreadOnly?: boolean;
  search?:     string;
}

export const dashboardService = {
  getDashboard(): Promise<DashboardData> {
    return apiClient<DashboardData>("/dashboard");
  },

  getNotifications(q: NotifQuery = {}): Promise<NotificationsPage> {
    const params = new URLSearchParams();
    if (q.page)       params.set("page",       String(q.page));
    if (q.pageSize)   params.set("pageSize",    String(q.pageSize));
    if (q.severity)   params.set("severity",    q.severity);
    if (q.type)       params.set("type",        q.type);
    if (q.unreadOnly) params.set("unreadOnly",  "true");
    if (q.search)     params.set("search",      q.search);
    const qs = params.toString();
    return apiClient<NotificationsPage>(`/dashboard/notifications${qs ? `?${qs}` : ""}`);
  },

  getUnreadCount(): Promise<{ count: number }> {
    return apiClient<{ count: number }>("/dashboard/notifications/unread-count");
  },

  markRead(ids?: string[], all?: boolean): Promise<void> {
    return apiClient<void>("/dashboard/notifications/read", {
      method: "POST",
      body:   JSON.stringify({ ids, all }),
    });
  },

  deleteNotification(id: string): Promise<void> {
    return apiClient<void>(`/dashboard/notifications/${id}`, { method: "DELETE" });
  },

  subscribePush(sub: PushSubscriptionJSON): Promise<void> {
    return apiClient<void>("/dashboard/push/subscribe", {
      method: "POST",
      body:   JSON.stringify({
        endpoint: sub.endpoint,
        p256dh:   (sub.keys as any)?.p256dh,
        auth:     (sub.keys as any)?.auth,
        userAgent: navigator.userAgent,
      }),
    });
  },
};
