// (workspace)/dashboard/page.tsx

"use client";

import { adminDashboardApi, type AdminDashboardStats } from "@/lib/admin-api";
import { useEffect, useState } from "react";

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${accent ?? "text-zinc-100"}`}>
        {value}
      </p>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);

  useEffect(() => {
    adminDashboardApi
      .getStats()
      .then(setStats)
      .catch(() => {});
  }, []);

  return (
    <div>
      <h1 className="mb-6 text-lg font-semibold text-zinc-100">Dashboard</h1>

      {!stats ? (
        <p className="text-sm text-zinc-500">Chargement…</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatCard
            label="Utilisateurs totaux"
            value={String(stats.totalUsers)}
          />
          <StatCard
            label="Abonnements actifs"
            value={String(stats.activeSubscriptions)}
            accent="text-emerald-400"
          />
          <StatCard
            label="Utilisateurs suspendus"
            value={String(stats.suspendedUsers)}
            accent="text-amber-400"
          />
          <StatCard
            label="Nouveaux aujourd'hui"
            value={String(stats.newUsersToday)}
          />
          <StatCard
            label="Revenu total"
            value={`${stats.totalRevenue.toLocaleString("fr-FR")} Ar`}
            accent="text-blue-400"
          />
        </div>
      )}
    </div>
  );
}
