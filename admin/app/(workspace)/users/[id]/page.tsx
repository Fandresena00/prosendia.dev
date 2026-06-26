"use client";

// app/(workspace)/users/[id]/page.tsx
// Page détail utilisateur — stats réelles, graphiques, actions admin

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  adminUsersApi,
  type AdminUserDetail,
  type AdminUserStatsResponse,
} from "@/lib/admin-api";
import {
  ArrowLeft, ShieldAlert, ShieldCheck, Trash2,
  CreditCard, Zap, MessageSquare, BarChart2,
  Calendar, Bot, User, Layers,
} from "lucide-react";
import Link from "next/link";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">
      {children}
    </h2>
  );
}

function MetaCard({
  label,
  value,
  icon: Icon,
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function CustomTooltip({
  active, payload, label, formatter,
}: {
  active?: boolean;
  payload?: { value: number; name?: string }[];
  label?: string;
  formatter?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg text-xs">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="font-medium text-foreground">
          {p.name ? `${p.name}: ` : ""}{formatter ? formatter(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

const PLAN_LABELS: Record<string, string> = {
  FREE: "Gratuit", STARTER: "Starter", PRO: "Pro", CUSTOM: "Custom",
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [stats, setStats] = useState<AdminUserStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Dialogs
  const [creditDialog, setCreditDialog] = useState(false);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [planDialog, setPlanDialog] = useState(false);
  const [newPlan, setNewPlan] = useState("");

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      adminUsersApi.detail(id),
      adminUsersApi.getUserStats(id),
    ]).then(([d, s]) => {
      if (!cancelled) {
        setDetail(d);
        setStats(s);
      }
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => load(), [load]);

  async function handleSuspend() {
    setBusy(true);
    await adminUsersApi.suspend(id);
    setBusy(false);
    load();
  }

  async function handleReactivate() {
    setBusy(true);
    await adminUsersApi.reactivate(id);
    setBusy(false);
    load();
  }

  async function handleDelete() {
    setBusy(true);
    await adminUsersApi.remove(id);
    router.push("/users");
  }

  async function handleAdjustCredits() {
    const amount = parseFloat(creditAmount);
    if (isNaN(amount) || !creditReason.trim()) return;
    setBusy(true);
    await adminUsersApi.adjustCredits(id, amount, creditReason);
    setCreditDialog(false);
    setCreditAmount("");
    setCreditReason("");
    setBusy(false);
    load();
  }

  async function handleChangePlan() {
    if (!newPlan) return;
    setBusy(true);
    await adminUsersApi.changePlan(id, newPlan);
    setPlanDialog(false);
    setNewPlan("");
    setBusy(false);
    load();
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm text-muted-foreground">Utilisateur introuvable.</p>
        <Button variant="ghost" size="sm" className="mt-4" asChild>
          <Link href="/users">← Retour</Link>
        </Button>
      </div>
    );
  }

  const { user, subscription, businessProfiles, usage } = detail;
  const isSuspended = user.isSuspended;

  return (
    <div className="space-y-8">
      {/* Back + header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/users"
            className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Retour aux utilisateurs
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary ring-1 ring-primary/20">
              {user.email[0].toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                {user.username}
              </h1>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
            {isSuspended ? (
              <Badge variant="destructive">Suspendu</Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
              >
                Actif
              </Badge>
            )}
            <Badge variant="outline">
              {PLAN_LABELS[user.activePlan] ?? user.activePlan}
            </Badge>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPlanDialog(true)}
          >
            <Layers className="mr-1.5 h-3.5 w-3.5" />
            Changer de plan
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCreditDialog(true)}
          >
            <CreditCard className="mr-1.5 h-3.5 w-3.5" />
            Ajuster crédits
          </Button>

          {isSuspended ? (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={handleReactivate}
            >
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
              Réactiver
            </Button>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={busy}>
                  <ShieldAlert className="mr-1.5 h-3.5 w-3.5 text-orange-500" />
                  Suspendre
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Suspendre {user.email} ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    L&apos;utilisateur ne pourra plus se connecter. Vous pourrez le réactiver à tout moment.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={handleSuspend}>
                    Suspendre
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={busy}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer {user.email} ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action est irréversible. Toutes les données seront supprimées.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={handleDelete}
                >
                  Supprimer définitivement
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* ── Stats cards ─────────────────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetaCard
            label="Solde crédits"
            value={stats.subscription.creditBalance.toLocaleString("fr-FR")}
            icon={CreditCard}
            sub={`${stats.subscription.creditRemainingPct}% restants`}
          />
          <MetaCard
            label="Réponses IA totales"
            value={stats.aiStats.repliesTotal.toLocaleString("fr-FR")}
            icon={Bot}
          />
          <MetaCard
            label="Conversations"
            value={stats.responseRate.totalConversations.toLocaleString("fr-FR")}
            icon={MessageSquare}
            sub={`${stats.responseRate.globalRate}% de taux de réponse`}
          />
          <MetaCard
            label="Pages actives"
            value={`${stats.subscription.pagesUsed}${stats.subscription.pagesLimit ? ` / ${stats.subscription.pagesLimit}` : ""}`}
            icon={Layers}
          />
        </div>
      )}

      {/* ── Activité aujourd'hui ─────────────────────────────────────── */}
      {stats && (
        <div>
          <SectionTitle>Activité aujourd&apos;hui</SectionTitle>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetaCard label="Messages reçus" value={stats.activityToday.messagesReceived} icon={MessageSquare} />
            <MetaCard label="Commentaires" value={stats.activityToday.commentsReceived} icon={MessageSquare} />
            <MetaCard label="Réponses IA" value={stats.activityToday.aiRepliesSent} icon={Bot} />
            <MetaCard label="Interventions humaines" value={stats.activityToday.humanInterventions} icon={User} />
          </div>
        </div>
      )}

      {/* ── Charts ──────────────────────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Activité 7 jours */}
          <div className="rounded-xl border border-border bg-card p-5">
            <SectionTitle>Activité 7 derniers jours</SectionTitle>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={stats.weeklyChart} barSize={12}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={24} />
                <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--border))", opacity: 0.4 }} />
                <Bar dataKey="messages" name="Messages" stackId="a" fill="hsl(var(--chart-3))" radius={[0, 0, 0, 0]} />
                <Bar dataKey="aiReplies" name="Réponses IA" stackId="a" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Crédits 30 jours */}
          <div className="rounded-xl border border-border bg-card p-5">
            <SectionTitle>Consommation crédits 30 jours</SectionTitle>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={stats.creditChart}>
                <defs>
                  <linearGradient id="gradCredits" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={32} />
                <RechartsTooltip content={<CustomTooltip />} cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }} />
                <Area type="monotone" dataKey="creditsConsumed" name="Crédits" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#gradCredits)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Abonnement & profils ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Abonnement */}
        <div className="rounded-xl border border-border bg-card p-5">
          <SectionTitle>Abonnement</SectionTitle>
          {subscription ? (
            <div className="space-y-2 text-sm">
              <Row label="Plan" value={PLAN_LABELS[subscription.plan] ?? subscription.plan} />
              <Row label="Statut" value={subscription.status} />
              <Row
                label="Crédits accordés"
                value={subscription.creditsGranted.toLocaleString("fr-FR")}
              />
              <Row
                label="Période"
                value={`${new Date(subscription.periodStart).toLocaleDateString("fr-FR")} → ${new Date(subscription.periodEnd).toLocaleDateString("fr-FR")}`}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aucun abonnement actif.</p>
          )}
        </div>

        {/* Profils */}
        <div className="rounded-xl border border-border bg-card p-5">
          <SectionTitle>Profils métier ({businessProfiles.length})</SectionTitle>
          {businessProfiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun profil configuré.</p>
          ) : (
            <div className="space-y-2">
              {businessProfiles.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                  <span className="text-sm font-medium">{p.name}</span>
                  <span className="text-xs text-muted-foreground">{p.businessType}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Usage global ────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-5">
        <SectionTitle>Usage global</SectionTitle>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-semibold tabular-nums">{usage.aiRepliesTotal.toLocaleString("fr-FR")}</p>
            <p className="mt-1 text-xs text-muted-foreground">Réponses IA totales</p>
          </div>
          <div>
            <p className="text-2xl font-semibold tabular-nums">{usage.postsManaged.toLocaleString("fr-FR")}</p>
            <p className="mt-1 text-xs text-muted-foreground">Posts gérés</p>
          </div>
          <div>
            <p className="text-2xl font-semibold tabular-nums">{usage.conversationsTotal.toLocaleString("fr-FR")}</p>
            <p className="mt-1 text-xs text-muted-foreground">Conversations totales</p>
          </div>
        </div>
      </div>

      {/* ── Dialog : Ajuster crédits ─────────────────────────────────── */}
      <Dialog open={creditDialog} onOpenChange={setCreditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajuster les crédits</DialogTitle>
            <DialogDescription>
              Valeur positive pour ajouter, négative pour retirer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="credit-amount" className="text-xs uppercase tracking-wide text-muted-foreground">
                Montant
              </Label>
              <Input
                id="credit-amount"
                type="number"
                placeholder="ex: 500 ou -100"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="credit-reason" className="text-xs uppercase tracking-wide text-muted-foreground">
                Raison (obligatoire)
              </Label>
              <Input
                id="credit-reason"
                placeholder="Ex: Compensation suite à une erreur système"
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleAdjustCredits}
              disabled={busy || !creditAmount || !creditReason.trim()}
            >
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog : Changer de plan ─────────────────────────────────── */}
      <Dialog open={planDialog} onOpenChange={setPlanDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Changer de plan</DialogTitle>
            <DialogDescription>
              Plan actuel : <strong>{PLAN_LABELS[user.activePlan] ?? user.activePlan}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Nouveau plan
            </Label>
            <Select value={newPlan} onValueChange={setNewPlan}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Sélectionner un plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FREE">Gratuit</SelectItem>
                <SelectItem value="STARTER">Starter</SelectItem>
                <SelectItem value="PRO">Pro</SelectItem>
                <SelectItem value="CUSTOM">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleChangePlan} disabled={busy || !newPlan}>
              Appliquer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Row helper ───────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 pb-2 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
