// (workspace)/users/[id]/page.tsx

"use client";

import { adminUsersApi, type AdminUserDetail } from "@/lib/admin-api";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const PLANS = ["FREE", "STARTER", "PRO", "CUSTOM"];

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    adminUsersApi.detail(id).then(setDetail);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!detail) return <p className="text-sm text-zinc-500">Chargement…</p>;

  const {
    user,
    subscription,
    businessProfiles,
    usage,
    recentLedger,
    recentPayments,
  } = detail;

  async function handleSuspendToggle() {
    setBusy(true);
    try {
      if (user.isSuspended) await adminUsersApi.reactivate(id);
      else
        await adminUsersApi.suspend(
          id,
          prompt("Raison (optionnel)") ?? undefined,
        );
      load();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (
      !confirm(
        `Supprimer définitivement ${user.email} ? Cette action est irréversible.`,
      )
    )
      return;
    setBusy(true);
    try {
      await adminUsersApi.remove(id);
      router.push("/admin/users");
    } finally {
      setBusy(false);
    }
  }

  async function handlePlanChange(plan: string) {
    setBusy(true);
    try {
      await adminUsersApi.changePlan(id, plan);
      load();
    } finally {
      setBusy(false);
    }
  }

  async function handleAdjustCredits(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(creditAmount);
    if (!amount || !creditReason.trim()) return;
    setBusy(true);
    try {
      await adminUsersApi.adjustCredits(id, amount, creditReason);
      setCreditAmount("");
      setCreditReason("");
      load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">
            {user.username}
          </h1>
          <p className="text-sm text-zinc-500">{user.email}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSuspendToggle}
            disabled={busy}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-900 disabled:opacity-50"
          >
            {user.isSuspended ? "Réactiver" : "Suspendre"}
          </button>
          <button
            onClick={handleDelete}
            disabled={busy}
            className="rounded-lg border border-red-900 px-3 py-1.5 text-sm text-red-400 hover:bg-red-950 disabled:opacity-50"
          >
            Supprimer
          </button>
        </div>
      </div>

      {/* Informations générales */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-3 text-sm font-semibold text-zinc-300">
          Informations générales
        </h2>
        <div className="grid grid-cols-2 gap-y-2 text-sm">
          <span className="text-zinc-500">Inscrit le</span>
          <span className="text-zinc-200">
            {new Date(user.createdAt).toLocaleDateString("fr-FR")}
          </span>
          <span className="text-zinc-500">Email vérifié</span>
          <span className="text-zinc-200">
            {user.emailVerified ? "Oui" : "Non"}
          </span>
          <span className="text-zinc-500">Provider</span>
          <span className="text-zinc-200">{user.provider}</span>
          <span className="text-zinc-500">Statut</span>
          <span
            className={user.isSuspended ? "text-red-400" : "text-emerald-400"}
          >
            {user.isSuspended
              ? `Suspendu (${user.suspendedReason ?? "sans raison"})`
              : "Actif"}
          </span>
        </div>
      </section>

      {/* Abonnement */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-3 text-sm font-semibold text-zinc-300">Abonnement</h2>
        {subscription ? (
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <span className="text-zinc-500">Plan actuel</span>
            <span className="text-zinc-200">{subscription.plan}</span>
            <span className="text-zinc-500">Expire le</span>
            <span className="text-zinc-200">
              {new Date(subscription.periodEnd).toLocaleDateString("fr-FR")}
            </span>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">Aucun abonnement actif.</p>
        )}
        <div className="mt-3 flex gap-2">
          {PLANS.map((plan) => (
            <button
              key={plan}
              onClick={() => handlePlanChange(plan)}
              disabled={busy || user.activePlan === plan}
              className={`rounded-lg border px-3 py-1 text-xs ${
                user.activePlan === plan
                  ? "border-blue-600 bg-blue-950 text-blue-300"
                  : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              } disabled:opacity-50`}
            >
              {plan}
            </button>
          ))}
        </div>
      </section>

      {/* Crédits */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-3 text-sm font-semibold text-zinc-300">Crédits</h2>
        <p className="mb-4 text-2xl font-semibold text-zinc-100">
          {user.creditBalance.toLocaleString("fr-FR")}{" "}
          <span className="text-sm text-zinc-500">crédits</span>
        </p>
        <form
          onSubmit={handleAdjustCredits}
          className="flex flex-wrap items-end gap-2"
        >
          <div>
            <label className="mb-1 block text-xs text-zinc-500">
              Montant (+ / -)
            </label>
            <input
              type="number"
              value={creditAmount}
              onChange={(e) => setCreditAmount(e.target.value)}
              placeholder="ex: 50 ou -20"
              className="w-32 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-zinc-500">Raison</label>
            <input
              value={creditReason}
              onChange={(e) => setCreditReason(e.target.value)}
              placeholder="ex: Geste commercial"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            Appliquer
          </button>
        </form>
      </section>

      {/* Utilisation IA */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-3 text-sm font-semibold text-zinc-300">
          Utilisation IA
        </h2>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-zinc-500">Réponses IA totales</p>
            <p className="text-lg font-semibold text-zinc-100">
              {usage.aiRepliesTotal}
            </p>
          </div>
          <div>
            <p className="text-zinc-500">Posts gérés</p>
            <p className="text-lg font-semibold text-zinc-100">
              {usage.postsManaged}
            </p>
          </div>
          <div>
            <p className="text-zinc-500">Conversations</p>
            <p className="text-lg font-semibold text-zinc-100">
              {usage.conversationsTotal}
            </p>
          </div>
        </div>
        {businessProfiles.length > 0 && (
          <div className="mt-4 border-t border-zinc-800 pt-3">
            <p className="mb-2 text-xs text-zinc-500">Pages gérées</p>
            <ul className="space-y-1 text-sm text-zinc-300">
              {businessProfiles.map((p) => (
                <li key={p.id}>
                  {p.name}{" "}
                  <span className="text-zinc-500">({p.businessType})</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Historique récent */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-3 text-sm font-semibold text-zinc-300">
          Historique récent
        </h2>

        <p className="mb-1.5 text-xs uppercase tracking-wide text-zinc-600">
          Crédits
        </p>
        <ul className="mb-4 space-y-1.5 text-sm">
          {recentLedger.map((entry) => (
            <li key={entry.id} className="flex justify-between text-zinc-400">
              <span>{entry.description ?? entry.type}</span>
              <span
                className={
                  entry.amount >= 0 ? "text-emerald-400" : "text-red-400"
                }
              >
                {entry.amount >= 0 ? "+" : ""}
                {entry.amount}
              </span>
            </li>
          ))}
          {recentLedger.length === 0 && (
            <li className="text-zinc-600">Aucune entrée.</li>
          )}
        </ul>

        <p className="mb-1.5 text-xs uppercase tracking-wide text-zinc-600">
          Paiements
        </p>
        <ul className="space-y-1.5 text-sm">
          {recentPayments.map((p) => (
            <li key={p.id} className="flex justify-between text-zinc-400">
              <span>
                {p.provider} —{" "}
                {new Date(p.createdAt).toLocaleDateString("fr-FR")}
              </span>
              <span>
                {p.amount.toLocaleString("fr-FR")} Ar — {p.status}
              </span>
            </li>
          ))}
          {recentPayments.length === 0 && (
            <li className="text-zinc-600">Aucun paiement.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
