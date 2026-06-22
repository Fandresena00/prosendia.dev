"use client";

// app/(workspace)/users/page.tsx

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const PLAN_LABELS: Record<string, { label: string; className: string }> = {
  FREE: {
    label: "Gratuit",
    className: "border-zinc-700 bg-zinc-800/60 text-zinc-400",
  },
  STARTER: {
    label: "Starter",
    className: "border-blue-800/40 bg-blue-950/40 text-blue-400",
  },
  PRO: {
    label: "Pro",
    className: "border-emerald-800/40 bg-emerald-950/40 text-emerald-400",
  },
  CUSTOM: {
    label: "Custom",
    className: "border-purple-800/40 bg-purple-950/40 text-purple-400",
  },
};

function PlanBadge({ plan }: { plan: string }) {
  const cfg = PLAN_LABELS[plan] ?? {
    label: plan,
    className: "border-zinc-700 bg-zinc-800 text-zinc-400",
  };
  return (
    <Badge
      variant="outline"
      className={`text-[11px] font-medium ${cfg.className}`}
    >
      {cfg.label}
    </Badge>
  );
}

function TableSkeleton() {
  return Array.from({ length: 8 }).map((_, i) => (
    <TableRow key={i} className="border-zinc-800/60 hover:bg-transparent">
      {Array.from({ length: 5 }).map((_, j) => (
        <TableCell key={j} className="py-3">
          <Skeleton className="h-4 w-full bg-zinc-800" />
        </TableCell>
      ))}
    </TableRow>
  ));
}

export default function AdminUsersPage() {
  const [result, setResult] =
    useState<PaginatedResult<AdminUserListItem> | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  function load(p = page, q = search) {
    setLoading(true);
    adminUsersApi
      .list({ page: p, pageSize: 20, search: q || undefined })
      .then(setResult)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load, page]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load(1, search);
  }

  const { pagination } = result ?? {};

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight text-zinc-100">
            Utilisateurs
          </h1>
          {pagination && (
            <p className="mt-0.5 text-[13px] text-zinc-500">
              {pagination.total.toLocaleString("fr-FR")} comptes enregistrés
            </p>
          )}
        </div>

        <form onSubmit={handleSearchSubmit} className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par email ou nom…"
            className="h-9 w-72 border-zinc-800 bg-zinc-900 pl-8 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus-visible:border-emerald-500/50 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </form>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-zinc-800/60">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800/60 hover:bg-transparent">
              <TableHead className="bg-zinc-900/80 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Utilisateur
              </TableHead>
              <TableHead className="bg-zinc-900/80 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Plan
              </TableHead>
              <TableHead className="bg-zinc-900/80 text-right text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Crédits
              </TableHead>
              <TableHead className="bg-zinc-900/80 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Inscrit le
              </TableHead>
              <TableHead className="bg-zinc-900/80 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Statut
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeleton />
            ) : result?.data.length === 0 ? (
              <TableRow className="border-zinc-800/60 hover:bg-transparent">
                <TableCell
                  colSpan={5}
                  className="py-12 text-center text-[13px] text-zinc-600"
                >
                  Aucun utilisateur trouvé.
                </TableCell>
              </TableRow>
            ) : (
              result?.data.map((user) => (
                <TableRow
                  key={user.id}
                  className="border-zinc-800/40 transition-colors hover:bg-zinc-900/40"
                >
                  <TableCell className="py-3">
                    <Link href={`/users/${user.id}`} className="group">
                      <p className="text-[13px] font-medium text-zinc-200 group-hover:text-emerald-400 transition-colors">
                        {user.username}
                      </p>
                      <p className="text-[12px] text-zinc-500">{user.email}</p>
                    </Link>
                  </TableCell>
                  <TableCell className="py-3">
                    <PlanBadge plan={user.activePlan} />
                  </TableCell>
                  <TableCell className="py-3 text-right font-mono text-[13px] tabular-nums text-zinc-400">
                    {user.creditBalance.toLocaleString("fr-FR")}
                  </TableCell>
                  <TableCell className="py-3 text-[12px] text-zinc-500">
                    {new Date(user.createdAt).toLocaleDateString("fr-FR")}
                  </TableCell>
                  <TableCell className="py-3">
                    {user.isSuspended ? (
                      <Badge
                        variant="outline"
                        className="border-red-900/50 bg-red-950/30 text-[11px] text-red-400"
                      >
                        Suspendu
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-emerald-900/50 bg-emerald-950/30 text-[11px] text-emerald-400"
                      >
                        Actif
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-[12px] text-zinc-500">
            Page {pagination.page} / {pagination.totalPages} —{" "}
            {pagination.total.toLocaleString("fr-FR")} utilisateurs
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="h-8 border-zinc-800 bg-transparent text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 disabled:opacity-30"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="h-8 border-zinc-800 bg-transparent text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 disabled:opacity-30"
            >
              Suivant
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
