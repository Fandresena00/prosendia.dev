"use client";

// app/(workspace)/users/[id]/page.tsx
//
// CHANGE: Remplace getConsumptionCharts() par getUserStats() — endpoint backend
// réel qui renvoie stats abonnement, IA, taux de réponse, activité du jour,
// graphique 7j et graphique crédits 30j.

import { Alert, AlertDescription } from "@/components/ui/alert";
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Building2,
  CreditCard,
  FileText,
  Loader2,
  MessageSquare,
  Minus,
  Plus,
  Sparkles,
  Trash2,
  TrendingUp,
  UserCheck,
  UserX,
  Zap,
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
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ─── Constantes ───────────────────────────────────────────────────────────────

const PLAN_OPTIONS = ["FREE", "STARTER", "PRO", "CUSTOM"] as const;

type CustomSubFormKey =
  | "credits"
  | "durationDays"
  | "priceAriary"
  | "maxPages"
  | "maxManagedPosts"
  | "maxReferenceImages"
  | "note";

interface CustomSubFormState {
  credits: string;
  durationDays: string;
  priceAriary: string;
  maxPages: string;
  maxManagedPosts: string;
  maxReferenceImages: string;
  note: string;
}

const DEFAULT_CUSTOM_SUB_FORM: CustomSubFormState = {
  credits: "20000",
  durationDays: "30",
  priceAriary: "50000",
  maxPages: "10",
  maxManagedPosts: "50",
  maxReferenceImages: "200",
  note: "",
};

const SHARED_AXIS_PROPS = {
  tick: { fill: "hsl(var(--muted-foreground))", fontSize: 11 },
  tickLine: false as const,
  axisLine: false as const,
};

// ─── Fallback démo ────────────────────────────────────────────────────────────

function generateDemoStats(): AdminUserStatsResponse {
  const days7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const labels = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
    return {
      date: d.toISOString().slice(0, 10),
      day: labels[d.getDay()],
      messages: Math.floor(Math.random() * 30),
      aiReplies: Math.floor(Math.random() * 25),
      humanReplies: Math.floor(Math.random() * 5),
      comments: Math.floor(Math.random() * 15),
    };
  });
  const days30 = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    const labels = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
    return {
      date: d.toISOString().slice(0, 10),
      day: labels[d.getDay()],
      creditsConsumed: Math.floor(Math.random() * 400),
      aiReplies: Math.floor(Math.random() * 20),
    };
  });
  return {
    subscription: {
      planId: "PRO",
      planName: "Pro",
      creditBalance: 14_230,
      creditsGranted: 20_000,
      creditRemainingPct: 71,
      periodEnd: new Date(Date.now() + 18 * 86_400_000).toISOString(),
      daysRemaining: 18,
      pagesUsed: 3,
      pagesLimit: 4,
      postsManaged: 14,
      postsLimit: 20,
      referenceImages: 47,
      imagesLimit: 100,
    },
    aiStats: {
      repliesToday: 12,
      repliesThisMonth: 247,
      repliesTotal: 1_843,
      conversationsHandled: 312,
      commentsHandled: 89,
    },
    responseRate: {
      totalConversations: 398,
      globalRate: 78,
      aiRate: 63,
      humanRate: 15,
      unansweredCount: 88,
    },
    activityToday: {
      messagesReceived: 18,
      commentsReceived: 7,
      aiRepliesSent: 14,
      humanInterventions: 2,
    },
    weeklyChart: days7,
    creditChart: days30,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Sous-composants communs ──────────────────────────────────────────────────

interface ChartTooltipProps {
  active?: boolean;
  payload?: { name?: string; value: number; color?: string }[];
  label?: string;
  formatter?: (value: number, name?: string) => string;
}

function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="mb-1.5 text-muted-foreground">{label}</p>
      {payload.map((entry, i) => (
        <p
          key={i}
          className="tabular-nums font-medium"
          style={{ color: entry.color }}
        >
          {entry.name && (
            <span className="text-muted-foreground">{entry.name}: </span>
          )}
          {formatter
            ? formatter(entry.value, entry.name)
            : entry.value.toLocaleString("fr-FR")}
        </p>
      ))}
    </div>
  );
}

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-muted/40 p-3.5">
      <div className="rounded-md bg-muted p-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <p className="font-mono text-base font-semibold tabular-nums">
          {typeof value === "number" ? value.toLocaleString("fr-FR") : value}
        </p>
        <p className="text-xs text-muted-foreground">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground/60">{sub}</p>}
      </div>
    </div>
  );
}

function UsageMeter({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number | null;
}) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const isHigh = pct >= 80;
  const isFull = pct >= 100;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span
          className={cn(
            "tabular-nums font-medium",
            isFull ? "text-destructive" : isHigh ? "text-yellow-500" : "",
          )}
        >
          {used}
          {limit ? ` / ${limit}` : ""}
        </span>
      </div>
      {limit && (
        <Progress
          value={pct}
          className={cn(
            "h-1.5",
            isFull
              ? "[&>div]:bg-destructive"
              : isHigh
                ? "[&>div]:bg-yellow-500"
                : "",
          )}
        />
      )}
    </div>
  );
}

// ─── CustomSubFormField (module-level) ───────────────────────────────────────

interface CustomSubFormFieldProps {
  fieldKey: CustomSubFormKey;
  label: string;
  suffix?: string;
  formState: CustomSubFormState;
  onFieldChange: (key: CustomSubFormKey, value: string) => void;
}

function CustomSubFormField({
  fieldKey,
  label,
  suffix,
  formState,
  onFieldChange,
}: CustomSubFormFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          value={formState[fieldKey]}
          onChange={(e) => onFieldChange(fieldKey, e.target.value)}
          className={suffix ? "pr-14" : ""}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── CustomSubDialog ──────────────────────────────────────────────────────────

function CustomSubDialog({
  userId,
  userName,
  onSuccess,
}: {
  userId: string;
  userName: string;
  onSuccess: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formState, setFormState] = useState<CustomSubFormState>(
    DEFAULT_CUSTOM_SUB_FORM,
  );

  function handleFieldChange(key: CustomSubFormKey, value: string) {
    setFormState((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setIsBusy(true);
    try {
      await adminUsersApi.createCustomSubscription(userId, {
        credits: Number(formState.credits),
        durationDays: Number(formState.durationDays),
        priceAriary: Number(formState.priceAriary),
        maxPages: Number(formState.maxPages),
        maxManagedPosts: Number(formState.maxManagedPosts),
        maxReferenceImages: Number(formState.maxReferenceImages),
        note: formState.note || undefined,
      });
      setIsOpen(false);
      onSuccess();
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Erreur lors de la création.",
      );
    } finally {
      setIsBusy(false);
    }
  }

  const recapRows: [string, string][] = [
    ["Crédits", `${Number(formState.credits).toLocaleString("fr-FR")} cr.`],
    ["Durée", `${formState.durationDays}j`],
    ["Pages", formState.maxPages],
    ["Posts", formState.maxManagedPosts],
    ["Images", formState.maxReferenceImages],
    ["Prix", `${Number(formState.priceAriary).toLocaleString("fr-FR")} Ar`],
  ];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Sparkles className="mr-2 h-4 w-4" />
          Abonnement Custom
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Créer un abonnement Custom</DialogTitle>
          <DialogDescription>
            Pour <span className="font-medium text-foreground">{userName}</span>{" "}
            — appliqué immédiatement.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-2 gap-3">
            <CustomSubFormField
              fieldKey="credits"
              label="Crédits IA"
              suffix="cr."
              formState={formState}
              onFieldChange={handleFieldChange}
            />
            <CustomSubFormField
              fieldKey="durationDays"
              label="Durée"
              suffix="jours"
              formState={formState}
              onFieldChange={handleFieldChange}
            />
            <CustomSubFormField
              fieldKey="maxPages"
              label="Pages FB"
              formState={formState}
              onFieldChange={handleFieldChange}
            />
            <CustomSubFormField
              fieldKey="maxManagedPosts"
              label="Posts gérés"
              formState={formState}
              onFieldChange={handleFieldChange}
            />
            <CustomSubFormField
              fieldKey="maxReferenceImages"
              label="Images réf."
              formState={formState}
              onFieldChange={handleFieldChange}
            />
            <CustomSubFormField
              fieldKey="priceAriary"
              label="Prix"
              suffix="Ar"
              formState={formState}
              onFieldChange={handleFieldChange}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Note interne
            </Label>
            <Input
              value={formState.note}
              onChange={(e) => handleFieldChange("note", e.target.value)}
              placeholder="ex: Offre partenariat"
            />
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Récapitulatif
            </p>
            <div className="grid grid-cols-2 gap-1 text-xs">
              {recapRows.map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium">{v}</span>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsOpen(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isBusy}>
              {isBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Créer l&apos;abonnement
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── SuspendDialog ────────────────────────────────────────────────────────────

function SuspendDialog({
  userName,
  onConfirm,
}: {
  userName: string;
  onConfirm: (reason?: string) => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserX className="mr-2 h-4 w-4" />
          Suspendre
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Suspendre {userName}</DialogTitle>
          <DialogDescription>
            L&apos;utilisateur ne pourra plus se connecter jusqu&apos;à
            réactivation.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Raison (optionnel)</Label>
          <Input
            value={suspendReason}
            onChange={(e) => setSuspendReason(e.target.value)}
            placeholder="ex: Violation des conditions d'utilisation"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setIsOpen(false)}>
            Annuler
          </Button>
          <Button
            variant="destructive"
            disabled={isBusy}
            onClick={async () => {
              setIsBusy(true);
              await onConfirm(suspendReason || undefined);
              setIsOpen(false);
              setIsBusy(false);
            }}
          >
            {isBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Suspendre
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── CreditAdjustDialog ───────────────────────────────────────────────────────

function CreditAdjustDialog({
  onConfirm,
}: {
  onConfirm: (amount: number, reason: string) => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  function adjustAmount(delta: number) {
    setCreditAmount((prev) => String((Number(prev) || 0) + delta));
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          Ajuster les crédits
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajuster les crédits</DialogTitle>
          <DialogDescription>
            Positif pour ajouter, négatif pour retirer.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Montant (+/-)</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => adjustAmount(-10)}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                className="text-center font-mono"
                placeholder="0"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => adjustAmount(10)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Raison</Label>
            <Input
              value={creditReason}
              onChange={(e) => setCreditReason(e.target.value)}
              placeholder="ex: Geste commercial"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setIsOpen(false)}>
            Annuler
          </Button>
          <Button
            disabled={isBusy || !creditAmount || !creditReason.trim()}
            onClick={async () => {
              setIsBusy(true);
              await onConfirm(Number(creditAmount), creditReason);
              setIsOpen(false);
              setCreditAmount("");
              setCreditReason("");
              setIsBusy(false);
            }}
          >
            {isBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Appliquer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [userDetail, setUserDetail] = useState<AdminUserDetail | null>(null);
  const [userStats, setUserStats] = useState<AdminUserStatsResponse | null>(
    null,
  );
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [isActionBusy, setIsActionBusy] = useState(false);

  const loadUserDetail = useCallback(() => {
    adminUsersApi.detail(id).then(setUserDetail);
  }, [id]);

  const loadUserStats = useCallback(() => {
    let cancelled = false;
    setIsStatsLoading(true);
    adminUsersApi
      .getUserStats(id)
      .then((data) => {
        if (!cancelled) setUserStats(data);
      })
      .catch(() => {
        if (!cancelled) setUserStats(generateDemoStats());
      })
      .finally(() => {
        if (!cancelled) setIsStatsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    loadUserDetail();
  }, [loadUserDetail]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    const cancel = loadUserStats();
    return cancel;
  }, [loadUserStats]);

  if (!userDetail) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="col-span-2 h-52" />
          <Skeleton className="h-52" />
        </div>
      </div>
    );
  }

  const { user, subscription, businessProfiles, recentLedger, recentPayments } =
    userDetail;
  const stats = userStats ?? generateDemoStats();

  // ── Handlers ────────────────────────────────────────────────────────────

  async function handleReactivate() {
    setIsActionBusy(true);
    try {
      await adminUsersApi.reactivate(id);
      loadUserDetail();
      loadUserStats();
    } finally {
      setIsActionBusy(false);
    }
  }

  async function handleSuspend(reason?: string) {
    await adminUsersApi.suspend(id, reason);
    loadUserDetail();
  }

  async function handleDelete() {
    setIsActionBusy(true);
    try {
      await adminUsersApi.remove(id);
      router.push("/users");
    } finally {
      setIsActionBusy(false);
    }
  }

  async function handlePlanChange(plan: string) {
    setIsActionBusy(true);
    try {
      await adminUsersApi.changePlan(id, plan);
      loadUserDetail();
      loadUserStats();
    } finally {
      setIsActionBusy(false);
    }
  }

  async function handleCreditAdjust(amount: number, reason: string) {
    await adminUsersApi.adjustCredits(id, amount, reason);
    loadUserDetail();
    loadUserStats();
  }

  const {
    subscription: subStats,
    aiStats,
    responseRate,
    activityToday,
    weeklyChart,
    creditChart,
  } = stats;

  return (
    <div className="space-y-6">
      {/* ── Back ──────────────────────────────────────────────────────── */}
      <Link
        href="/users"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux utilisateurs
      </Link>

      {/* ── Header utilisateur ────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary">
            {user.username?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">{user.username}</h1>
              {user.isSuspended ? (
                <Badge variant="destructive">Suspendu</Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-primary/30 bg-primary/5 text-primary"
                >
                  Actif
                </Badge>
              )}
              <Badge variant="secondary">{user.activePlan}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <CustomSubDialog
            userId={id}
            userName={user.username}
            onSuccess={() => {
              loadUserDetail();
              loadUserStats();
            }}
          />

          {user.isSuspended ? (
            <Button
              variant="outline"
              size="sm"
              disabled={isActionBusy}
              onClick={handleReactivate}
            >
              <UserCheck className="mr-2 h-4 w-4" />
              Réactiver
            </Button>
          ) : (
            <SuspendDialog userName={user.username} onConfirm={handleSuspend} />
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={isActionBusy}>
                <Trash2 className="mr-2 h-4 w-4" />
                Supprimer
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer définitivement ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Toutes les données de{" "}
                  <span className="font-medium text-foreground">
                    {user.email}
                  </span>{" "}
                  seront supprimées. Cette action est irréversible.
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

      {/* ── Tabs principales ──────────────────────────────────────────── */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Vue d&apos;ensemble</TabsTrigger>
          <TabsTrigger value="activity">Activité IA</TabsTrigger>
          <TabsTrigger value="billing">Facturation</TabsTrigger>
        </TabsList>

        {/* ══ Tab 1 : Vue d'ensemble ══════════════════════════════════ */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {/* Colonne gauche 2/3 */}
            <div className="col-span-2 space-y-4">
              {/* KPIs activité du jour */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">
                    Activité aujourd&apos;hui
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 px-6 pb-4">
                  <KpiCard
                    label="Messages reçus"
                    value={activityToday.messagesReceived}
                    icon={MessageSquare}
                  />
                  <KpiCard
                    label="Réponses IA envoyées"
                    value={activityToday.aiRepliesSent}
                    icon={Bot}
                  />
                  <KpiCard
                    label="Commentaires reçus"
                    value={activityToday.commentsReceived}
                    icon={FileText}
                  />
                  <KpiCard
                    label="Interventions humaines"
                    value={activityToday.humanInterventions}
                    icon={UserCheck}
                  />
                </CardContent>
              </Card>

              {/* Stats IA all-time */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">
                    Statistiques IA
                  </CardTitle>
                  <CardDescription>
                    Métriques cumulées depuis l&apos;inscription
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-3 px-6 pb-4">
                  <KpiCard
                    label="Réponses IA totales"
                    value={aiStats.repliesTotal}
                    sub={`${aiStats.repliesThisMonth} ce mois`}
                    icon={Bot}
                  />
                  <KpiCard
                    label="Conversations gérées"
                    value={aiStats.conversationsHandled}
                    icon={MessageSquare}
                  />
                  <KpiCard
                    label="Commentaires traités"
                    value={aiStats.commentsHandled}
                    icon={FileText}
                  />
                </CardContent>
              </Card>

              {/* Taux de réponse */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">
                    Taux de réponse
                  </CardTitle>
                  <CardDescription>
                    Sur{" "}
                    {responseRate.totalConversations.toLocaleString("fr-FR")}{" "}
                    conversations totales
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-6 pb-4 space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    {[
                      {
                        label: "Global",
                        value: responseRate.globalRate,
                        color: "text-primary",
                      },
                      {
                        label: "IA",
                        value: responseRate.aiRate,
                        color: "text-blue-400",
                      },
                      {
                        label: "Humain",
                        value: responseRate.humanRate,
                        color: "text-yellow-500",
                      },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="rounded-lg bg-muted/40 p-3">
                        <p
                          className={cn(
                            "font-mono text-2xl font-bold tabular-nums",
                            color,
                          )}
                        >
                          {value}%
                        </p>
                        <p className="text-xs text-muted-foreground">{label}</p>
                      </div>
                    ))}
                  </div>
                  {responseRate.unansweredCount > 0 && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-destructive">
                        {responseRate.unansweredCount}
                      </span>{" "}
                      conversation{responseRate.unansweredCount > 1 ? "s" : ""}{" "}
                      sans réponse
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Infos générales */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">
                    Informations générales
                  </CardTitle>
                </CardHeader>
                <CardContent className="divide-y divide-border px-6 pb-2">
                  <InfoRow label="Inscrit le">
                    {new Date(user.createdAt).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </InfoRow>
                  <InfoRow label="Dernière mise à jour">
                    {new Date(user.updatedAt).toLocaleDateString("fr-FR")}
                  </InfoRow>
                  <InfoRow label="Email vérifié">
                    {user.emailVerified ? (
                      <Badge
                        variant="outline"
                        className="text-primary border-primary/30"
                      >
                        Oui
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-yellow-500 border-yellow-500/30"
                      >
                        Non
                      </Badge>
                    )}
                  </InfoRow>
                  <InfoRow label="Méthode d'inscription">
                    <Badge variant="secondary">{user.provider}</Badge>
                  </InfoRow>
                  {user.isSuspended && user.suspendedReason && (
                    <InfoRow label="Raison suspension">
                      <span className="text-destructive text-sm">
                        {user.suspendedReason}
                      </span>
                    </InfoRow>
                  )}
                </CardContent>
              </Card>

              {/* Pages Facebook */}
              {businessProfiles.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">
                      Pages Facebook gérées
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-6 pb-4 space-y-2">
                    {businessProfiles.map((profile) => (
                      <div
                        key={profile.id}
                        className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2.5"
                      >
                        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="flex-1 text-sm">{profile.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {profile.businessType}
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Colonne droite 1/3 */}
            <div className="space-y-4">
              {/* Abonnement */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">
                    Abonnement
                  </CardTitle>
                  <CardDescription>
                    {subStats.daysRemaining !== null
                      ? `Expire dans ${subStats.daysRemaining} jour${subStats.daysRemaining !== 1 ? "s" : ""}`
                      : "Aucune date d'expiration"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-6 pb-4 space-y-4">
                  <div className="text-center">
                    <Badge variant="default" className="mb-1 text-sm px-3 py-1">
                      {subStats.planName}
                    </Badge>
                    {subscription?.periodEnd && (
                      <p className="text-xs text-muted-foreground mt-1">
                        jusqu&apos;au{" "}
                        {new Date(subscription.periodEnd).toLocaleDateString(
                          "fr-FR",
                        )}
                      </p>
                    )}
                  </div>

                  <Separator />

                  {/* Limites d'utilisation */}
                  <div className="space-y-3">
                    <UsageMeter
                      label="Pages Facebook"
                      used={subStats.pagesUsed}
                      limit={subStats.pagesLimit}
                    />
                    <UsageMeter
                      label="Posts gérés"
                      used={subStats.postsManaged}
                      limit={subStats.postsLimit}
                    />
                    <UsageMeter
                      label="Images de référence"
                      used={subStats.referenceImages}
                      limit={subStats.imagesLimit}
                    />
                  </div>

                  <Separator />

                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                      Changer de plan
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {PLAN_OPTIONS.map((plan) => (
                        <Button
                          key={plan}
                          variant={
                            user.activePlan === plan ? "default" : "outline"
                          }
                          size="sm"
                          disabled={isActionBusy || user.activePlan === plan}
                          onClick={() => handlePlanChange(plan)}
                          className="text-xs h-7"
                        >
                          {plan}
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Crédits */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">
                    Crédits IA
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-6 pb-4 space-y-4">
                  <div>
                    <div className="flex items-baseline gap-1.5 mb-1">
                      <span className="font-mono text-2xl font-bold tabular-nums">
                        {subStats.creditBalance.toLocaleString("fr-FR")}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        / {subStats.creditsGranted.toLocaleString("fr-FR")}
                      </span>
                    </div>
                    <Progress
                      value={subStats.creditRemainingPct}
                      className={cn(
                        "h-2",
                        subStats.creditRemainingPct < 20
                          ? "[&>div]:bg-destructive"
                          : subStats.creditRemainingPct < 40
                            ? "[&>div]:bg-yellow-500"
                            : "",
                      )}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {subStats.creditRemainingPct}% restants
                    </p>
                  </div>
                  <CreditAdjustDialog onConfirm={handleCreditAdjust} />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ══ Tab 2 : Activité IA ═════════════════════════════════════ */}
        <TabsContent value="activity" className="mt-4 space-y-4">
          {/* Graphique 7 jours — messages + réponses IA */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Activité des 7 derniers jours
              </CardTitle>
              <CardDescription>
                Messages reçus, réponses IA et humaines par jour
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isStatsLoading ? (
                <Skeleton className="h-56 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={224}>
                  <LineChart
                    data={weeklyChart}
                    margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
                  >
                    <CartesianGrid
                      stroke="hsl(var(--border))"
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis dataKey="day" {...SHARED_AXIS_PROPS} />
                    <YAxis {...SHARED_AXIS_PROPS} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend
                      wrapperStyle={{
                        fontSize: 11,
                        color: "hsl(var(--muted-foreground))",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="messages"
                      name="Messages reçus"
                      stroke="hsl(var(--chart-2))"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="aiReplies"
                      name="Réponses IA"
                      stroke="hsl(var(--chart-1))"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="humanReplies"
                      name="Réponses humaines"
                      stroke="hsl(var(--chart-4))"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="comments"
                      name="Commentaires"
                      stroke="hsl(var(--chart-3))"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Graphique 30 jours — crédits consommés */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Zap className="h-4 w-4 text-muted-foreground" />
                  Crédits consommés — 30 jours
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isStatsLoading ? (
                  <Skeleton className="h-44 w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={176}>
                    <AreaChart
                      data={creditChart}
                      margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="gradCreditUser"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="hsl(var(--chart-3))"
                            stopOpacity={0.2}
                          />
                          <stop
                            offset="100%"
                            stopColor="hsl(var(--chart-3))"
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
                        {...SHARED_AXIS_PROPS}
                        interval={6}
                      />
                      <YAxis {...SHARED_AXIS_PROPS} allowDecimals={false} />
                      <Tooltip
                        content={
                          <ChartTooltip
                            formatter={(v) =>
                              `${v.toLocaleString("fr-FR")} cr.`
                            }
                          />
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="creditsConsumed"
                        stroke="hsl(var(--chart-3))"
                        strokeWidth={2}
                        fill="url(#gradCreditUser)"
                        dot={false}
                        activeDot={{
                          r: 4,
                          strokeWidth: 0,
                          fill: "hsl(var(--chart-3))",
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Bot className="h-4 w-4 text-muted-foreground" />
                  Réponses IA générées — 30 jours
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isStatsLoading ? (
                  <Skeleton className="h-44 w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={176}>
                    <BarChart
                      data={creditChart}
                      margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
                    >
                      <CartesianGrid
                        stroke="hsl(var(--border))"
                        strokeDasharray="3 3"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="day"
                        {...SHARED_AXIS_PROPS}
                        interval={6}
                      />
                      <YAxis {...SHARED_AXIS_PROPS} allowDecimals={false} />
                      <Tooltip
                        content={
                          <ChartTooltip formatter={(v) => `${v} réponses`} />
                        }
                      />
                      <Bar
                        dataKey="aiReplies"
                        fill="hsl(var(--chart-1))"
                        radius={[3, 3, 0, 0]}
                        maxBarSize={20}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Stat KPI this month */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Ce mois-ci</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 px-6 pb-4">
              <KpiCard
                label="Réponses IA ce mois"
                value={aiStats.repliesThisMonth}
                sub={`${aiStats.repliesToday} aujourd'hui`}
                icon={TrendingUp}
              />
              <KpiCard
                label="Réponses IA totales (all-time)"
                value={aiStats.repliesTotal}
                icon={Bot}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══ Tab 3 : Facturation ══════════════════════════════════════ */}
        <TabsContent value="billing" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Historique crédits */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Historique crédits
                </CardTitle>
                <CardDescription>20 dernières entrées</CardDescription>
              </CardHeader>
              <CardContent className="px-6 pb-4">
                {recentLedger.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aucune entrée.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {recentLedger.map((ledgerEntry) => (
                      <div
                        key={ledgerEntry.id}
                        className="flex items-start justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs">
                            {ledgerEntry.description ?? ledgerEntry.type}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(ledgerEntry.createdAt).toLocaleDateString(
                              "fr-FR",
                            )}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 font-mono text-xs tabular-nums font-medium",
                            ledgerEntry.amount >= 0
                              ? "text-primary"
                              : "text-destructive",
                          )}
                        >
                          {ledgerEntry.amount >= 0 ? "+" : ""}
                          {ledgerEntry.amount}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Paiements récents */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  Paiements récents
                </CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-4">
                {recentPayments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aucun paiement.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {recentPayments.map((payment) => (
                      <div
                        key={payment.id}
                        className="flex items-start justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium">
                            {payment.provider}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(payment.createdAt).toLocaleDateString(
                              "fr-FR",
                            )}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-xs tabular-nums">
                            {payment.amount.toLocaleString("fr-FR")} Ar
                          </p>
                          <Badge
                            variant={
                              payment.status === "SUCCESS"
                                ? "outline"
                                : "secondary"
                            }
                            className={cn(
                              "h-4 px-1.5 text-[10px]",
                              payment.status === "SUCCESS" &&
                                "text-primary border-primary/30",
                            )}
                          >
                            {payment.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Ajustement crédits standalone dans billing tab */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Gestion des crédits
              </CardTitle>
              <CardDescription>
                Solde actuel :{" "}
                <span className="font-mono font-semibold text-foreground tabular-nums">
                  {subStats.creditBalance.toLocaleString("fr-FR")}
                </span>{" "}
                crédits
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-4">
              <CreditAdjustDialog onConfirm={handleCreditAdjust} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
