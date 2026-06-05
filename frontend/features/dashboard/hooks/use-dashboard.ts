/**
 * @file features/dashboard/hooks/use-dashboard.ts
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { dashboardService } from "../services/dashboard.service";
import type { DashboardData } from "../types/dashboard.types";

export function useDashboard() {
  const [data,      setData]      = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await dashboardService.getDashboard();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboard();
    // Refresh toutes les 5 minutes
    const interval = setInterval(() => void fetchDashboard(), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  const markRead = useCallback(async (ids?: string[], all?: boolean) => {
    await dashboardService.markRead(ids, all);
    setData((prev) => {
      if (!prev) return prev;
      const updated = prev.notifications.map((n) =>
        all || ids?.includes(n.id) ? { ...n, isRead: true } : n,
      );
      const newUnread = updated.filter((n) => !n.isRead).length;
      return { ...prev, notifications: updated, unreadCount: newUnread };
    });
  }, []);

  const deleteNotif = useCallback(async (id: string) => {
    await dashboardService.deleteNotification(id);
    setData((prev) => {
      if (!prev) return prev;
      const updated   = prev.notifications.filter((n) => n.id !== id);
      const newUnread = updated.filter((n) => !n.isRead).length;
      return { ...prev, notifications: updated, unreadCount: newUnread };
    });
  }, []);

  return {
    data,
    isLoading,
    error,
    refetch:     fetchDashboard,
    markRead,
    deleteNotif,
  };
}
