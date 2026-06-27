"use client";

// app/(workspace)/users/[id]/page.tsx
// Bugs fixes:
//   1. Crédits mis à jour séparément après changement de plan (rechargement stats uniquement)
//   2. Actions ne déclenchent plus de full-page loading flash (busy spinner local)
//   3. Dialog plan redesigné avec comparaison visuelle des plans
//   4. Dialog Custom Plan avec tous les champs
//   5. Données temps réel : les stat cards se mettent à jour sans skeleton complet

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  adminUsersApi,
  type AdminUserDetail,
  type AdminUserStatsResponse,
} from "@/lib/admin-api";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  Check,
  CreditCard,
  Crown,
  Layers,
  Loader2,
  MessageSquare,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  User,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

// ─── Plan config (miroir de billing.constants.ts — admin est indépendant) ─────

// Typage explicite pour éviter l'erreur "popular does not exist" sur les plans sans cette propriété
interface PlanConfig {
  id: string;
  label: string;
  price: string;
  credits: number | null;
  pages: number | null;
  posts: number | null;
  images: number | null;
  color: string;
  badge: "secondary" | "outline" | "default";
  popular?: boolean;
}

const PLANS: Record<string, PlanConfig> = {
  FREE: {
    id: "FREE",
    label: "Gratuit",
    price: "Gratuit",
    credits: 500,
    pages: 1,
    posts: 1,
    images: 5,
    color: "text-muted-foreground",
    badge: "secondary",
  },
  STARTER: {
    id: "STARTER",
    label: "Starter",
    price: "15 000 Ar/mois",
    credits: 8_000,
    pages: 2,
    posts: 10,
    images: 25,
    color: "text-blue-500",
    badge: "outline",
  },
  PRO: {
    id: "PRO",
    label: "Pro",
    price: "27 000 Ar/mois",
    credits: 20_000,
    pages: 4,
    posts: 20,
    images: 100,
    color: "text-primary",
    badge: "default",
    popular: true,
  },
  CUSTOM: {
    id: "CUSTOM",
    label: "Custom",
    price: "Sur mesure",
    credits: null,
    pages: null,
    posts: null,
    images: null,
    color: "text-yellow-500",
    badge: "outline",
  },
};

type PlanId = keyof typeof PLANS;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/50">
      {children}
    </h2>
  );
}

function MetaCard({
  label,
  value,
  icon: Icon,
  sub,
  loading = false,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  sub?: string;
  loading?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70 mb-2.5">
        <Icon className="h-3 w-3" />
        <span>{label}</span>
      </div>
      {loading ? (
        <Skeleton className="h-7 w-16" />
      ) : (
        <p className="text-[22px] font-semibold tracking-tight text-foreground tabular-nums leading-none">
          {value}
        </p>
      )}
      {sub && !loading && (
        <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; name?: string; color?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 shadow-xl text-xs">
      <p className="text-muted-foreground mb-1.5 font-medium">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: p.color }}
          />
          <span className="text-foreground">
            {p.name ? `${p.name}: ` : ""}
            <strong>{p.value}</strong>
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Plan selector card ───────────────────────────────────────────────────────

function PlanCard({
  plan,
  selected,
  current,
  onClick,
}: {
  plan: PlanConfig;
  selected: boolean;
  current: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative w-full rounded-lg border p-3.5 text-left transition-all duration-150",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
          : "border-border bg-card hover:border-border/80 hover:bg-muted/30",
        current && !selected && "opacity-60",
      )}
    >
      {plan.popular && (
        <span className="absolute -top-2 right-3 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
          Populaire
        </span>
      )}
      {plan.id === "CUSTOM" && (
        <Crown className="absolute right-3 top-3 h-3.5 w-3.5 text-yellow-500" />
      )}
      <div className="flex items-start justify-between">
        <div>
          <p className={cn("text-sm font-semibold", plan.color)}>
            {plan.label}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {plan.price}
          </p>
        </div>
        <div
          className={cn(
            "flex h-4 w-4 items-center justify-center rounded-full border transition-colors",
            selected ? "border-primary bg-primary" : "border-border",
          )}
        >
          {selected && (
            <Check className="h-2.5 w-2.5 text-primary-foreground" />
          )}
        </div>
      </div>
      {plan.credits !== null ? (
        <div className="mt-2.5 grid grid-cols-2 gap-1">
          {[
            { label: "Crédits", val: plan.credits?.toLocaleString("fr-FR") },
            { label: "Pages", val: plan.pages },
            { label: "Posts", val: plan.posts },
            { label: "Images", val: plan.images },
          ].map((item) => (
            <div key={item.label} className="rounded bg-muted/50 px-2 py-1">
              <p className="text-[10px] text-muted-foreground">{item.label}</p>
              <p className="text-xs font-semibold text-foreground">
                {item.val}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-muted-foreground italic">
          Limites définies manuellement ci-dessous
        </p>
      )}
      {current && (
        <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="h-1 w-1 rounded-full bg-emerald-500" />
          Plan actuel
        </div>
      )}
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [stats, setStats] = useState<AdminUserStatsResponse | null>(null);

  // Loading states séparés pour éviter les flash
  const [initialLoading, setInitialLoading] = useState(true);
  const [statsRefreshing, setStatsRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dialog : Ajuster crédits
  const [creditDialog, setCreditDialog] = useState(false);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");

  // Dialog : Changer de plan
  const [planDialog, setPlanDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanId | "">("");
  // Champs Custom
  const [customCredits, setCustomCredits] = useState("");
  const [customDays, setCustomDays] = useState("30");
  const [customPrice, setCustomPrice] = useState("");
  const [customPages, setCustomPages] = useState("");
  const [customPosts, setCustomPosts] = useState("");
  const [customImages, setCustomImages] = useState("");
  const [customNote, setCustomNote] = useState("");

  // ── Loaders ───────────────────────────────────────────────────────────────

  // Chargement complet (initial + après actions lourdes)
  const loadAll = useCallback(() => {
    let cancelled = false;
    setInitialLoading(true);
    setError(null);
    Promise.all([adminUsersApi.detail(id), adminUsersApi.getUserStats(id)])
      .then(([d, s]) => {
        if (!cancelled) {
          setDetail(d);
          setStats(s);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Erreur de chargement.");
      })
      .finally(() => {
        if (!cancelled) setInitialLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Rechargement stats seules (après ajustement crédits / changement plan)
  // → ne déclenche PAS le skeleton complet
  const refreshStats = useCallback(() => {
    let cancelled = false;
    setStatsRefreshing(true);
    Promise.all([adminUsersApi.detail(id), adminUsersApi.getUserStats(id)])
      .then(([d, s]) => {
        if (!cancelled) {
          setDetail(d);
          setStats(s);
        }
      })
      .finally(() => {
        if (!cancelled) setStatsRefreshing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => loadAll(), [loadAll]);

  // ── Actions ───────────────────────────────────────────────────────────────

  async function handleSuspend() {
    setBusy(true);
    try {
      await adminUsersApi.suspend(id);
      refreshStats();
    } finally {
      setBusy(false);
    }
  }

  async function handleReactivate() {
    setBusy(true);
    try {
      await adminUsersApi.reactivate(id);
      refreshStats();
    } finally {
      setBusy(false);
    }
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
    try {
      await adminUsersApi.adjustCredits(id, amount, creditReason);
      setCreditDialog(false);
      setCreditAmount("");
      setCreditReason("");
      // Refresh stats uniquement — pas de skeleton complet
      refreshStats();
    } finally {
      setBusy(false);
    }
  }

  async function handleChangePlan() {
    if (!selectedPlan) return;
    setBusy(true);
    try {
      if (selectedPlan === "CUSTOM") {
        // Appel endpoint custom subscription
        await adminUsersApi.createCustomSubscription(id, {
          credits: parseInt(customCredits),
          durationDays: parseInt(customDays),
          priceAriary: parseInt(customPrice) || 0,
          maxPages: parseInt(customPages),
          maxManagedPosts: parseInt(customPosts),
          maxReferenceImages: parseInt(customImages),
          note: customNote || undefined,
        });
      } else {
        await adminUsersApi.changePlan(id, selectedPlan);
      }
      setPlanDialog(false);
      setSelectedPlan("");
      resetCustomFields();
      // FIX : refresh stats ET detail → crédits mis à jour
      refreshStats();
    } finally {
      setBusy(false);
    }
  }

  function resetCustomFields() {
    setCustomCredits("");
    setCustomDays("30");
    setCustomPrice("");
    setCustomPages("");
    setCustomPosts("");
    setCustomImages("");
    setCustomNote("");
  }

  function openPlanDialog() {
    setSelectedPlan((detail?.user.activePlan as PlanId) ?? "");
    resetCustomFields();
    setPlanDialog(true);
  }

  // ── Renders ───────────────────────────────────────────────────────────────

  if (initialLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-56" />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertCircle className="mb-3 h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm font-medium text-foreground">
          {error ?? "Utilisateur introuvable"}
        </p>
        <Button variant="ghost" size="sm" className="mt-4" asChild>
          <Link href="/users">
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
            Retour
          </Link>
        </Button>
      </div>
    );
  }

  const { user, subscription, businessProfiles, usage } = detail;
  const currentPlan = user.activePlan as PlanId;

  return (
    <div className="space-y-6 pb-12">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/users"
            className="mb-3 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/60 transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            Utilisateurs
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary ring-1 ring-primary/20">
              {user.email[0].toUpperCase()}
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight leading-tight">
                {user.username}
              </h1>
              <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                {user.email}
              </p>
            </div>
            <div className="flex items-center gap-1.5 ml-1">
              {user.isSuspended ? (
                <Badge variant="destructive" className="text-xs">
                  Suspendu
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 text-xs"
                >
                  Actif
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                {PLANS[currentPlan]?.label ?? currentPlan}
              </Badge>
              {statsRefreshing && (
                <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground/50" />
              )}
            </div>
          </div>
        </div>

        {/* Actions toolbar */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={openPlanDialog}
          >
            <Layers className="mr-1.5 h-3.5 w-3.5" />
            Changer plan
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setCreditDialog(true)}
          >
            <CreditCard className="mr-1.5 h-3.5 w-3.5" />
            Crédits
          </Button>
          {user.isSuspended ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              disabled={busy}
              onClick={handleReactivate}
            >
              {busy ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="mr-1.5 h-3.5 w-3.5 text-emerald-500" />
              )}
              Réactiver
            </Button>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={busy}
                >
                  <ShieldAlert className="mr-1.5 h-3.5 w-3.5 text-orange-500" />
                  Suspendre
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Suspendre {user.email} ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    L&apos;utilisateur ne pourra plus accéder à la plateforme.
                    Vous pourrez le réactiver à tout moment.
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
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                disabled={busy}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer {user.email} ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action est irréversible. Toutes les données seront
                  définitivement supprimées.
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
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetaCard
          label="Solde crédits"
          value={
            stats?.subscription.creditBalance.toLocaleString("fr-FR") ?? "—"
          }
          icon={CreditCard}
          sub={
            stats
              ? `${stats.subscription.creditRemainingPct}% restants`
              : undefined
          }
          loading={statsRefreshing}
        />
        <MetaCard
          label="Réponses IA"
          value={stats?.aiStats.repliesTotal.toLocaleString("fr-FR") ?? "—"}
          icon={Bot}
          loading={statsRefreshing}
        />
        <MetaCard
          label="Conversations"
          value={
            stats?.responseRate.totalConversations.toLocaleString("fr-FR") ??
            "—"
          }
          icon={MessageSquare}
          sub={stats ? `${stats.responseRate.globalRate}% répondus` : undefined}
          loading={statsRefreshing}
        />
        <MetaCard
          label="Pages actives"
          value={
            stats
              ? `${stats.subscription.pagesUsed}${stats.subscription.pagesLimit ? ` / ${stats.subscription.pagesLimit}` : ""}`
              : "—"
          }
          icon={Layers}
          loading={statsRefreshing}
        />
      </div>

      {/* ── Activité aujourd'hui ─────────────────────────────────────── */}
      {stats && (
        <div>
          <SectionTitle>Activité aujourd&apos;hui</SectionTitle>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetaCard
              label="Messages reçus"
              value={stats.activityToday.messagesReceived}
              icon={MessageSquare}
              loading={statsRefreshing}
            />
            <MetaCard
              label="Commentaires"
              value={stats.activityToday.commentsReceived}
              icon={MessageSquare}
              loading={statsRefreshing}
            />
            <MetaCard
              label="Réponses IA"
              value={stats.activityToday.aiRepliesSent}
              icon={Bot}
              loading={statsRefreshing}
            />
            <MetaCard
              label="Interventions humaines"
              value={stats.activityToday.humanInterventions}
              icon={User}
              loading={statsRefreshing}
            />
          </div>
        </div>
      )}

      {/* ── Charts ──────────────────────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-5">
            <SectionTitle>Activité 7 jours</SectionTitle>
            <ResponsiveContainer width="100%" height={176}>
              <BarChart
                data={stats.weeklyChart}
                barSize={10}
                barCategoryGap="30%"
              >
                <CartesianGrid
                  stroke="hsl(var(--border))"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  width={22}
                />
                <RechartsTooltip
                  content={<ChartTooltip />}
                  cursor={{ fill: "hsl(var(--border))", opacity: 0.3 }}
                />
                <Bar
                  dataKey="messages"
                  name="Messages"
                  stackId="a"
                  fill="hsl(var(--muted-foreground)/0.3)"
                />
                <Bar
                  dataKey="aiReplies"
                  name="Réponses IA"
                  stackId="a"
                  fill="hsl(var(--primary))"
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <SectionTitle>Crédits 30 jours</SectionTitle>
            <ResponsiveContainer width="100%" height={176}>
              <AreaChart data={stats.creditChart}>
                <defs>
                  <linearGradient id="gc" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0.1}
                    />
                    <stop
                      offset="95%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="hsl(var(--border))"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  width={30}
                />
                <RechartsTooltip
                  content={<ChartTooltip />}
                  cursor={{ stroke: "hsl(var(--border))" }}
                />
                <Area
                  type="monotone"
                  dataKey="creditsConsumed"
                  name="Crédits"
                  stroke="hsl(var(--primary))"
                  strokeWidth={1.5}
                  fill="url(#gc)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Abonnement + Profils + Usage ─────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Abonnement */}
        <div className="rounded-lg border border-border bg-card p-5">
          <SectionTitle>Abonnement</SectionTitle>
          {subscription ? (
            <div>
              <Row
                label="Plan"
                value={
                  PLANS[subscription.plan as PlanId]?.label ?? subscription.plan
                }
              />
              <Row
                label="Statut"
                value={
                  <Badge
                    variant="outline"
                    className="border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 text-[10px]"
                  >
                    {subscription.status}
                  </Badge>
                }
              />
              <Row
                label="Crédits accordés"
                value={subscription.creditsGranted.toLocaleString("fr-FR")}
              />
              <Row
                label="Expire le"
                value={new Date(subscription.periodEnd).toLocaleDateString(
                  "fr-FR",
                )}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-2">
              Aucun abonnement actif.
            </p>
          )}
        </div>

        {/* Profils */}
        <div className="rounded-lg border border-border bg-card p-5">
          <SectionTitle>
            Profils métier ({businessProfiles.length})
          </SectionTitle>
          {businessProfiles.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              Aucun profil configuré.
            </p>
          ) : (
            <div className="space-y-1.5">
              {businessProfiles.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2"
                >
                  <span className="text-sm font-medium">{p.name}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {p.businessType}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Usage */}
        <div className="rounded-lg border border-border bg-card p-5">
          <SectionTitle>Usage global</SectionTitle>
          <Row
            label="Réponses IA"
            value={usage.aiRepliesTotal.toLocaleString("fr-FR")}
          />
          <Row
            label="Posts gérés"
            value={usage.postsManaged.toLocaleString("fr-FR")}
          />
          <Row
            label="Conversations"
            value={usage.conversationsTotal.toLocaleString("fr-FR")}
          />
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          Dialog : Ajuster crédits
      ════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={creditDialog}
        onOpenChange={(o) => {
          if (!busy) setCreditDialog(o);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Ajuster les crédits</DialogTitle>
            <DialogDescription className="text-xs">
              Solde actuel :{" "}
              <strong className="text-foreground">
                {stats?.subscription.creditBalance.toLocaleString("fr-FR") ??
                  "—"}{" "}
                crédits
              </strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label
                htmlFor="ca"
                className="text-[11px] uppercase tracking-wide text-muted-foreground"
              >
                Montant
              </Label>
              <Input
                id="ca"
                type="number"
                placeholder="ex: +500 ou -100"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                className="h-9 text-sm"
              />
              {creditAmount && !isNaN(parseFloat(creditAmount)) && stats && (
                <p className="text-[11px] text-muted-foreground">
                  Nouveau solde :{" "}
                  <strong className="text-foreground">
                    {Math.max(
                      0,
                      stats.subscription.creditBalance +
                        parseFloat(creditAmount),
                    ).toLocaleString("fr-FR")}{" "}
                    crédits
                  </strong>
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="cr"
                className="text-[11px] uppercase tracking-wide text-muted-foreground"
              >
                Raison (obligatoire)
              </Label>
              <Input
                id="cr"
                placeholder="Ex: Compensation erreur système"
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreditDialog(false)}
              disabled={busy}
            >
              Annuler
            </Button>
            <Button
              size="sm"
              onClick={handleAdjustCredits}
              disabled={busy || !creditAmount || !creditReason.trim()}
            >
              {busy ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : null}
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════════
          Dialog : Changer de plan (+ custom)
      ════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={planDialog}
        onOpenChange={(o) => {
          if (!busy) setPlanDialog(o);
        }}
      >
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Changer de plan</DialogTitle>
            <DialogDescription className="text-xs">
              Plan actuel :{" "}
              <strong className="text-foreground">
                {PLANS[currentPlan]?.label ?? currentPlan}
              </strong>
              {" · "}
              Solde crédits :{" "}
              <strong className="text-foreground">
                {stats?.subscription.creditBalance.toLocaleString("fr-FR") ??
                  "—"}
              </strong>
            </DialogDescription>
          </DialogHeader>

          {/* Plan selector grid */}
          <div className="grid grid-cols-2 gap-2.5">
            {(Object.values(PLANS) as (typeof PLANS)[PlanId][]).map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                selected={selectedPlan === plan.id}
                current={currentPlan === plan.id}
                onClick={() => setSelectedPlan(plan.id as PlanId)}
              />
            ))}
          </div>

          {/* Custom fields — visibles uniquement si CUSTOM sélectionné */}
          {selectedPlan === "CUSTOM" && (
            <div className="mt-1 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4 space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-yellow-600 dark:text-yellow-400 flex items-center gap-1.5">
                <Crown className="h-3 w-3" />
                Configuration personnalisée
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="cc"
                    className="text-[11px] uppercase tracking-wide text-muted-foreground"
                  >
                    Crédits *
                  </Label>
                  <Input
                    id="cc"
                    type="number"
                    placeholder="ex: 50000"
                    value={customCredits}
                    onChange={(e) => setCustomCredits(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="cd"
                    className="text-[11px] uppercase tracking-wide text-muted-foreground"
                  >
                    Durée (jours) *
                  </Label>
                  <Input
                    id="cd"
                    type="number"
                    placeholder="30"
                    value={customDays}
                    onChange={(e) => setCustomDays(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="cp"
                    className="text-[11px] uppercase tracking-wide text-muted-foreground"
                  >
                    Prix (Ar)
                  </Label>
                  <Input
                    id="cp"
                    type="number"
                    placeholder="0"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="cpg"
                    className="text-[11px] uppercase tracking-wide text-muted-foreground"
                  >
                    Pages max *
                  </Label>
                  <Input
                    id="cpg"
                    type="number"
                    placeholder="ex: 10"
                    value={customPages}
                    onChange={(e) => setCustomPages(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="cpo"
                    className="text-[11px] uppercase tracking-wide text-muted-foreground"
                  >
                    Posts max *
                  </Label>
                  <Input
                    id="cpo"
                    type="number"
                    placeholder="ex: 50"
                    value={customPosts}
                    onChange={(e) => setCustomPosts(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="ci"
                    className="text-[11px] uppercase tracking-wide text-muted-foreground"
                  >
                    Images max *
                  </Label>
                  <Input
                    id="ci"
                    type="number"
                    placeholder="ex: 200"
                    value={customImages}
                    onChange={(e) => setCustomImages(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="cn"
                  className="text-[11px] uppercase tracking-wide text-muted-foreground"
                >
                  Note interne (optionnel)
                </Label>
                <Input
                  id="cn"
                  placeholder="Ex: Accord commercial spécial"
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          )}

          {/* Warning si downgrade */}
          {selectedPlan &&
            selectedPlan !== currentPlan &&
            selectedPlan !== "CUSTOM" &&
            (() => {
              const cur = PLANS[currentPlan];
              const next = PLANS[selectedPlan as PlanId];
              if (
                cur?.credits !== null &&
                next?.credits !== null &&
                (next?.credits ?? 0) < (cur?.credits ?? 0)
              ) {
                return (
                  <div className="flex items-start gap-2 rounded-md border border-orange-500/20 bg-orange-500/5 px-3 py-2.5">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-500" />
                    <p className="text-xs text-orange-600 dark:text-orange-400">
                      Ce changement réinitialise les crédits à{" "}
                      <strong>{next.credits?.toLocaleString("fr-FR")}</strong>{" "}
                      (downgrade depuis {cur.credits?.toLocaleString("fr-FR")}{" "}
                      crédits).
                    </p>
                  </div>
                );
              }
              return null;
            })()}

          <DialogFooter className="gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPlanDialog(false);
                resetCustomFields();
              }}
              disabled={busy}
            >
              Annuler
            </Button>
            <Button
              size="sm"
              onClick={handleChangePlan}
              disabled={
                busy ||
                !selectedPlan ||
                selectedPlan === currentPlan ||
                (selectedPlan === "CUSTOM" &&
                  (!customCredits ||
                    !customPages ||
                    !customPosts ||
                    !customImages))
              }
            >
              {busy ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : null}
              {selectedPlan === currentPlan
                ? "Plan actuel"
                : selectedPlan === "CUSTOM"
                  ? "Créer plan custom"
                  : `Passer en ${PLANS[selectedPlan as PlanId]?.label ?? selectedPlan}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
