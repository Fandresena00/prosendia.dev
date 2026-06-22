"use client";

// app/(workspace)/users/[id]/page.tsx

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { adminUsersApi, type AdminUserDetail } from "@/lib/admin-api";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Bot,
  Building2,
  CreditCard,
  FileText,
  Loader2,
  MessageSquare,
  Minus,
  Plus,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const PLANS = ["FREE", "STARTER", "PRO", "CUSTOM"] as const;

const PLAN_STYLES: Record<string, string> = {
  FREE: "border-zinc-700 text-zinc-400",
  STARTER: "border-blue-700/40 text-blue-400",
  PRO: "border-emerald-700/40 text-emerald-400",
  CUSTOM: "border-purple-700/40 text-purple-400",
};

const PLAN_ACTIVE: Record<string, string> = {
  FREE: "border-zinc-600 bg-zinc-800 text-zinc-200",
  STARTER: "border-blue-600/60 bg-blue-950/60 text-blue-300",
  PRO: "border-emerald-600/60 bg-emerald-950/60 text-emerald-300",
  CUSTOM: "border-purple-600/60 bg-purple-950/60 text-purple-300",
};

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-[12px] text-zinc-500">{label}</span>
      <span className="text-[13px] text-zinc-200">{children}</span>
    </div>
  );
}

function UsageStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-zinc-800/40 p-3">
      <div className="rounded-md bg-zinc-800 p-2">
        <Icon className="h-3.5 w-3.5 text-zinc-400" />
      </div>
      <div>
        <p className="font-mono text-[15px] font-semibold tabular-nums text-zinc-100">
          {value.toLocaleString("fr-FR")}
        </p>
        <p className="text-[11px] text-zinc-500">{label}</p>
      </div>
    </div>
  );
}

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [suspendReason, setSuspendReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [creditOpen, setCreditOpen] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  function load() {
    adminUsersApi.detail(id).then(setDetail);
  }
  useEffect(() => {
    load();
  }, [id, load]);

  if (!detail) {
    return (
      <div className="max-w-4xl space-y-4">
        <Skeleton className="h-8 w-48 bg-zinc-800" />
        <Skeleton className="h-40 w-full bg-zinc-800" />
        <Skeleton className="h-40 w-full bg-zinc-800" />
      </div>
    );
  }

  const {
    user,
    subscription,
    businessProfiles,
    usage,
    recentLedger,
    recentPayments,
  } = detail;

  async function handleSuspend() {
    setBusy(true);
    try {
      await adminUsersApi.suspend(id, suspendReason || undefined);
      setSuspendOpen(false);
      load();
    } finally {
      setBusy(false);
      setSuspendReason("");
    }
  }

  async function handleReactivate() {
    setBusy(true);
    try {
      await adminUsersApi.reactivate(id);
      load();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      await adminUsersApi.remove(id);
      router.push("/users");
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
      setCreditOpen(false);
      setCreditAmount("");
      setCreditReason("");
      load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Back + header */}
      <div>
        <Link
          href="/users"
          className="mb-4 inline-flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Retour aux utilisateurs
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-[14px] font-semibold text-zinc-200">
                {user.username?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div>
                <h1 className="text-[18px] font-semibold tracking-tight text-zinc-100">
                  {user.username}
                </h1>
                <p className="text-[12px] text-zinc-500">{user.email}</p>
              </div>
              {user.isSuspended ? (
                <Badge
                  variant="outline"
                  className="border-red-900/50 bg-red-950/30 text-[11px] text-red-400"
                >
                  Suspendu
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-emerald-900/50 bg-emerald-950/30 text-[11px] text-emerald-400"
                >
                  Actif
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {user.isSuspended ? (
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={handleReactivate}
                className="h-8 border-zinc-700 bg-transparent text-[12px] text-zinc-300 hover:bg-zinc-900"
              >
                <UserCheck className="mr-1.5 h-3.5 w-3.5" />
                Réactiver
              </Button>
            ) : (
              <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    className="h-8 border-zinc-700 bg-transparent text-[12px] text-zinc-300 hover:bg-zinc-900"
                  >
                    <UserX className="mr-1.5 h-3.5 w-3.5" />
                    Suspendre
                  </Button>
                </DialogTrigger>
                <DialogContent className="border-zinc-800 bg-zinc-900 text-zinc-100">
                  <DialogHeader>
                    <DialogTitle className="text-[15px]">
                      Suspendre {user.username}
                    </DialogTitle>
                    <DialogDescription className="text-[13px] text-zinc-500">
                      L&apos;utilisateur ne pourra plus se connecter.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-1.5">
                    <Label className="text-[12px] text-zinc-400">
                      Raison (optionnel)
                    </Label>
                    <Input
                      value={suspendReason}
                      onChange={(e) => setSuspendReason(e.target.value)}
                      placeholder="ex: Violation des conditions d'utilisation"
                      className="border-zinc-800 bg-zinc-950 text-[13px] text-zinc-100 placeholder:text-zinc-600"
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSuspendOpen(false)}
                      className="text-zinc-400"
                    >
                      Annuler
                    </Button>
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={handleSuspend}
                      className="bg-amber-600 hover:bg-amber-500 text-[12px]"
                    >
                      {busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        "Suspendre"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  className="h-8 border-red-900/50 bg-transparent text-[12px] text-red-400 hover:bg-red-950/30"
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Supprimer
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="border-zinc-800 bg-zinc-900 text-zinc-100">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-[15px]">
                    Supprimer définitivement ?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-[13px] text-zinc-500">
                    Cette action est irréversible. Toutes les données de{" "}
                    <span className="font-medium text-zinc-300">
                      {user.email}
                    </span>{" "}
                    seront supprimées.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="border-zinc-800 bg-transparent text-zinc-400 hover:bg-zinc-900">
                    Annuler
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-red-600 hover:bg-red-500 text-[12px]"
                  >
                    Supprimer définitivement
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Left column — 2/3 */}
        <div className="col-span-2 space-y-4">
          {/* General info */}
          <Card className="border-zinc-800/60 bg-zinc-900/50">
            <CardHeader className="pb-0 pt-4">
              <CardTitle className="text-[13px] font-semibold text-zinc-300">
                Informations générales
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-zinc-800/60 px-5 pb-1">
              <InfoRow label="Inscrit le">
                {new Date(user.createdAt).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </InfoRow>
              <InfoRow label="Email vérifié">
                {user.emailVerified ? (
                  <span className="text-emerald-400">Oui</span>
                ) : (
                  <span className="text-amber-400">Non</span>
                )}
              </InfoRow>
              <InfoRow label="Méthode d'inscription">
                <Badge
                  variant="outline"
                  className="border-zinc-700 text-[11px] text-zinc-400"
                >
                  {user.provider}
                </Badge>
              </InfoRow>
              {user.isSuspended && user.suspendedReason && (
                <InfoRow label="Raison suspension">
                  <span className="text-red-400">{user.suspendedReason}</span>
                </InfoRow>
              )}
            </CardContent>
          </Card>

          {/* Plan */}
          <Card className="border-zinc-800/60 bg-zinc-900/50">
            <CardHeader className="pb-0 pt-4">
              <CardTitle className="text-[13px] font-semibold text-zinc-300">
                Abonnement
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              {subscription && (
                <div className="mb-4 divide-y divide-zinc-800/60">
                  <InfoRow label="Plan actuel">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[11px]",
                        PLAN_STYLES[subscription.plan],
                      )}
                    >
                      {subscription.plan}
                    </Badge>
                  </InfoRow>
                  <InfoRow label="Expire le">
                    {new Date(subscription.periodEnd).toLocaleDateString(
                      "fr-FR",
                    )}
                  </InfoRow>
                </div>
              )}
              {!subscription && (
                <p className="mb-4 text-[13px] text-zinc-600">
                  Aucun abonnement actif.
                </p>
              )}
              <div>
                <p className="mb-2 text-[11px] uppercase tracking-wider text-zinc-600">
                  Changer de plan
                </p>
                <div className="flex flex-wrap gap-2">
                  {PLANS.map((plan) => (
                    <button
                      key={plan}
                      onClick={() => handlePlanChange(plan)}
                      disabled={busy || user.activePlan === plan}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50",
                        user.activePlan === plan
                          ? PLAN_ACTIVE[plan]
                          : `${PLAN_STYLES[plan]} hover:opacity-80`,
                      )}
                    >
                      {plan}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Usage */}
          <Card className="border-zinc-800/60 bg-zinc-900/50">
            <CardHeader className="pb-0 pt-4">
              <CardTitle className="text-[13px] font-semibold text-zinc-300">
                Utilisation IA
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <div className="grid grid-cols-3 gap-3">
                <UsageStat
                  label="Réponses IA"
                  value={usage.aiRepliesTotal}
                  icon={Bot}
                />
                <UsageStat
                  label="Posts gérés"
                  value={usage.postsManaged}
                  icon={FileText}
                />
                <UsageStat
                  label="Conversations"
                  value={usage.conversationsTotal}
                  icon={MessageSquare}
                />
              </div>
              {businessProfiles.length > 0 && (
                <>
                  <Separator className="my-4 bg-zinc-800/60" />
                  <p className="mb-2 text-[11px] uppercase tracking-wider text-zinc-600">
                    Pages Facebook gérées
                  </p>
                  <div className="space-y-1.5">
                    {businessProfiles.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-2 text-[13px]"
                      >
                        <Building2 className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
                        <span className="text-zinc-300">{p.name}</span>
                        <span className="text-zinc-600">·</span>
                        <span className="text-zinc-500">{p.businessType}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column — 1/3 */}
        <div className="space-y-4">
          {/* Credits */}
          <Card className="border-zinc-800/60 bg-zinc-900/50">
            <CardHeader className="pb-0 pt-4">
              <CardTitle className="text-[13px] font-semibold text-zinc-300">
                Crédits
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <p className="mb-4">
                <span className="font-mono text-2xl font-semibold tabular-nums text-zinc-100">
                  {user.creditBalance.toLocaleString("fr-FR")}
                </span>
                <span className="ml-1.5 text-[12px] text-zinc-500">
                  crédits
                </span>
              </p>

              <Dialog open={creditOpen} onOpenChange={setCreditOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-zinc-700 bg-transparent text-[12px] text-zinc-300 hover:bg-zinc-800"
                  >
                    Ajuster les crédits
                  </Button>
                </DialogTrigger>
                <DialogContent className="border-zinc-800 bg-zinc-900 text-zinc-100">
                  <DialogHeader>
                    <DialogTitle className="text-[15px]">
                      Ajuster les crédits
                    </DialogTitle>
                    <DialogDescription className="text-[13px] text-zinc-500">
                      Utilisez un montant positif pour ajouter, négatif pour
                      retirer.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAdjustCredits} className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-[12px] text-zinc-400">
                        Montant (+/-)
                      </Label>
                      <div className="relative">
                        <div className="absolute left-0 top-0 flex h-full">
                          <button
                            type="button"
                            onClick={() =>
                              setCreditAmount((v) =>
                                String((Number(v) || 0) - 10),
                              )
                            }
                            className="flex h-full items-center px-2.5 text-zinc-500 hover:text-zinc-200"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <Input
                          type="number"
                          value={creditAmount}
                          onChange={(e) => setCreditAmount(e.target.value)}
                          placeholder="ex: 50"
                          className="border-zinc-800 bg-zinc-950 px-8 text-center text-[13px] text-zinc-100 placeholder:text-zinc-600"
                        />
                        <div className="absolute right-0 top-0 flex h-full">
                          <button
                            type="button"
                            onClick={() =>
                              setCreditAmount((v) =>
                                String((Number(v) || 0) + 10),
                              )
                            }
                            className="flex h-full items-center px-2.5 text-zinc-500 hover:text-zinc-200"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[12px] text-zinc-400">
                        Raison
                      </Label>
                      <Input
                        value={creditReason}
                        onChange={(e) => setCreditReason(e.target.value)}
                        placeholder="ex: Geste commercial"
                        className="border-zinc-800 bg-zinc-950 text-[13px] text-zinc-100 placeholder:text-zinc-600"
                      />
                    </div>
                    <DialogFooter>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={() => setCreditOpen(false)}
                        className="text-zinc-400"
                      >
                        Annuler
                      </Button>
                      <Button
                        type="submit"
                        size="sm"
                        disabled={busy || !creditAmount || !creditReason.trim()}
                        className="bg-emerald-600 hover:bg-emerald-500 text-[12px]"
                      >
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          "Appliquer"
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          {/* Recent ledger */}
          <Card className="border-zinc-800/60 bg-zinc-900/50">
            <CardHeader className="pb-0 pt-4">
              <CardTitle className="text-[13px] font-semibold text-zinc-300">
                Historique crédits
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              {recentLedger.length === 0 ? (
                <p className="text-[12px] text-zinc-600">Aucune entrée.</p>
              ) : (
                <div className="space-y-2">
                  {recentLedger.slice(0, 8).map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="min-w-0 truncate text-[12px] text-zinc-500">
                        {entry.description ?? entry.type}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 font-mono text-[12px] tabular-nums",
                          entry.amount >= 0
                            ? "text-emerald-400"
                            : "text-red-400",
                        )}
                      >
                        {entry.amount >= 0 ? "+" : ""}
                        {entry.amount}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent payments */}
          <Card className="border-zinc-800/60 bg-zinc-900/50">
            <CardHeader className="pb-0 pt-4">
              <CardTitle className="flex items-center gap-1.5 text-[13px] font-semibold text-zinc-300">
                <CreditCard className="h-3.5 w-3.5 text-zinc-500" />
                Paiements récents
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              {recentPayments.length === 0 ? (
                <p className="text-[12px] text-zinc-600">Aucun paiement.</p>
              ) : (
                <div className="space-y-2">
                  {recentPayments.slice(0, 5).map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-[12px] text-zinc-400">
                          {p.provider}
                        </p>
                        <p className="text-[11px] text-zinc-600">
                          {new Date(p.createdAt).toLocaleDateString("fr-FR")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-[12px] tabular-nums text-zinc-300">
                          {p.amount.toLocaleString("fr-FR")} Ar
                        </p>
                        <Badge
                          variant="outline"
                          className={cn(
                            "h-4 text-[10px]",
                            p.status === "SUCCESS"
                              ? "border-emerald-900/50 text-emerald-400"
                              : "border-zinc-700 text-zinc-500",
                          )}
                        >
                          {p.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
