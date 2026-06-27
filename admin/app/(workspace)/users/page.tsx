/* eslint-disable react-hooks/refs */
"use client";

// app/(workspace)/users/page.tsx — Linear dark, données temps réel, auto-refresh 30s

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminUsersApi, type AdminUserListItem, type PaginatedResult } from "@/lib/admin-api";
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, useRef } from "react";

type PlanFilter   = "all" | "FREE" | "STARTER" | "PRO" | "CUSTOM";
type StatusFilter = "all" | "active" | "suspended";

const PLAN_META: Record<string, { label: string; className: string }> = {
  FREE:    { label: "Gratuit", className: "border-border/50 text-muted-foreground bg-transparent" },
  STARTER: { label: "Starter", className: "border-blue-500/30 bg-blue-500/10 text-blue-400" },
  PRO:     { label: "Pro",     className: "border-primary/30 bg-primary/10 text-primary" },
  CUSTOM:  { label: "Custom",  className: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400" },
};

function SkeletonRows() {
  return Array.from({ length: 10 }).map((_, i) => (
    <TableRow key={i} className="hover:bg-transparent border-border/40">
      {Array.from({ length: 5 }).map((_, j) => (
        <TableCell key={j}><Skeleton className="h-3.5 w-full bg-white/5" /></TableCell>
      ))}
    </TableRow>
  ));
}

export default function UsersPage() {
  const [result,   setResult]   = useState<PaginatedResult<AdminUserListItem> | null>(null);
  const [search,   setSearch]   = useState("");
  const [plan,     setPlan]     = useState<PlanFilter>("all");
  const [status,   setStatus]   = useState<StatusFilter>("all");
  const [page,     setPage]     = useState(1);
  const [loading,  setLoading]  = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const searchRef = useRef(search);
  const planRef   = useRef(plan);
  const statusRef = useRef(status);
  searchRef.current = search;
  planRef.current   = plan;
  statusRef.current = status;

  const load = useCallback((p: number, s: string, pl: PlanFilter, st: StatusFilter, silent = false) => {
    let cancelled = false;
    if (!silent) setLoading(true);
    adminUsersApi.list({
      page: p, pageSize: 20,
      search: s || undefined,
      plan: pl !== "all" ? pl : undefined,
      suspended: st === "suspended" ? true : st === "active" ? false : undefined,
    })
      .then((d) => { if (!cancelled) { setResult(d); setLastRefreshed(new Date()); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => load(page, search, plan, status), [page]); // eslint-disable-line
  useEffect(() => { setPage(1); load(1, search, plan, status); }, [plan, status]); // eslint-disable-line

  // Auto-refresh 30s silencieux
  useEffect(() => {
    const id = setInterval(() => load(page, searchRef.current, planRef.current, statusRef.current, true), 30_000);
    return () => clearInterval(id);
  }, [page, load]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load(1, search, plan, status);
  }

  const { pagination } = result ?? {};

  return (
    <div className="flex h-full flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight">Utilisateurs</h1>
          <p className="mt-0.5 text-[12px] text-muted-foreground/60">
            {pagination ? `${pagination.total.toLocaleString("fr-FR")} comptes` : "Chargement…"}
            {" · "}
            <span className="font-mono text-[10px]">
              {lastRefreshed.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </p>
        </div>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground"
          onClick={() => load(page, search, plan, status)}>
          <RefreshCw className="h-3 w-3" />
          Actualiser
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={handleSearch} className="relative min-w-50 flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Email, nom…" className="h-8 pl-8 text-xs bg-card/50" />
        </form>

        <Select value={plan} onValueChange={(v) => setPlan(v as PlanFilter)}>
          <SelectTrigger className="h-8 w-32 text-xs bg-card/50">
            <SlidersHorizontal className="mr-1.5 h-3 w-3 text-muted-foreground/40" />
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
          <SelectTrigger className="h-8 w-32 text-xs bg-card/50"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="active">Actifs</SelectItem>
            <SelectItem value="suspended">Suspendus</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/60">
              <TableHead className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/50">Utilisateur</TableHead>
              <TableHead className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/50">Plan</TableHead>
              <TableHead className="text-right text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/50">Crédits</TableHead>
              <TableHead className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/50">Inscrit le</TableHead>
              <TableHead className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/50">Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? <SkeletonRows /> :
              result?.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-20 text-center">
                    <p className="text-sm font-medium text-foreground/60">Aucun résultat</p>
                    <p className="mt-1 text-xs text-muted-foreground/40">Modifiez les filtres</p>
                  </TableCell>
                </TableRow>
              ) : result?.data.map((user) => {
                const pm = PLAN_META[user.activePlan] ?? { label: user.activePlan, className: "border-border/50 text-muted-foreground" };
                return (
                  <TableRow key={user.id} className="group border-border/40 hover:bg-white/2">
                    <TableCell>
                      <Link href={`/users/${user.id}`} className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/15 text-[11px] font-bold text-primary">
                          {user.email[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-[13px] font-medium leading-tight transition-colors group-hover:text-primary">{user.username}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground/50">{user.email}</p>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] font-medium ${pm.className}`}>{pm.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-[12px] font-medium tabular-nums text-foreground">
                      {user.creditBalance.toLocaleString("fr-FR")}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] tabular-nums text-muted-foreground/50">
                      {new Date(user.createdAt).toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell>
                      {user.isSuspended ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                          <span className="h-1.5 w-1.5 rounded-full bg-destructive" />Suspendu
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Actif
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="font-mono text-[11px] text-muted-foreground/40">
            Page {pagination.page} / {pagination.totalPages} · {pagination.total.toLocaleString("fr-FR")} utilisateurs
          </p>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7"
              disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7"
              disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
