"use client";

// app/(workspace)/users/page.tsx — données réelles, design soigné

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
  Search,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import Link from "next/link";
import type { ComponentProps } from "react";
import { useCallback, useEffect, useState } from "react";

type BadgeVariant = ComponentProps<typeof Badge>["variant"];
type PlanFilter = "all" | "FREE" | "STARTER" | "PRO" | "CUSTOM";
type StatusFilter = "all" | "active" | "suspended";

const PLAN_BADGE: Record<string, { variant: BadgeVariant; label: string; className?: string }> = {
  FREE:    { variant: "secondary", label: "Gratuit" },
  STARTER: { variant: "outline",   label: "Starter" },
  PRO:     { variant: "default",   label: "Pro" },
  CUSTOM:  { variant: "outline",   label: "Custom", className: "border-yellow-500/30 bg-yellow-500/5 text-yellow-600 dark:text-yellow-400" },
};

function TableSkeletonRows() {
  return Array.from({ length: 10 }).map((_, i) => (
    <TableRow key={i} className="hover:bg-transparent">
      {Array.from({ length: 5 }).map((_, j) => (
        <TableCell key={j}>
          <Skeleton className="h-4 w-full" />
        </TableCell>
      ))}
    </TableRow>
  ));
}

function UserAvatar({ email }: { email: string }) {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary ring-1 ring-primary/20">
      {email[0].toUpperCase()}
    </div>
  );
}

export default function AdminUsersPage() {
  const [result, setResult] = useState<PaginatedResult<AdminUserListItem> | null>(null);
  const [search, setSearch] = useState("");
  const [plan, setPlan] = useState<PlanFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    (p: number, s: string, pl: PlanFilter, st: StatusFilter) => {
      let cancelled = false;
      setLoading(true);
      adminUsersApi
        .list({
          page: p,
          pageSize: 20,
          search: s || undefined,
          plan: pl !== "all" ? pl : undefined,
          suspended:
            st === "suspended" ? true : st === "active" ? false : undefined,
        })
        .then((data) => { if (!cancelled) setResult(data); })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    },
    [],
  );

  // Initial load
  useEffect(() => {
    return load(page, search, plan, status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // Filters change → reset to page 1
  useEffect(() => {
    setPage(1);
    return load(1, search, plan, status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, status]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load(1, search, plan, status);
  }

  const { pagination } = result ?? {};

  return (
    <div className="flex h-full flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Utilisateurs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {pagination
              ? `${pagination.total.toLocaleString("fr-FR")} comptes enregistrés`
              : "Chargement…"}
          </p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/60">
          <Users className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={handleSearchSubmit} className="relative min-w-[220px] flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un compte…"
            className="h-9 pl-9 text-sm"
          />
        </form>

        <Select value={plan} onValueChange={(v) => setPlan(v as PlanFilter)}>
          <SelectTrigger className="h-9 w-36 text-sm">
            <SlidersHorizontal className="mr-2 h-3.5 w-3.5 text-muted-foreground/60" />
            <SelectValue placeholder="Plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les plans</SelectItem>
            <SelectItem value="FREE">Gratuit</SelectItem>
            <SelectItem value="STARTER">Starter</SelectItem>
            <SelectItem value="PRO">Pro</SelectItem>
            <SelectItem value="CUSTOM">Custom</SelectItem>
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <SelectTrigger className="h-9 w-36 text-sm">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="active">Actifs</SelectItem>
            <SelectItem value="suspended">Suspendus</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[40%]">Utilisateur</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead className="text-right">Crédits</TableHead>
              <TableHead>Inscrit le</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeletonRows />
            ) : result?.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-20 text-center">
                  <p className="text-sm font-medium text-foreground">Aucun résultat</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Essayez d&apos;ajuster vos filtres
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              result?.data.map((user) => {
                const plan = PLAN_BADGE[user.activePlan] ?? { variant: "outline" as const, label: user.activePlan };
                return (
                  <TableRow key={user.id} className="group">
                    <TableCell>
                      <Link href={`/users/${user.id}`} className="flex items-center gap-3">
                        <UserAvatar email={user.email} />
                        <div>
                          <p className="text-sm font-medium leading-tight transition-colors group-hover:text-primary">
                            {user.username}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {user.email}
                          </p>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={plan.variant}
                        className={plan.className}
                      >
                        {plan.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums text-foreground">
                      {user.creditBalance.toLocaleString("fr-FR")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground tabular-nums">
                      {new Date(user.createdAt).toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell>
                      {user.isSuspended ? (
                        <Badge variant="destructive" className="text-xs">Suspendu</Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 text-xs"
                        >
                          Actif
                        </Badge>
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
        <div className="flex items-center justify-between text-sm">
          <p className="text-xs text-muted-foreground">
            Page {pagination.page} / {pagination.totalPages}
            {" · "}
            {pagination.total.toLocaleString("fr-FR")} utilisateurs
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              aria-label="Page précédente"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
              aria-label="Page suivante"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
