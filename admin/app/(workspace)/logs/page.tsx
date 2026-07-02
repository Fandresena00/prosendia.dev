"use client";

// app/(workspace)/logs/page.tsx — émeraude cohérent, gestion erreur robuste

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  adminLogsApi,
  type AdminAuditLog,
  type PaginatedResult,
} from "@/lib/admin-api";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ScrollText,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

// ─── Action metadata ──────────────────────────────────────────────────────────

const ACTION_META: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  LOGIN: {
    label: "Connexion",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  SUSPEND_USER: {
    label: "Suspension",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
  },
  REACTIVATE_USER: {
    label: "Réactivation",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  DELETE_USER: {
    label: "Suppression",
    color: "text-red-400",
    bg: "bg-red-500/10",
  },
  CHANGE_PLAN: {
    label: "Changement plan",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  ADD_CREDITS: {
    label: "+ Crédits",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  REMOVE_CREDITS: {
    label: "- Crédits",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
  },
  CREATE_ADMIN: {
    label: "Créer admin",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  DELETE_ADMIN: {
    label: "Suppr. admin",
    color: "text-red-400",
    bg: "bg-red-500/10",
  },
  REVOKE_SUBSCRIPTION: {
    label: "Révoquer sub",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
  },
  ACTIVATE_SUBSCRIPTION: {
    label: "Activer sub",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
};

// ─── Label map ────────────────────────────────────────────────────────────────

const LABEL: Record<string, string> = {
  previousBalance: "Ancien solde",
  newBalance: "Nouveau solde",
  previousPlan: "Ancien plan",
  plan: "Nouveau plan",
  previousState: "Avant",
  newState: "Après",
  amount: "Montant",
  applied: "Appliqué",
  credits: "Crédits",
  email: "Email",
  reason: "Raison",
  durationDays: "Durée (j)",
  priceAriary: "Prix (Ar)",
  maxPages: "Pages max",
  maxManagedPosts: "Posts max",
  maxReferenceImages: "Images max",
  note: "Note",
};

const BEFORE_KEYS = ["previousBalance", "previousPlan", "previousState"];
const AFTER_KEYS = [
  "newBalance",
  "plan",
  "amount",
  "applied",
  "credits",
  "newState",
];
const SKIP_KEYS = ["subscriptionId", "ip"];

function MetaDiff({ meta }: { meta: Record<string, unknown> }) {
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  const other: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(meta)) {
    if (SKIP_KEYS.includes(k)) continue;
    if (BEFORE_KEYS.includes(k)) before[k] = v;
    else if (AFTER_KEYS.includes(k)) after[k] = v;
    else other[k] = v;
  }

  const fmt = (v: unknown): string => {
    if (v === null || v === undefined) return "—";
    if (typeof v === "object") return JSON.stringify(v);
    if (typeof v === "number") return v.toLocaleString("fr-FR");
    return String(v);
  };

  const hasBefore = Object.keys(before).length > 0;
  const hasAfter = Object.keys(after).length > 0;
  const hasOther = Object.keys(other).length > 0;

  if (!hasBefore && !hasAfter && !hasOther) return null;

  return (
    <div className="mt-3 space-y-2.5 rounded-2xl border border-border/70 bg-background/70 p-3">
      {(hasBefore || hasAfter) && (
        <div className="flex flex-col gap-2 md:flex-row">
          {hasBefore && (
            <div className="flex-1 rounded-xl border border-orange-500/15 bg-orange-500/10 px-3 py-2.5">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-500/80">
                Avant
              </p>
              {Object.entries(before).map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-center justify-between gap-2 py-0.5"
                >
                  <span className="text-[11px] text-muted-foreground/70">
                    {LABEL[k] ?? k}
                  </span>
                  <span className="font-mono text-[11px] font-medium text-orange-500">
                    {fmt(v)}
                  </span>
                </div>
              ))}
            </div>
          )}
          {hasAfter && (
            <div className="flex-1 rounded-xl border border-emerald-500/15 bg-emerald-500/10 px-3 py-2.5">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-500/80">
                Après
              </p>
              {Object.entries(after).map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-center justify-between gap-2 py-0.5"
                >
                  <span className="text-[11px] text-muted-foreground/70">
                    {LABEL[k] ?? k}
                  </span>
                  <span className="font-mono text-[11px] font-medium text-emerald-500">
                    {fmt(v)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {hasOther && (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(other).map(([k, v]) => (
            <span
              key={k}
              className="rounded-full border border-border/70 bg-card/70 px-2.5 py-1 text-[10px]"
            >
              <span className="text-muted-foreground/70">
                {LABEL[k] ?? k}: {""}
              </span>
              <span className="font-mono font-medium text-foreground/80">
                {fmt(v)}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function LogRow({ log }: { log: AdminAuditLog }) {
  const [expanded, setExpanded] = useState(false);
  const meta = (log.metadata ?? {}) as Record<string, unknown>;
  const hasMeta =
    Object.keys(meta).filter((k) => !SKIP_KEYS.includes(k)).length > 0;
  const action = ACTION_META[log.action] ?? {
    label: log.action,
    color: "text-muted-foreground/50",
    bg: "bg-white/5",
  };

  return (
    <div
      className={`rounded-2xl border bg-card/70 p-4 shadow-sm transition-all ${
        hasMeta
          ? "cursor-pointer hover:border-primary/25 hover:bg-card/90"
          : "border-border/70"
      } ${expanded ? "border-primary/20 bg-card/90 shadow-md" : "border-border/70"}`}
      onClick={() => hasMeta && setExpanded((e) => !e)}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${action.bg} ${action.color}`}
        >
          {action.label}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold text-foreground">
              {log.adminEmail}
            </span>
            {log.targetId && (
              <>
                <span className="text-muted-foreground/50 text-xs">→</span>
                <span className="max-w-40 truncate font-mono text-[11px] text-muted-foreground/70">
                  {log.targetId}
                </span>
              </>
            )}
            <span className="rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-[10px] text-muted-foreground/70">
              {log.targetType}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono text-[11px] text-muted-foreground/70 tabular-nums">
            {new Date(log.createdAt).toLocaleString("fr-FR", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {hasMeta && (
            <span className="rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-[10px] text-muted-foreground/70">
              {expanded ? "Réduire" : "Détails"}
            </span>
          )}
        </div>
      </div>
      {expanded && hasMeta && <MetaDiff meta={meta} />}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LogsPage() {
  const [result, setResult] = useState<PaginatedResult<AdminAuditLog> | null>(
    null,
  );
  const [admins, setAdmins] = useState<{ id: string; email: string }[]>([]);
  const [adminId, setAdminId] = useState("all");
  const [action, setAction] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState(new Date());

  const refs = useRef({ adminId, action, from, to });
  useEffect(() => {
    refs.current = { adminId, action, from, to };
  }, [adminId, action, from, to]);

  const load = useCallback(
    (
      p: number,
      aId: string,
      act: string,
      fr: string,
      t: string,
      silent = false,
    ) => {
      let cancelled = false;
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      adminLogsApi
        .list({
          page: p,
          pageSize: 30,
          adminId: aId !== "all" ? aId : undefined,
          action: act !== "all" ? act : undefined,
          from: fr || undefined,
          to: t || undefined,
        })
        .then((d) => {
          if (!cancelled) {
            setResult(d);
            setLastSync(new Date());
          }
        })
        .catch((err) => {
          if (!cancelled) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes("404") || msg.includes("Cannot GET")) {
              setError(
                "Endpoint non disponible. Redéployez le backend avec AdminLogsController.",
              );
            } else {
              setError(msg);
            }
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    },
    [],
  );

  useEffect(() => {
    adminLogsApi
      .listAdmins()
      .then(setAdmins)
      .catch(() => {});
  }, []);

  useEffect(() => load(page, adminId, action, from, to), [page]); // eslint-disable-line
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
    load(1, adminId, action, from, to);
  }, [adminId, action, from, to]); // eslint-disable-line

  useEffect(() => {
    const id = setInterval(() => {
      const r = refs.current;
      load(page, r.adminId, r.action, r.from, r.to, true);
    }, 60_000);
    return () => clearInterval(id);
  }, [page, load]);

  const { pagination } = result ?? {};

  return (
    <div className="space-y-5">
      <div className="admin-panel-soft overflow-hidden p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Traçabilité
            </div>
            <h1 className="mt-3 text-[1.5rem] font-semibold tracking-tight sm:text-[1.65rem]">
              Audit logs
            </h1>
            <p className="mt-1.5 text-[0.95rem] text-muted-foreground/80">
              Consultez les actions sensibles, les changements de plan et les
              opérations d’administration dans un flux plus lisible.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-10 gap-2 rounded-full border border-border/70 bg-background/70 px-3 text-sm text-muted-foreground/80 hover:text-foreground"
            onClick={() => load(page, adminId, action, from, to)}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Actualiser
          </Button>
        </div>
      </div>

      {error && (
        <Alert
          variant="destructive"
          className="border-destructive/20 bg-destructive/10 py-3"
        >
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">{error}</AlertDescription>
        </Alert>
      )}

      {!error && (
        <div className="rounded-3xl border border-border/70 bg-card/70 p-4 shadow-sm backdrop-blur">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] font-semibold text-foreground/90">
              Filtres & vue
            </p>
            <p className="text-[11px] text-muted-foreground/70">
              {pagination
                ? `${pagination.total.toLocaleString("fr-FR")} entrées · Rétention 90j`
                : "Chargement…"}
              {!error && (
                <>
                  {" · "}
                  <span className="font-mono text-[10px] text-muted-foreground/70">
                    {lastSync.toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                </>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={adminId} onValueChange={setAdminId}>
              <SelectTrigger className="h-9 w-48 bg-background/80 text-sm">
                <SelectValue placeholder="Tous les admins" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les admins</SelectItem>
                {admins.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={action} onValueChange={setAction}>
              <SelectTrigger className="h-9 w-44 bg-background/80 text-sm">
                <SelectValue placeholder="Toutes actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes actions</SelectItem>
                {Object.entries(ACTION_META).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground/70">Du</span>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-9 w-36 bg-background/80 text-sm"
              />
              <span className="text-[11px] text-muted-foreground/70">au</span>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-9 w-36 bg-background/80 text-sm"
              />
              {(from || to) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 px-2 text-sm text-muted-foreground/70"
                  onClick={() => {
                    setFrom("");
                    setTo("");
                  }}
                >
                  ✕
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {!error && (
        <div className="space-y-2.5">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-border/70 bg-card/70 p-4"
              >
                <Skeleton className="h-4 w-3/4 bg-muted/40" />
              </div>
            ))
          ) : result?.data.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/70 bg-card/50 py-20">
              <ScrollText className="mb-3 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-semibold text-foreground/80">
                Aucun log
              </p>
              <p className="mt-1 text-sm text-muted-foreground/70">
                Modifiez les filtres pour afficher d’autres événements.
              </p>
            </div>
          ) : (
            result?.data.map((log) => <LogRow key={log.id} log={log} />)
          )}
        </div>
      )}

      {!error && pagination && pagination.totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card/70 px-4 py-3">
          <p className="font-mono text-[11px] text-muted-foreground/70">
            Page {pagination.page} / {pagination.totalPages} ·{" "}
            {pagination.total.toLocaleString("fr-FR")} entrées
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
