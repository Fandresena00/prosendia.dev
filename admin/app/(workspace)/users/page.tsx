"use client";

import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  adminUsersApi,
  type AdminUserListItem,
  type PaginatedResult,
} from "@/lib/admin-api";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type PlanFilter = "all" | "FREE" | "STARTER" | "PRO" | "CUSTOM";
type StatusFilter = "all" | "active" | "suspended";

// ─── Semantic maps — single source of truth, same pattern as the ─────────
// ─── SEVERITY_CONFIG used across the client-facing dashboard.       ─────

const PLAN_META: Record<string, { label: string; cls: string }> = {
  FREE: { label: "Gratuit", cls: "border-border bg-transparent text-muted-foreground" },
  STARTER: { label: "Starter", cls: "border-primary/25 bg-primary/10 text-primary" },
  PRO: { label: "Pro", cls: "border-secondary/25 bg-secondary/10 text-secondary-foreground dark:text-secondary" },
  CUSTOM: { label: "Custom", cls: "border-warning/30 bg-warning/10 text-warning" },
};

function SkeletonRows() {
  return Array.from({ length: 10 }).map((_, i) => (
    <TableRow key={i} className="border-border/60 hover:bg-transparent">
      {Array.from({ length: 5 }).map((_, j) => (
        <TableCell key={j}>
          <Skeleton className="h-3.5 w-full" />
        </TableCell>
      ))}
    </TableRow>
  ));
}

export default function UsersPage() {
  const [result, setResult] = useState<PaginatedResult<AdminUserListItem> | null>(null);
  const [search, setSearch] = useState("");
  const [plan, setPlan] = useState<PlanFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState(new Date());

  const filtersRef = useRef({ search, plan, status });
  useEffect(() => {
    filtersRef.current = { search, plan, status };
  }, [search, plan, status]);

  const load = useCallback(
    (p: number, s: string, pl: PlanFilter, st: StatusFilter, silent = false) => {
      let cancelled = false;
      if (!silent) setLoading(true);
      adminUsersApi
        .list({
          page: p,
          pageSize: 20,
          search: s || undefined,
          plan: pl !== "all" ? pl : undefined,
          suspended: st === "suspended" ? true : st === "active" ? false : undefined,
        })
        .then((d) => {
          if (!cancelled) {
            setResult(d);
            setLastSync(new Date());
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

  useEffect(() => load(page, search, plan, status), [page]); // eslint-disable-line
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
    load(1, search, plan, status);
  }, [plan, status]); // eslint-disable-line

  useEffect(() => {
    const id = setInterval(() => {
      const f = filtersRef.current;
      load(page, f.search, f.plan, f.status, true);
    }, 30_000);
    return () => clearInterval(id);
  }, [page, load]);

  const { pagination } = result ?? {};

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="admin-panel overflow-hidden p-6 sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Gestion des comptes
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-[1.7rem]">
              Utilisateurs
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {pagination ? `${pagination.total.toLocaleString("fr-FR")} comptes` : "Chargement…"}
              {" · "}
              <span className="tabular text-xs">
                {lastSync.toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2 rounded-full text-sm text-muted-foreground hover:text-foreground"
            onClick={() => load(page, search, plan, status)}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Actualiser
          </Button>
        </div>
      </div>

      <div className="glass-card flex flex-wrap items-center gap-2 p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            load(1, search, plan, status);
          }}
          className="relative min-w-56 max-w-sm flex-1"
        >
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Email ou nom…"
            className="h-9 bg-background/60 pl-9 text-sm"
          />
        </form>

        <Select value={plan} onValueChange={(v) => setPlan(v as PlanFilter)}>
          <SelectTrigger className="h-9 w-36 bg-background/60 text-sm">
            <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous plans</SelectItem>
            <SelectItem value="FREE">Gratuit</SelectItem>
            <SelectItem value="STARTER">Starter</SelectItem>
            <SelectItem value="PRO">Pro</SelectItem>
            <SelectItem value="CUSTOM">Custom</SelectItem>
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <SelectTrigger className="h-9 w-36 bg-background/60 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="active">Actifs</SelectItem>
            <SelectItem value="suspended">Suspendus</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="glass-card flex-1 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-label">Utilisateur</TableHead>
              <TableHead className="text-label">Plan</TableHead>
              <TableHead className="text-label text-right">Crédits</TableHead>
              <TableHead className="text-label">Inscrit</TableHead>
              <TableHead className="text-label">Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <SkeletonRows />
            ) : result?.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-20 text-center">
                  <p className="text-sm font-medium">Aucun résultat</p>
                  <p className="mt-1 text-xs text-muted-foreground">Modifiez les filtres</p>
                </TableCell>
              </TableRow>
            ) : (
              result?.data.map((user) => {
                const pm = PLAN_META[user.activePlan] ?? {
                  label: user.activePlan,
                  cls: "border-border text-muted-foreground",
                };
                return (
                  <TableRow key={user.id} className="group border-border/70 hover:bg-primary/5">
                    <TableCell>
                      <Link href={`/users/${user.id}`} className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/15 to-secondary/15 text-[11px] font-bold text-primary ring-1 ring-primary/10">
                          {user.email[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium leading-tight transition-colors group-hover:text-primary">
                            {user.username}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[11px] font-medium ${pm.cls}`}>
                        {pm.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular text-right text-sm font-semibold">
                      {user.creditBalance.toLocaleString("fr-FR")}
                    </TableCell>
                    <TableCell className="tabular text-xs text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell>
                      {user.isSuspended ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/20 bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
                          <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                          Suspendu
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-secondary/20 bg-secondary/10 px-2.5 py-1 text-xs font-medium text-secondary-foreground dark:text-secondary">
                          <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
                          Actif
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="tabular text-xs text-muted-foreground">
            Page {pagination.page} / {pagination.totalPages} ·{" "}
            {pagination.total.toLocaleString("fr-FR")} utilisateurs
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
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
