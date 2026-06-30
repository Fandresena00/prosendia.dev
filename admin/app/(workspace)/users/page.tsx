"use client";

// app/(workspace)/users/page.tsx — émeraude cohérent, auto-refresh 30s

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
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type PlanFilter = "all" | "FREE" | "STARTER" | "PRO" | "CUSTOM";
type StatusFilter = "all" | "active" | "suspended";

const PLAN_META: Record<string, { label: string; cls: string }> = {
  FREE: {
    label: "Gratuit",
    cls: "border-border/40 text-muted-foreground/60 bg-transparent",
  },
  STARTER: {
    label: "Starter",
    cls: "border-sky-500/30 bg-sky-500/10 text-sky-400",
  },
  PRO: { label: "Pro", cls: "border-primary/30 bg-primary/10 text-primary" },
  CUSTOM: {
    label: "Custom",
    cls: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",
  },
};

function SkeletonRows() {
  return Array.from({ length: 10 }).map((_, i) => (
    <TableRow key={i} className="hover:bg-transparent border-border/30">
      {Array.from({ length: 5 }).map((_, j) => (
        <TableCell key={j}>
          <Skeleton className="h-3.5 w-full bg-white/5" />
        </TableCell>
      ))}
    </TableRow>
  ));
}

export default function UsersPage() {
  const [result, setResult] =
    useState<PaginatedResult<AdminUserListItem> | null>(null);
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
    (
      p: number,
      s: string,
      pl: PlanFilter,
      st: StatusFilter,
      silent = false,
    ) => {
      let cancelled = false;
      if (!silent) setLoading(true);
      adminUsersApi
        .list({
          page: p,
          pageSize: 20,
          search: s || undefined,
          plan: pl !== "all" ? pl : undefined,
          suspended:
            st === "suspended" ? true : st === "active" ? false : undefined,
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight">
            Utilisateurs
          </h1>
          <p className="mt-0.5 text-[12px] text-muted-foreground/50">
            {pagination
              ? `${pagination.total.toLocaleString("fr-FR")} comptes`
              : "Chargement…"}
            {" · "}
            <span className="font-mono text-[10px] text-muted-foreground/30">
              {lastSync.toLocaleTimeString("fr-FR", {
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
          className="h-7 gap-1.5 text-xs text-muted-foreground/50 hover:text-foreground"
          onClick={() => load(page, search, plan, status)}
        >
          <RefreshCw className="h-3 w-3" />
          Actualiser
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            load(1, search, plan, status);
          }}
          className="relative flex-1 min-w-[200px] max-w-xs"
        >
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/30" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Email ou nom…"
            className="h-8 pl-9 text-xs bg-card/50"
          />
        </form>

        <Select value={plan} onValueChange={(v) => setPlan(v as PlanFilter)}>
          <SelectTrigger className="h-8 w-32 text-xs bg-card/50">
            <SlidersHorizontal className="mr-1.5 h-3 w-3 text-muted-foreground/30" />
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

        <Select
          value={status}
          onValueChange={(v) => setStatus(v as StatusFilter)}
        >
          <SelectTrigger className="h-8 w-32 text-xs bg-card/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="active">Actifs</SelectItem>
            <SelectItem value="suspended">Suspendus</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/50">
              <TableHead className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/40">
                Utilisateur
              </TableHead>
              <TableHead className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/40">
                Plan
              </TableHead>
              <TableHead className="text-right text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/40">
                Crédits
              </TableHead>
              <TableHead className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/40">
                Inscrit
              </TableHead>
              <TableHead className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/40">
                Statut
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <SkeletonRows />
            ) : result?.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-20 text-center">
                  <p className="text-sm font-medium text-foreground/40">
                    Aucun résultat
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground/30">
                    Modifiez les filtres
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              result?.data.map((user) => {
                const pm = PLAN_META[user.activePlan] ?? {
                  label: user.activePlan,
                  cls: "border-border/40 text-muted-foreground/40",
                };
                return (
                  <TableRow
                    key={user.id}
                    className="group border-border/30 hover:bg-white/[0.02]"
                  >
                    <TableCell>
                      <Link
                        href={`/users/${user.id}`}
                        className="flex items-center gap-2.5"
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-[11px] font-bold text-emerald-500 ring-1 ring-emerald-500/15">
                          {user.email[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-[13px] font-medium leading-tight transition-colors group-hover:text-emerald-500">
                            {user.username}
                          </p>
                          <p className="mt-0.5 text-[10px] text-muted-foreground/40">
                            {user.email}
                          </p>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-medium ${pm.cls}`}
                      >
                        {pm.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-[12px] font-semibold tabular-nums">
                      {user.creditBalance.toLocaleString("fr-FR")}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] tabular-nums text-muted-foreground/40">
                      {new Date(user.createdAt).toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell>
                      {user.isSuspended ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                          <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                          Suspendu
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-500">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
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

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="font-mono text-[11px] text-muted-foreground/30">
            Page {pagination.page} / {pagination.totalPages} ·{" "}
            {pagination.total.toLocaleString("fr-FR")} utilisateurs
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
