// (workspace)/users/page.tsx

"use client";

import {
  adminUsersApi,
  type AdminUserListItem,
  type PaginatedResult,
} from "@/lib/admin-api";
import Link from "next/link";
import { useEffect, useState } from "react";

const PLAN_LABELS: Record<string, string> = {
  FREE: "Gratuit",
  STARTER: "Starter",
  PRO: "Pro",
  CUSTOM: "Custom",
};

export default function AdminUsersPage() {
  const [result, setResult] =
    useState<PaginatedResult<AdminUserListItem> | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  function load() {
    adminUsersApi
      .list({ page, pageSize: 20, search: search || undefined })
      .then(setResult);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-100">Utilisateurs</h1>
        <form onSubmit={handleSearchSubmit}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par email ou nom…"
            className="w-72 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-blue-500"
          />
        </form>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Nom</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Crédits</th>
              <th className="px-4 py-3 font-medium">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {result?.data.map((user) => (
              <tr key={user.id} className="hover:bg-zinc-900/60">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="text-zinc-100 hover:underline"
                  >
                    {user.username}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-400">{user.email}</td>
                <td className="px-4 py-3 text-zinc-400">
                  {PLAN_LABELS[user.activePlan] ?? user.activePlan}
                </td>
                <td className="px-4 py-3 text-zinc-400">
                  {user.creditBalance.toLocaleString("fr-FR")}
                </td>
                <td className="px-4 py-3">
                  {user.isSuspended ? (
                    <span className="rounded-full bg-red-950 px-2 py-0.5 text-xs text-red-400">
                      Suspendu
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-950 px-2 py-0.5 text-xs text-emerald-400">
                      Actif
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {result && result.pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-zinc-500">
          <span>
            Page {result.pagination.page} / {result.pagination.totalPages} —{" "}
            {result.pagination.total} utilisateurs
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-zinc-800 px-3 py-1 disabled:opacity-30"
            >
              Précédent
            </button>
            <button
              disabled={page >= result.pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-zinc-800 px-3 py-1 disabled:opacity-30"
            >
              Suivant
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
