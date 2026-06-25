"use client";

// app/(workspace)/users/page.tsx

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
} from "lucide-react";
import Link from "next/link";
import type { ComponentProps } from "react";
import { useCallback, useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type BadgeVariant = ComponentProps<typeof Badge>["variant"];

// ─── Constantes module-level ──────────────────────────────────────────────────

const PLAN_BADGE_VARIANT: Record<string, BadgeVariant> = {
  FREE: "secondary",
  STARTER: "outline",
  PRO: "default",
  CUSTOM: "outline",
};

const PLAN_DISPLAY_LABELS: Record<string, string> = {
  FREE: "Gratuit",
  STARTER: "Starter",
  PRO: "Pro",
  CUSTOM: "Custom",
};

// ─── Subcomponents ────────────────────────────────────────────────────────────

function UserStatusBadge({ isSuspended }: { isSuspended: boolean }) {
  if (isSuspended) {
    return <Badge variant="destructive">Suspendu</Badge>;
  }
  return (
    <Badge
      variant="outline"
      className="border-primary/30 bg-primary/5 text-primary"
    >
      Actif
    </Badge>
  );
}

function TableSkeletonRows() {
  return Array.from({ length: 10 }).map((_, rowIndex) => (
    <TableRow key={rowIndex}>
      {Array.from({ length: 5 }).map((_, colIndex) => (
        <TableCell key={colIndex}>
          <Skeleton className="h-4 w-full" />
        </TableCell>
      ))}
    </TableRow>
  ));
}

// ─── Filtres ──────────────────────────────────────────────────────────────────

type PlanFilter = "all" | "FREE" | "STARTER" | "PRO" | "CUSTOM";
type StatusFilter = "all" | "active" | "suspended";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const [paginatedResult, setPaginatedResult] =
    useState<PaginatedResult<AdminUserListItem> | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [planFilter, setPlanFilter] = useState<PlanFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // useCallback pour stabiliser la référence et satisfaire exhaustive-deps
  const fetchUsers = useCallback(
    (pageToFetch: number) => {
      let cancelled = false;

      setIsLoading(true);

      adminUsersApi
        .list({
          page: pageToFetch,
          pageSize: 20,
          search: searchQuery || undefined,
          plan: planFilter !== "all" ? planFilter : undefined,
          suspended:
            statusFilter === "suspended"
              ? true
              : statusFilter === "active"
                ? false
                : undefined,
        })
        .then((data) => {
          if (!cancelled) setPaginatedResult(data);
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });

      return () => {
        cancelled = true;
      };
    },
    // searchQuery et les filtres sont intentionnellement exclus ici —
    // la recherche se déclenche via handleSearchSubmit, les filtres via leur propre effet
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentPage],
  );

  // Rechargement quand la page change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    const cancel = fetchUsers(currentPage);
    return cancel;
  }, [fetchUsers, currentPage]);

  // Rechargement réactif quand les filtres changent (pas de setTimeout)
  useEffect(() => {
    let cancelled = false;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    setCurrentPage(1);

    adminUsersApi
      .list({
        page: 1,
        pageSize: 20,
        search: searchQuery || undefined,
        plan: planFilter !== "all" ? planFilter : undefined,
        suspended:
          statusFilter === "suspended"
            ? true
            : statusFilter === "active"
              ? false
              : undefined,
      })
      .then((data) => {
        if (!cancelled) setPaginatedResult(data);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // Déclenché uniquement quand planFilter ou statusFilter changent
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planFilter, statusFilter]);

  function handleSearchSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCurrentPage(1);
    fetchUsers(1);
  }

  function handlePlanFilterChange(newPlan: string) {
    setPlanFilter(newPlan as PlanFilter);
  }

  function handleStatusFilterChange(newStatus: string) {
    setStatusFilter(newStatus as StatusFilter);
  }

  function goToPreviousPage() {
    setCurrentPage((prevPage) => prevPage - 1);
  }

  function goToNextPage() {
    setCurrentPage((prevPage) => prevPage + 1);
  }

  const { pagination } = paginatedResult ?? {};

  return (
    <div className="flex h-full flex-col gap-4">
      {/* ── En-tête ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Utilisateurs</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {pagination
              ? `${pagination.total.toLocaleString("fr-FR")} comptes enregistrés`
              : "Chargement…"}
          </p>
        </div>
      </div>

      {/* ── Filtres ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Recherche */}
        <form
          onSubmit={handleSearchSubmit}
          className="relative min-w-[240px] max-w-sm flex-1"
        >
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par email ou nom…"
            className="pl-9"
          />
        </form>

        {/* Filtre plan */}
        <Select value={planFilter} onValueChange={handlePlanFilterChange}>
          <SelectTrigger className="w-36">
            <SlidersHorizontal className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
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

        {/* Filtre statut */}
        <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="active">Actifs</SelectItem>
            <SelectItem value="suspended">Suspendus</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── Tableau ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Utilisateur</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead className="text-right">Crédits</TableHead>
              <TableHead>Inscrit le</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeletonRows />
            ) : paginatedResult?.data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-16 text-center text-muted-foreground"
                >
                  Aucun utilisateur trouvé.
                </TableCell>
              </TableRow>
            ) : (
              paginatedResult?.data.map((userItem) => (
                <TableRow key={userItem.id}>
                  <TableCell>
                    <Link
                      href={`/users/${userItem.id}`}
                      className="group block"
                    >
                      <p className="font-medium transition-colors group-hover:text-primary">
                        {userItem.username}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {userItem.email}
                      </p>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        PLAN_BADGE_VARIANT[userItem.activePlan] ?? "outline"
                      }
                    >
                      {PLAN_DISPLAY_LABELS[userItem.activePlan] ??
                        userItem.activePlan}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">
                    {userItem.creditBalance.toLocaleString("fr-FR")}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(userItem.createdAt).toLocaleDateString("fr-FR")}
                  </TableCell>
                  <TableCell>
                    <UserStatusBadge isSuspended={userItem.isSuspended} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Pagination ────────────────────────────────────────────────── */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            Page {pagination.page} / {pagination.totalPages}
            {" · "}
            {pagination.total.toLocaleString("fr-FR")} utilisateurs
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              disabled={currentPage <= 1}
              onClick={goToPreviousPage}
              aria-label="Page précédente"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={currentPage >= pagination.totalPages}
              onClick={goToNextPage}
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
