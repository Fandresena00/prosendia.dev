"use client";

// app/(workspace)/users/[id]/page.tsx
//
// Page détail utilisateur complète — intègre la gestion du plan custom.
// La page /custom-plans est supprimée : tout est ici.
//
// Layout : header + KPIs + charts (colonne principale)
//          + panneau droit : onglets Infos / Config Custom / Actions
//
// Design : émeraude comme accent secondaire, primary (violet) pour les actions.

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
  adminCustomPlansApi,
  adminUsersApi,
  type AdminUserDetail,
  type AdminUserStatsResponse,
  type CustomPlanTemplate,
} from "@/lib/admin-api";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  Check,
  CreditCard,
  Crown,
  Edit3,
  Info,
  Layers,
  Loader2,
  MessageSquare,
  RefreshCw,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
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
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

// ─── Plan constants ───────────────────────────────────────────────────────────

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
    color: "text-sky-500",
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

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  sub,
  accent = "default",
  loading = false,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  sub?: string;
  accent?: "default" | "emerald" | "primary";
  loading?: boolean;
}) {
  const iconClass = {
    default: "bg-white/5 text-muted-foreground/40",
    emerald: "bg-emerald-500/10 text-emerald-500",
    primary: "bg-primary/10 text-primary",
  }[accent];

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between mb-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/50">
          {label}
        </span>
        <div
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-md",
            iconClass,
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      {loading ? (
        <Skeleton className="h-7 w-16 bg-white/5" />
      ) : (
        <p className="font-mono text-[22px] font-semibold tracking-tight tabular-nums leading-none">
          {value}
        </p>
      )}
      {sub && !loading && (
        <p className="mt-1.5 text-[11px] text-muted-foreground/50">{sub}</p>
      )}
    </div>
  );
}

// ─── Chart tooltip ────────────────────────────────────────────────────────────

function ChartTip({
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
      <p className="mb-1.5 text-muted-foreground font-medium">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="h-1.5 w-1.5 rounded-full shrink-0"
            style={{ backgroundColor: p.color }}
          />
          <span>
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
        "relative w-full rounded-lg border p-3 text-left transition-all duration-100",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary/25"
          : "border-border bg-card/50 hover:bg-card hover:border-border/80",
        current && !selected && "opacity-50",
      )}
    >
      {plan.popular && (
        <span className="absolute -top-2 right-2 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-semibold text-primary-foreground">
          Popular
        </span>
      )}
      <div className="flex items-center justify-between mb-1.5">
        <p className={cn("text-[12px] font-semibold", plan.color)}>
          {plan.label}
        </p>
        <div
          className={cn(
            "flex h-3.5 w-3.5 items-center justify-center rounded-full border",
            selected ? "border-primary bg-primary" : "border-border/60",
          )}
        >
          {selected && <Check className="h-2 w-2 text-primary-foreground" />}
        </div>
      </div>
      {plan.credits !== null ? (
        <div className="grid grid-cols-2 gap-0.5">
          {[
            { k: "Crédits", v: plan.credits?.toLocaleString("fr-FR") },
            { k: "Pages", v: plan.pages },
          ].map((i) => (
            <div key={i.k} className="rounded bg-white/5 px-1.5 py-0.5">
              <p className="text-[9px] text-muted-foreground/50">{i.k}</p>
              <p className="text-[10px] font-semibold">{i.v}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground/40 italic">
          Config personnalisée
        </p>
      )}
      {current && (
        <div className="mt-1.5 flex items-center gap-1 text-[9px] text-emerald-500">
          <span className="h-1 w-1 rounded-full bg-emerald-500" />
          Actuel
        </div>
      )}
    </button>
  );
}

// ─── Row helper ───────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
      <span className="text-[11px] text-muted-foreground/60">{label}</span>
      <span className="text-[11px] font-medium">{value}</span>
    </div>
  );
}

// ─── Section title ────────────────────────────────────────────────────────────

function SectionTitle({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/40">
        {children}
      </h3>
      {action}
    </div>
  );
}

// ─── Custom config form ───────────────────────────────────────────────────────

interface ConfigForm {
  name: string;
  description: string;
  priceAriary: string;
  durationDays: string;
  credits: string;
  maxPages: string;
  maxManagedPosts: string;
  maxReferenceImages: string;
  isVisible: boolean;
  isPurchasable: boolean;
  note: string;
}

const EMPTY_FORM: ConfigForm = {
  name: "Plan Custom",
  description: "",
  priceAriary: "0",
  durationDays: "30",
  credits: "",
  maxPages: "",
  maxManagedPosts: "",
  maxReferenceImages: "",
  isVisible: true,
  isPurchasable: true,
  note: "",
};

function fromConfig(c: CustomPlanTemplate): ConfigForm {
  const cc = c as unknown as Record<string, unknown>;
  return {
    name: String(c.name ?? "Plan Custom"),
    description: String(c.description ?? ""),
    priceAriary: String(c.priceAriary ?? 0),
    durationDays: String(c.durationDays ?? 30),
    credits: String(c.credits ?? ""),
    maxPages: String(c.maxPages ?? ""),
    maxManagedPosts: String(c.maxManagedPosts ?? ""),
    maxReferenceImages: String(c.maxReferenceImages ?? ""),
    isVisible: Boolean(cc.isActive ?? cc.isVisible ?? true),
    isPurchasable: Boolean(cc.isPurchasable ?? true),
    note: String(cc.note ?? ""),
  };
}

function ConfigFormFields({
  form,
  onChange,
}: {
  form: ConfigForm;
  onChange: (k: keyof ConfigForm, v: string | boolean) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2 space-y-1">
          <Label className="text-[9px] uppercase tracking-wide text-muted-foreground/50">
            Nom affiché *
          </Label>
          <Input
            value={form.name}
            onChange={(e) => onChange("name", e.target.value)}
            placeholder="Plan Entreprise"
            className="h-7 text-xs bg-background/60"
          />
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-[9px] uppercase tracking-wide text-muted-foreground/50">
            Description
          </Label>
          <Input
            value={form.description}
            onChange={(e) => onChange("description", e.target.value)}
            placeholder="Offre sur mesure…"
            className="h-7 text-xs bg-background/60"
          />
        </div>
        {[
          { key: "credits" as const, label: "Crédits *", placeholder: "50000" },
          {
            key: "durationDays" as const,
            label: "Durée (jours) *",
            placeholder: "30",
          },
          {
            key: "priceAriary" as const,
            label: "Prix Papi (Ar)",
            placeholder: "0",
          },
          { key: "maxPages" as const, label: "Pages max *", placeholder: "10" },
          {
            key: "maxManagedPosts" as const,
            label: "Posts max *",
            placeholder: "50",
          },
          {
            key: "maxReferenceImages" as const,
            label: "Images max *",
            placeholder: "200",
          },
        ].map((f) => (
          <div key={f.key} className="space-y-1">
            <Label className="text-[9px] uppercase tracking-wide text-muted-foreground/50">
              {f.label}
            </Label>
            <Input
              type="number"
              value={form[f.key]}
              onChange={(e) => onChange(f.key, e.target.value)}
              placeholder={f.placeholder}
              className="h-7 text-xs bg-background/60"
            />
          </div>
        ))}
        <div className="col-span-2 space-y-1">
          <Label className="text-[9px] uppercase tracking-wide text-muted-foreground/50">
            Note interne
          </Label>
          <Input
            value={form.note}
            onChange={(e) => onChange("note", e.target.value)}
            placeholder="Accord commercial…"
            className="h-7 text-xs bg-background/60"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5 pt-1">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isVisible}
            onChange={(e) => onChange("isVisible", e.target.checked)}
            className="h-3 w-3 accent-emerald-500"
          />
          <span className="text-[10px] text-muted-foreground/60">
            Visible dans /billing de cet utilisateur
          </span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isPurchasable}
            onChange={(e) => onChange("isPurchasable", e.target.checked)}
            className="h-3 w-3 accent-emerald-500"
          />
          <span className="text-[10px] text-muted-foreground/60">
            Achetable via Papi (non = attribution manuelle uniquement)
          </span>
        </label>
      </div>
    </div>
  );
}

// ─── Side panel tabs ──────────────────────────────────────────────────────────

type SideTab = "info" | "custom" | "actions";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [stats, setStats] = useState<AdminUserStatsResponse | null>(null);
  const [customConfig, setCustomConfig] = useState<CustomPlanTemplate | null>(
    null,
  );

  const [initialLoading, setInitialLoading] = useState(true);
  const [statsRefreshing, setStatsRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sideTab, setSideTab] = useState<SideTab>("info");

  // Sub-dialogs
  const [creditDialog, setCreditDialog] = useState(false);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");

  const [planDialog, setPlanDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanId | "">("");

  // Custom plan dialogs
  const [configDialog, setConfigDialog] = useState<"create" | "edit" | null>(
    null,
  );
  const [configForm, setConfigForm] = useState<ConfigForm>(EMPTY_FORM);
  const [assignDialog, setAssignDialog] = useState(false);
  const [assignForm, setAssignForm] = useState<ConfigForm>(EMPTY_FORM);

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadAll = useCallback(() => {
    let cancelled = false;
    setInitialLoading(true);
    setError(null);
    Promise.all([
      adminUsersApi.detail(id),
      adminUsersApi.getUserStats(id),
      adminCustomPlansApi.getForUser(id).catch(() => null),
    ])
      .then(([d, s, c]) => {
        if (!cancelled) {
          setDetail(d);
          setStats(s);
          setCustomConfig(c ?? null);
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

  const refreshStats = useCallback(() => {
    let cancelled = false;
    setStatsRefreshing(true);
    Promise.all([
      adminUsersApi.detail(id),
      adminUsersApi.getUserStats(id),
      adminCustomPlansApi.getForUser(id).catch(() => null),
    ])
      .then(([d, s, c]) => {
        if (!cancelled) {
          setDetail(d);
          setStats(s);
          setCustomConfig(c ?? null);
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
      refreshStats();
    } finally {
      setBusy(false);
    }
  }

  async function handleChangeStandardPlan() {
    if (!selectedPlan || selectedPlan === "CUSTOM") return;
    setBusy(true);
    try {
      await adminUsersApi.changePlan(id, selectedPlan);
      setPlanDialog(false);
      setSelectedPlan("");
      refreshStats();
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveConfig() {
    const f = configForm;
    setBusy(true);
    try {
      await adminCustomPlansApi.create({
        userId: id,
        name: f.name,
        description: f.description || undefined,
        priceAriary: parseInt(f.priceAriary) || 0,
        durationDays: parseInt(f.durationDays) || 30,
        credits: parseInt(f.credits),
        maxPages: parseInt(f.maxPages),
        maxManagedPosts: parseInt(f.maxManagedPosts),
        maxReferenceImages: parseInt(f.maxReferenceImages),
        isVisible: f.isVisible,
        isPurchasable: f.isPurchasable,
        note: f.note || undefined,
      });
      setConfigDialog(null);
      refreshStats();
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdateConfig() {
    if (!customConfig) return;
    const f = configForm;
    setBusy(true);
    try {
      await adminCustomPlansApi.update(customConfig.id, {
        name: f.name,
        description: f.description || undefined,
        priceAriary: parseInt(f.priceAriary) || 0,
        durationDays: parseInt(f.durationDays) || 30,
        credits: parseInt(f.credits),
        maxPages: parseInt(f.maxPages),
        maxManagedPosts: parseInt(f.maxManagedPosts),
        maxReferenceImages: parseInt(f.maxReferenceImages),
        isVisible: f.isVisible,
        isPurchasable: f.isPurchasable,
        note: f.note || undefined,
      });
      setConfigDialog(null);
      refreshStats();
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteConfig() {
    if (!customConfig) return;
    setBusy(true);
    try {
      await adminCustomPlansApi.remove(customConfig.id);
      setCustomConfig(null);
      refreshStats();
    } finally {
      setBusy(false);
    }
  }

  async function handleAssignCustom() {
    const f = assignForm;
    setBusy(true);
    try {
      await adminUsersApi.createCustomSubscription(id, {
        credits: parseInt(f.credits),
        durationDays: parseInt(f.durationDays) || 30,
        priceAriary: parseInt(f.priceAriary) || 0,
        maxPages: parseInt(f.maxPages),
        maxManagedPosts: parseInt(f.maxManagedPosts),
        maxReferenceImages: parseInt(f.maxReferenceImages),
        note: f.note || undefined,
      });
      setAssignDialog(false);
      refreshStats();
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleConfigVisibility() {
    if (!customConfig) return;
    setBusy(true);
    try {
      await adminCustomPlansApi.toggle(customConfig.id);
      refreshStats();
    } finally {
      setBusy(false);
    }
  }

  function openCreateConfig() {
    setConfigForm(EMPTY_FORM);
    setConfigDialog("create");
  }

  function openEditConfig() {
    if (!customConfig) return;
    setConfigForm(fromConfig(customConfig));
    setConfigDialog("edit");
  }

  function openAssignDialog() {
    // Préremplir avec la config existante si disponible
    if (customConfig) {
      setAssignForm(fromConfig(customConfig));
    } else {
      setAssignForm(EMPTY_FORM);
    }
    setAssignDialog(true);
  }

  const isConfigFormValid = (f: ConfigForm) =>
    Boolean(
      f.name &&
      f.credits &&
      f.maxPages &&
      f.maxManagedPosts &&
      f.maxReferenceImages,
    );

  // ── Guards ────────────────────────────────────────────────────────────────

  if (initialLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-9 w-64 bg-white/5" />
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg bg-white/5" />
          ))}
        </div>
        <div className="flex gap-4">
          <Skeleton className="flex-1 h-72 rounded-lg bg-white/5" />
          <Skeleton className="w-72 h-72 rounded-lg bg-white/5" />
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertCircle className="mb-3 h-8 w-8 text-muted-foreground/20" />
        <p className="text-sm font-medium text-foreground/50">
          {error ?? "Utilisateur introuvable"}
        </p>
        <Button variant="ghost" size="sm" className="mt-4" asChild>
          <Link href="/users">
            <ArrowLeft className="mr-1.5 h-3 w-3" />
            Retour
          </Link>
        </Button>
      </div>
    );
  }

  const { user, subscription, businessProfiles, usage } = detail;
  const currentPlan = user.activePlan as PlanId;
  const cc = customConfig as unknown as Record<string, unknown> | null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 pb-10">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div>
        <Link
          href="/users"
          className="mb-2 inline-flex items-center gap-1 text-[10px] text-muted-foreground/40 hover:text-muted-foreground transition-colors"
        >
          <ArrowLeft className="h-2.5 w-2.5" />
          Utilisateurs
        </Link>

        <div className="flex items-center justify-between">
          {/* Identity */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 text-sm font-bold text-emerald-500 ring-2 ring-emerald-500/20">
                {user.email[0].toUpperCase()}
              </div>
              {!user.isSuspended && (
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-background" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[16px] font-semibold tracking-tight">
                  {user.username}
                </h1>
                {user.isSuspended && (
                  <Badge
                    variant="destructive"
                    className="text-[10px] h-4 px-1.5"
                  >
                    Suspendu
                  </Badge>
                )}
                {currentPlan === "CUSTOM" ? (
                  <Badge
                    variant="outline"
                    className="h-4 gap-1 border-yellow-500/30 bg-yellow-500/10 text-yellow-500 text-[10px] px-1.5"
                  >
                    <Crown className="h-2.5 w-2.5" />
                    Custom
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className={cn(
                      "h-4 text-[10px] px-1.5",
                      currentPlan === "PRO"
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : currentPlan === "STARTER"
                          ? "border-sky-500/30 bg-sky-500/10 text-sky-500"
                          : "border-border/50 text-muted-foreground/60",
                    )}
                  >
                    {PLANS[currentPlan]?.label ?? currentPlan}
                  </Badge>
                )}
                {customConfig && (
                  <Badge
                    variant="outline"
                    className="h-4 gap-0.5 border-emerald-500/20 bg-emerald-500/5 text-emerald-500 text-[9px] px-1.5"
                  >
                    <Sparkles className="h-2 w-2" />
                    Config custom
                  </Badge>
                )}
                {statsRefreshing && (
                  <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground/30" />
                )}
              </div>
              <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                {user.email}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => {
                setSelectedPlan(currentPlan);
                setPlanDialog(true);
              }}
            >
              <Layers className="h-3 w-3" />
              Plan
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => setCreditDialog(true)}
            >
              <CreditCard className="h-3 w-3" />
              Crédits
            </Button>
            {user.isSuspended ? (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
                disabled={busy}
                onClick={handleReactivate}
              >
                <ShieldCheck className="h-3 w-3" />
                Réactiver
              </Button>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5 border-orange-500/30 text-orange-500 hover:bg-orange-500/10"
                    disabled={busy}
                  >
                    <ShieldAlert className="h-3 w-3" />
                    Suspendre
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Suspendre {user.email} ?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      L&apos;utilisateur ne pourra plus se connecter.
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
                  className="h-7 w-7 p-0 text-muted-foreground/30 hover:text-destructive"
                  disabled={busy}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer {user.email} ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Action irréversible. Toutes les données seront supprimées.
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
      </div>

      {/* ── KPI row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
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
          accent="emerald"
          loading={statsRefreshing}
        />
        <StatCard
          label="Réponses IA"
          value={stats?.aiStats.repliesTotal.toLocaleString("fr-FR") ?? "—"}
          icon={Bot}
          loading={statsRefreshing}
        />
        <StatCard
          label="Conversations"
          value={
            stats?.responseRate.totalConversations.toLocaleString("fr-FR") ??
            "—"
          }
          icon={MessageSquare}
          sub={
            stats ? `${stats.responseRate.globalRate}% taux réponse` : undefined
          }
          loading={statsRefreshing}
        />
        <StatCard
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

      {/* ── Today ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Messages aujourd'hui"
          value={stats?.activityToday.messagesReceived ?? "—"}
          icon={MessageSquare}
          loading={statsRefreshing}
        />
        <StatCard
          label="Commentaires"
          value={stats?.activityToday.commentsReceived ?? "—"}
          icon={MessageSquare}
          loading={statsRefreshing}
        />
        <StatCard
          label="Réponses IA aujourd'hui"
          value={stats?.activityToday.aiRepliesSent ?? "—"}
          icon={Bot}
          accent="primary"
          loading={statsRefreshing}
        />
        <StatCard
          label="Interventions humaines"
          value={stats?.activityToday.humanInterventions ?? "—"}
          icon={User}
          loading={statsRefreshing}
        />
      </div>

      {/* ── Main content : charts + side panel ──────────────────────── */}
      <div className="flex gap-4 items-start">
        {/* Charts column */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Activity chart */}
          {stats && (
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50 mb-4">
                Activité 7 derniers jours
              </p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart
                  data={stats.weeklyChart}
                  barSize={8}
                  barCategoryGap="35%"
                >
                  <CartesianGrid
                    stroke="hsl(var(--border))"
                    strokeDasharray="2 4"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    tick={{
                      fontSize: 10,
                      fill: "hsl(var(--muted-foreground))",
                      opacity: 0.5,
                    }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{
                      fontSize: 10,
                      fill: "hsl(var(--muted-foreground))",
                      opacity: 0.5,
                    }}
                    axisLine={false}
                    tickLine={false}
                    width={20}
                  />
                  <RechartsTooltip
                    content={<ChartTip />}
                    cursor={{ fill: "hsl(var(--border))", opacity: 0.3 }}
                  />
                  <Bar
                    dataKey="messages"
                    name="Messages"
                    stackId="a"
                    fill="hsl(var(--muted-foreground)/0.2)"
                  />
                  <Bar
                    dataKey="aiReplies"
                    name="Réponses IA"
                    stackId="a"
                    fill="hsl(var(--primary))"
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Credits chart */}
          {stats && (
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50 mb-4">
                Consommation crédits — 30 jours
              </p>
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={stats.creditChart}>
                  <defs>
                    <linearGradient id="gce" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="oklch(0.70 0.18 162)"
                        stopOpacity={0.15}
                      />
                      <stop
                        offset="95%"
                        stopColor="oklch(0.70 0.18 162)"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="hsl(var(--border))"
                    strokeDasharray="2 4"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    tick={{
                      fontSize: 10,
                      fill: "hsl(var(--muted-foreground))",
                      opacity: 0.5,
                    }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{
                      fontSize: 10,
                      fill: "hsl(var(--muted-foreground))",
                      opacity: 0.5,
                    }}
                    axisLine={false}
                    tickLine={false}
                    width={28}
                  />
                  <RechartsTooltip
                    content={<ChartTip />}
                    cursor={{ stroke: "hsl(var(--border))" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="creditsConsumed"
                    name="Crédits"
                    stroke="oklch(0.70 0.18 162)"
                    strokeWidth={1.5}
                    fill="url(#gce)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Usage + profils row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-border bg-card p-4">
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
            <div className="rounded-lg border border-border bg-card p-4">
              <SectionTitle>Profils ({businessProfiles.length})</SectionTitle>
              {businessProfiles.length === 0 ? (
                <p className="text-[11px] text-muted-foreground/40">
                  Aucun profil configuré.
                </p>
              ) : (
                <div className="space-y-1">
                  {businessProfiles.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded bg-white/5 px-2 py-1.5"
                    >
                      <span className="text-[11px] font-medium">{p.name}</span>
                      <span className="text-[10px] text-muted-foreground/40">
                        {p.businessType}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Side panel ──────────────────────────────────────────── */}
        <div className="w-70 shrink-0 space-y-0 rounded-xl border border-border bg-card overflow-hidden">
          {/* Tab nav */}
          <div className="flex border-b border-border">
            {[
              { key: "info" as const, icon: Info, label: "Infos" },
              { key: "custom" as const, icon: Crown, label: "Custom" },
              { key: "actions" as const, icon: Settings, label: "Actions" },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSideTab(tab.key)}
                className={cn(
                  "flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors border-b-2",
                  sideTab === tab.key
                    ? "border-emerald-500 text-emerald-500 bg-emerald-500/5"
                    : "border-transparent text-muted-foreground/40 hover:text-muted-foreground",
                )}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
                {tab.key === "custom" && customConfig && (
                  <span className="h-1 w-1 rounded-full bg-emerald-500" />
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-4 space-y-3">
            {/* ── Infos tab ─────────────────────────────────────── */}
            {sideTab === "info" && (
              <>
                <SectionTitle>Abonnement</SectionTitle>
                {subscription ? (
                  <div>
                    <Row
                      label="Plan"
                      value={
                        PLANS[subscription.plan as PlanId]?.label ??
                        subscription.plan
                      }
                    />
                    <Row
                      label="Crédits"
                      value={subscription.creditsGranted.toLocaleString(
                        "fr-FR",
                      )}
                    />
                    <Row
                      label="Expire"
                      value={new Date(
                        subscription.periodEnd,
                      ).toLocaleDateString("fr-FR")}
                    />
                    <Row
                      label="Statut"
                      value={
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-500">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          {subscription.status}
                        </span>
                      }
                    />
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground/40">
                    Aucun abonnement actif.
                  </p>
                )}

                <div className="my-3 border-t border-border/30" />
                <SectionTitle>Compte</SectionTitle>
                <Row label="Provider" value={user.provider ?? "LOCAL"} />
                <Row
                  label="Vérifié"
                  value={
                    user.emailVerified ? (
                      <span className="text-emerald-500">✓ Oui</span>
                    ) : (
                      <span className="text-muted-foreground/50">Non</span>
                    )
                  }
                />
                <Row
                  label="Inscrit"
                  value={new Date(user.createdAt).toLocaleDateString("fr-FR")}
                />
                <Row
                  label="Mis à jour"
                  value={new Date(user.updatedAt).toLocaleDateString("fr-FR")}
                />

                {/* Taux de réponse */}
                {stats && (
                  <>
                    <div className="my-3 border-t border-border/30" />
                    <SectionTitle>Taux de réponse</SectionTitle>
                    {[
                      {
                        label: "Global",
                        val: `${stats.responseRate.globalRate}%`,
                        color: "bg-emerald-500",
                      },
                      {
                        label: "IA",
                        val: `${stats.responseRate.aiRate}%`,
                        color: "bg-primary",
                      },
                      {
                        label: "Humain",
                        val: `${stats.responseRate.humanRate}%`,
                        color: "bg-sky-500",
                      },
                      {
                        label: "Sans réponse",
                        val: stats.responseRate.unansweredCount.toString(),
                        color: "bg-muted",
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              item.color,
                            )}
                          />
                          <span className="text-[10px] text-muted-foreground/50">
                            {item.label}
                          </span>
                        </div>
                        <span className="font-mono text-[11px] font-semibold">
                          {item.val}
                        </span>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}

            {/* ── Custom tab ────────────────────────────────────── */}
            {sideTab === "custom" && (
              <>
                {customConfig ? (
                  <>
                    {/* Config existante */}
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <Crown className="h-3.5 w-3.5 text-yellow-400" />
                          <p className="text-[12px] font-semibold">
                            {customConfig.name}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 text-muted-foreground/50 hover:text-foreground"
                            onClick={openEditConfig}
                            disabled={busy}
                          >
                            <Edit3 className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 text-muted-foreground/30 hover:text-destructive"
                            onClick={handleDeleteConfig}
                            disabled={busy}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <Row
                        label="Crédits"
                        value={(customConfig.credits ?? 0).toLocaleString(
                          "fr-FR",
                        )}
                      />
                      <Row
                        label="Durée"
                        value={`${customConfig.durationDays ?? 30}j`}
                      />
                      <Row
                        label="Prix"
                        value={
                          (customConfig.priceAriary ?? 0) === 0
                            ? "Gratuit"
                            : `${(customConfig.priceAriary ?? 0).toLocaleString("fr-FR")} Ar`
                        }
                      />
                      <Row label="Pages" value={customConfig.maxPages ?? "—"} />
                      <Row
                        label="Posts"
                        value={customConfig.maxManagedPosts ?? "—"}
                      />
                      <Row
                        label="Images"
                        value={customConfig.maxReferenceImages ?? "—"}
                      />
                    </div>

                    {/* Badges état */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px] h-5 gap-1 cursor-pointer",
                          cc?.isActive !== false && cc?.isVisible !== false
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                            : "border-border/40 text-muted-foreground/40",
                        )}
                        onClick={handleToggleConfigVisibility}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            cc?.isActive !== false && cc?.isVisible !== false
                              ? "bg-emerald-500"
                              : "bg-muted-foreground/30",
                          )}
                        />
                        {cc?.isActive !== false && cc?.isVisible !== false
                          ? "Visible"
                          : "Caché"}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px] h-5",
                          cc?.isPurchasable !== false
                            ? "border-sky-500/30 bg-sky-500/10 text-sky-500"
                            : "border-border/40 text-muted-foreground/40",
                        )}
                      >
                        {cc?.isPurchasable !== false
                          ? "Achetable Papi"
                          : "Manuel uniquement"}
                      </Badge>
                    </div>

                    {/* Bouton attribuer */}
                    <Button
                      size="sm"
                      className="w-full h-7 text-xs gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white"
                      onClick={openAssignDialog}
                      disabled={busy}
                    >
                      <Zap className="h-3 w-3" />
                      Attribuer maintenant (sans Papi)
                    </Button>
                  </>
                ) : (
                  <>
                    {/* Aucune config */}
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-500/10 mb-3">
                        <Crown className="h-5 w-5 text-yellow-400/50" />
                      </div>
                      <p className="text-[12px] font-medium text-foreground/50">
                        Aucune config custom
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground/30 leading-snug max-w-50">
                        Cet utilisateur voit &quot;Nous contacter&quot; sur la
                        page /billing.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="w-full h-7 text-xs gap-1.5"
                      onClick={openCreateConfig}
                    >
                      <Crown className="h-3 w-3 text-yellow-400" />
                      Créer une config custom
                    </Button>
                  </>
                )}
              </>
            )}

            {/* ── Actions tab ───────────────────────────────────── */}
            {sideTab === "actions" && (
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground/40 mb-3">
                  Actions rapides
                </p>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-7 text-xs justify-start gap-2"
                  onClick={() => {
                    setSelectedPlan(currentPlan);
                    setPlanDialog(true);
                  }}
                >
                  <Layers className="h-3 w-3 text-primary" />
                  Changer de plan standard
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-7 text-xs justify-start gap-2"
                  onClick={() => setCreditDialog(true)}
                >
                  <CreditCard className="h-3 w-3 text-emerald-500" />
                  Ajuster les crédits
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-7 text-xs justify-start gap-2"
                  onClick={() => {
                    setSideTab("custom");
                    setTimeout(openAssignDialog, 100);
                  }}
                >
                  <Zap className="h-3 w-3 text-yellow-400" />
                  Attribuer abonnement custom
                </Button>

                <div className="my-3 border-t border-border/30" />

                {user.isSuspended ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-7 text-xs justify-start gap-2 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
                    disabled={busy}
                    onClick={handleReactivate}
                  >
                    <ShieldCheck className="h-3 w-3" />
                    Réactiver le compte
                  </Button>
                ) : (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-7 text-xs justify-start gap-2 border-orange-500/30 text-orange-500 hover:bg-orange-500/10"
                        disabled={busy}
                      >
                        <ShieldAlert className="h-3 w-3" />
                        Suspendre le compte
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Suspendre {user.email} ?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          L&apos;utilisateur ne pourra plus se connecter.
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
                      variant="outline"
                      size="sm"
                      className="w-full h-7 text-xs justify-start gap-2 border-destructive/30 text-destructive hover:bg-destructive/10"
                      disabled={busy}
                    >
                      <Trash2 className="h-3 w-3" />
                      Supprimer définitivement
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Supprimer {user.email} ?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Action irréversible. Toutes les données seront
                        supprimées.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={handleDelete}
                      >
                        Supprimer
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
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
            <DialogTitle className="text-sm">Ajuster les crédits</DialogTitle>
            <DialogDescription className="text-xs">
              Solde actuel :{" "}
              <strong className="text-emerald-500">
                {stats?.subscription.creditBalance.toLocaleString("fr-FR") ??
                  "—"}{" "}
                crédits
              </strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground/50">
                Montant (+/-)
              </Label>
              <Input
                type="number"
                placeholder="ex: +500 ou -100"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                className="h-8 text-sm"
              />
              {creditAmount && !isNaN(parseFloat(creditAmount)) && stats && (
                <p className="text-[10px] text-muted-foreground/60">
                  Nouveau solde :{" "}
                  <span className="font-semibold text-emerald-500">
                    {Math.max(
                      0,
                      stats.subscription.creditBalance +
                        parseFloat(creditAmount),
                    ).toLocaleString("fr-FR")}
                  </span>
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground/50">
                Raison *
              </Label>
              <Input
                placeholder="Compensation erreur système…"
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
                className="h-8 text-sm"
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
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
              onClick={handleAdjustCredits}
              disabled={busy || !creditAmount || !creditReason.trim()}
            >
              {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════════
          Dialog : Changer de plan standard
      ════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={planDialog}
        onOpenChange={(o) => {
          if (!busy) setPlanDialog(o);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">
              Changer de plan standard
            </DialogTitle>
            <DialogDescription className="text-xs">
              Plan actuel :{" "}
              <strong>{PLANS[currentPlan]?.label ?? currentPlan}</strong>. Pour
              le plan Custom, utilisez l&apos;onglet{" "}
              <Crown className="inline h-3 w-3 text-yellow-400 mx-0.5" />
              Custom.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2 py-1">
            {(Object.values(PLANS) as PlanConfig[])
              .filter((p) => p.id !== "CUSTOM")
              .map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  selected={selectedPlan === plan.id}
                  current={currentPlan === plan.id && currentPlan !== "CUSTOM"}
                  onClick={() => setSelectedPlan(plan.id as PlanId)}
                />
              ))}
          </div>
          {selectedPlan &&
            selectedPlan !== currentPlan &&
            (() => {
              const cur = PLANS[currentPlan];
              const next = PLANS[selectedPlan as PlanId];
              if (cur?.credits && next?.credits && next.credits < cur.credits) {
                return (
                  <div className="flex items-start gap-2 rounded-md border border-orange-500/20 bg-orange-500/5 px-3 py-2">
                    <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-orange-500" />
                    <p className="text-[10px] text-orange-500">
                      Downgrade : crédits réinitialisés à{" "}
                      {next.credits.toLocaleString("fr-FR")}.
                    </p>
                  </div>
                );
              }
              return null;
            })()}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPlanDialog(false)}
              disabled={busy}
            >
              Annuler
            </Button>
            <Button
              size="sm"
              onClick={handleChangeStandardPlan}
              disabled={
                busy ||
                !selectedPlan ||
                selectedPlan === currentPlan ||
                selectedPlan === "CUSTOM"
              }
            >
              {busy && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
              {selectedPlan && selectedPlan !== currentPlan
                ? `Passer en ${PLANS[selectedPlan as PlanId]?.label}`
                : "Choisir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════════
          Dialog : Créer / éditer config custom
      ════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={configDialog !== null}
        onOpenChange={(o) => {
          if (!busy && !o) setConfigDialog(null);
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Crown className="h-4 w-4 text-yellow-400" />
              {configDialog === "edit"
                ? "Modifier la config custom"
                : "Créer une config custom"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {configDialog === "edit"
                ? "L'utilisateur verra les nouvelles limites dans /billing. L'abonnement actif n'est pas modifié."
                : "L'utilisateur verra une offre personnalisée sur sa page /billing."}
            </DialogDescription>
          </DialogHeader>
          <ConfigFormFields
            form={configForm}
            onChange={(k, v) => setConfigForm((p) => ({ ...p, [k]: v }))}
          />
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfigDialog(null)}
              disabled={busy}
            >
              Annuler
            </Button>
            <Button
              size="sm"
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
              onClick={
                configDialog === "edit" ? handleUpdateConfig : handleSaveConfig
              }
              disabled={busy || !isConfigFormValid(configForm)}
            >
              {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {configDialog === "edit" ? "Mettre à jour" : "Créer la config"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════════
          Dialog : Attribuer abonnement custom (sans Papi)
      ════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={assignDialog}
        onOpenChange={(o) => {
          if (!busy) setAssignDialog(o);
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-500" />
              Attribuer abonnement custom
            </DialogTitle>
            <DialogDescription className="text-xs">
              Active immédiatement un abonnement CUSTOM pour{" "}
              <strong>{user.email}</strong> sans paiement Papi.
              {customConfig && " Prérempli depuis la config existante."}
            </DialogDescription>
          </DialogHeader>

          {customConfig && (
            <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 mb-2">
              <p className="text-[10px] text-emerald-500/70 mb-1">
                Depuis la config : {customConfig.name}
              </p>
              <div className="flex gap-4 text-[10px] text-muted-foreground/60">
                <span>
                  <strong className="text-foreground">
                    {customConfig.credits?.toLocaleString("fr-FR")}
                  </strong>{" "}
                  crédits
                </span>
                <span>
                  <strong className="text-foreground">
                    {customConfig.durationDays ?? 30}
                  </strong>{" "}
                  jours
                </span>
                <span>
                  <strong className="text-foreground">
                    {customConfig.maxPages}
                  </strong>{" "}
                  pages
                </span>
              </div>
            </div>
          )}

          <ConfigFormFields
            form={assignForm}
            onChange={(k, v) => setAssignForm((p) => ({ ...p, [k]: v }))}
          />

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAssignDialog(false)}
              disabled={busy}
            >
              Annuler
            </Button>
            <Button
              size="sm"
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
              onClick={handleAssignCustom}
              disabled={busy || !isConfigFormValid(assignForm)}
            >
              {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              <Zap className="mr-1.5 h-3 w-3" />
              Attribuer maintenant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
