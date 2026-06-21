// (workspace)/admins/page.tsx

"use client";

import {
  AdminApiError,
  adminManagementApi,
  type AdminAccount,
} from "@/lib/admin-api";
import { useEffect, useState } from "react";

export default function AdminAdminsPage() {
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    adminManagementApi.list().then(setAdmins);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await adminManagementApi.create(email, password);
      setEmail("");
      setPassword("");
      load();
    } catch (err) {
      setError(
        err instanceof AdminApiError
          ? err.message
          : "Erreur lors de la création.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string, accountEmail: string) {
    if (!confirm(`Supprimer l'administrateur ${accountEmail} ?`)) return;
    setBusy(true);
    try {
      await adminManagementApi.remove(id);
      load();
    } catch (err) {
      setError(
        err instanceof AdminApiError ? err.message : "Suppression impossible.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleToggle(admin: AdminAccount) {
    setBusy(true);
    try {
      if (admin.isActive) await adminManagementApi.deactivate(admin.id);
      else await adminManagementApi.activate(admin.id);
      load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-lg font-semibold text-zinc-100">
        Administrateurs
      </h1>

      <section className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-3 text-sm font-semibold text-zinc-300">
          Ajouter un administrateur
        </h2>
        {error && (
          <div className="mb-3 rounded-lg border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}
        <form
          onSubmit={handleCreate}
          className="flex flex-wrap items-end gap-2"
        >
          <div className="flex-1">
            <label className="mb-1 block text-xs text-zinc-500">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-zinc-500">
              Mot de passe
            </label>
            <input
              type="password"
              required
              minLength={10}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            Créer
          </button>
        </form>
      </section>

      <div className="overflow-hidden rounded-xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Rôle</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 font-medium">Dernière connexion</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {admins.map((admin) => (
              <tr key={admin.id} className="hover:bg-zinc-900/60">
                <td className="px-4 py-3 text-zinc-200">{admin.email}</td>
                <td className="px-4 py-3 text-zinc-400">
                  {admin.role === "SUPER_ADMIN" ? "Super admin" : "Admin"}
                </td>
                <td className="px-4 py-3">
                  {admin.isActive ? (
                    <span className="rounded-full bg-emerald-950 px-2 py-0.5 text-xs text-emerald-400">
                      Actif
                    </span>
                  ) : (
                    <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                      Désactivé
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-500">
                  {admin.lastLoginAt
                    ? new Date(admin.lastLoginAt).toLocaleDateString("fr-FR")
                    : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  {admin.role !== "SUPER_ADMIN" && (
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleToggle(admin)}
                        disabled={busy}
                        className="text-xs text-zinc-400 hover:text-zinc-200"
                      >
                        {admin.isActive ? "Désactiver" : "Activer"}
                      </button>
                      <button
                        onClick={() => handleDelete(admin.id, admin.email)}
                        disabled={busy}
                        className="text-xs text-red-500 hover:text-red-400"
                      >
                        Supprimer
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
