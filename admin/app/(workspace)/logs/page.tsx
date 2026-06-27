/* eslint-disable react-hooks/refs */
"use client";

// app/(workspace)/logs/page.tsx
// Audit logs — SUPER_ADMIN uniquement
// Filtres : admin, action, période · Pagination · Auto-refresh 60s
// Affiche l'ancien état et le nouvel état depuis metadata

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
import { ChevronLeft, ChevronRight, RefreshCw, ScrollText } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

// ─── Action config ────────────────────────────────────────────────────────────

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
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  DELETE_USER: {
    label: "Suppression",
    color: "text-destructive",
    bg: "bg-destructive/10",
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
    color: "text-destructive",
    bg: "bg-destructive/10",
  },
  ADMIN_ADJUST: {
    label: "Ajust. crédits",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
};

// ─── Metadata diff viewer ─────────────────────────────────────────────────────

function MetaDiff({ meta }: { meta: Record<string, unknown> }) {
  // Champs qui représentent l'ancien état
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  const other: Record<string, unknown> = {};

  const beforeKeys = [
    "previousBalance",
    "previousPlan",
    "reason",
    "suspendedReason",
  ];
  const afterKeys = [
    "newBalance",
    "plan",
    "amount",
    "applied",
    "credits",
    "email",
  ];

  for (const [k, v] of Object.entries(meta)) {
    if (beforeKeys.includes(k)) before[k] = v;
    else if (afterKeys.includes(k)) after[k] = v;
    else other[k] = v;
  }

  const LABEL_MAP: Record<string, string> = {
    previousBalance: "Ancien solde",
    newBalance: "Nouveau solde",
    previousPlan: "Ancien plan",
    plan: "Nouveau plan",
    amount: "Montant",
    applied: "Appliqué",
    credits: "Crédits",
    email: "Email",
    reason: "Raison",
    suspendedReason: "Raison susp.",
    durationDays: "Durée (j)",
    priceAriary: "Prix (Ar)",
    maxPages: "Pages max",
    maxManagedPosts: "Posts max",
    maxReferenceImages: "Images max",
    note: "Note",
    subscriptionId: "Abonnement ID",
  };

  const fmt = (v: unknown) => {
    if (v === null || v === undefined) return "—";
    if (typeof v === "number") return v.toLocaleString("fr-FR");
    return String(v);
  };

  const hasBefore = Object.keys(before).length > 0;
  const hasAfter = Object.keys(after).length > 0;

  if (!hasBefore && !hasAfter && Object.keys(other).length === 0) return null;

  return (
    <div className="mt-2 space-y-1.5">
      {(hasBefore || hasAfter) && (
        <div className="flex gap-2">
          {hasBefore && (
            <div className="flex-1 rounded bg-orange-500/5 border border-orange-500/10 px-2.5 py-2">
              <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-widest text-orange-400/70">
                Avant
              </p>
              {Object.entries(before).map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="text-[10px] text-muted-foreground/50">
                    {LABEL_MAP[k] ?? k}
                  </span>
                  <span className="font-mono text-[10px] font-medium text-orange-400">
                    {fmt(v)}
                  </span>
                </div>
              ))}
            </div>
          )}
          {hasAfter && (
            <div className="flex-1 rounded bg-emerald-500/5 border border-emerald-500/10 px-2.5 py-2">
              <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-widest text-emerald-400/70">
                Après
              </p>
              {Object.entries(after).map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="text-[10px] text-muted-foreground/50">
                    {LABEL_MAP[k] ?? k}
                  </span>
                  <span className="font-mono text-[10px] font-medium text-emerald-400">
                    {fmt(v)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {Object.keys(other).filter((k) => !["subscriptionId", "ip"].includes(k))
        .length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(other)
            .filter(([k]) => !["subscriptionId", "ip"].includes(k))
            .map(([k, v]) => (
              <span
                key={k}
                className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-muted-foreground/50"
              >
                <span className="text-muted-foreground/30">
                  {LABEL_MAP[k] ?? k}:
                </span>{" "}
                <span className="font-mono font-medium text-foreground/60">
                  {fmt(v)}
                </span>
              </span>
            ))}
        </div>
      )}
    </div>
  );
}

// ─── Log row ──────────────────────────────────────────────────────────────────

function LogRow({ log }: { log: AdminAuditLog }) {
  const [expanded, setExpanded] = useState(false);
  const meta = (log.metadata ?? {}) as Record<string, unknown>;
  const action = ACTION_META[log.action] ?? {
    label: log.action,
    color: "text-muted-foreground",
    bg: "bg-white/5",
  };
  const hasMeta =
    Object.keys(meta).length > 1 ||
    (Object.keys(meta).length === 1 && !meta.ip);

  return (
    <div
      className={`group rounded-md border border-border/40 bg-card/40 p-3 transition-colors hover:border-border/70 hover:bg-card/60 ${expanded ? "border-border/70 bg-card/60" : ""}`}
    >
      <div
        className="flex items-start gap-3 cursor-pointer"
        onClick={() => hasMeta && setExpanded((e) => !e)}
      >
        {/* Action badge */}
        <span
          className={`mt-0.5 shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold ${action.bg} ${action.color}`}
        >
          {action.label}
        </span>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12px] font-medium text-foreground">
              {log.adminEmail}
            </span>
            <span className="text-[10px] text-muted-foreground/30">→</span>
            <span className="font-mono text-[11px] text-muted-foreground/60 truncate">
              {log.targetId}
            </span>
            <span className="text-[10px] rounded bg-white/5 px-1.5 py-0.5 text-muted-foreground/40">
              {log.targetType}
            </span>
          </div>
        </div>

        {/* Time */}
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground/30 tabular-nums">
          {new Date(log.createdAt).toLocaleString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        {hasMeta && (
          <span className="shrink-0 text-[10px] text-muted-foreground/20">
            {expanded ? "▲" : "▼"}
          </span>
        )}
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
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  const adminIdRef = useRef(adminId);
  const actionRef = useRef(action);
  const fromRef = useRef(from);
  const toRef = useRef(to);
  adminIdRef.current = adminId;
  actionRef.current = action;
  fromRef.current = from;
  toRef.current = to;

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
      if (!silent) setLoading(true);
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
            setLastRefreshed(new Date());
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
    adminLogsApi.listAdmins().then(setAdmins);
  }, []);

  useEffect(() => load(page, adminId, action, from, to), [page]); // eslint-disable-line
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
    load(1, adminId, action, from, to);
  }, [adminId, action, from, to]); // eslint-disable-line

  // Auto-refresh 60s
  useEffect(() => {
    const id = setInterval(
      () =>
        load(
          page,
          adminIdRef.current,
          actionRef.current,
          fromRef.current,
          toRef.current,
          true,
        ),
      60_000,
    );
    return () => clearInterval(id);
  }, [page, load]);

  const { pagination } = result ?? {};

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight">
            Audit logs
          </h1>
          <p className="mt-0.5 text-[12px] text-muted-foreground/60">
            {pagination
              ? `${pagination.total.toLocaleString("fr-FR")} entrées`
              : "Chargement…"}
            {" · "}Rétention 3 mois{" · "}
            <span className="font-mono text-[10px]">
              {lastRefreshed.toLocaleTimeString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs text-muted-foreground"
          onClick={() => load(page, adminId, action, from, to)}
        >
          <RefreshCw className="h-3 w-3" />
          Actualiser
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/30 p-3">
        {/* Admin filter */}
        <Select value={adminId} onValueChange={setAdminId}>
          <SelectTrigger className="h-7 w-44 bg-background/60 text-xs">
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

        {/* Action filter */}
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="h-7 w-40 bg-background/60 text-xs">
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

        {/* Date range */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground/40">Du</span>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-7 w-36 bg-background/60 text-xs"
          />
          <span className="text-[11px] text-muted-foreground/40">au</span>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-7 w-36 bg-background/60 text-xs"
          />
          {(from || to) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
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

      {/* Log list */}
      <div className="space-y-1.5">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="rounded-md border border-border/30 bg-card/30 p-3"
            >
              <Skeleton className="h-4 w-3/4 bg-white/5" />
            </div>
          ))
        ) : result?.data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <ScrollText className="mb-3 h-8 w-8 text-muted-foreground/20" />
            <p className="text-sm font-medium text-muted-foreground/40">
              Aucun log trouvé
            </p>
            <p className="mt-1 text-xs text-muted-foreground/20">
              Modifiez les filtres
            </p>
          </div>
        ) : (
          result?.data.map((log) => <LogRow key={log.id} log={log} />)
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border/30 pt-4">
          <p className="font-mono text-[11px] text-muted-foreground/30">
            Page {pagination.page} / {pagination.totalPages} ·{" "}
            {pagination.total.toLocaleString("fr-FR")} entrées
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
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
