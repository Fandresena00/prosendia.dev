/**
 * @file features/facebook/pages/facebook.page.tsx
 */

"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ConnectAccountDialog } from "../components/connect-account-dialog";
import { FacebookPagesGrid } from "../components/facebook-pages-grid";
import { SelectPageDialog } from "../components/select-page-dialog";
import { useFacebookPages } from "../hooks/use-facebook-pages";

// ─── Next sync label ──────────────────────────────────────────────────────────

function nextSyncLabel(): string {
  return new Date().getHours() < 12 ? "aujourd'hui à 12:00" : "demain à 00:00";
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function FacebookPage() {
  const {
    pages,
    loading,
    syncingIds,
    syncSummaries,
    refresh,
    removePage,
    syncPage,
  } = useFacebookPages();

  const [connectAccountOpen, setConnectAccountOpen] = useState(false);
  const [selectPageOpen, setSelectPageOpen] = useState(false);

  const searchParams = useSearchParams();

  // Open the page-picker dialog when Facebook redirects back with ?oauth=ok
  useEffect(() => {
    if (searchParams.get("oauth") === "ok") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectPageOpen(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [searchParams]);

  const activeCount = useMemo(
    () => pages.filter((p) => p.active).length,
    [pages],
  );
  const webhookCount = useMemo(
    () => pages.filter((p) => p.webhookSubscribed).length,
    [pages],
  );

  // Use the first connected page's businessProfileId as the OAuth state.
  // If none exists, the backend auto-creates a default BusinessProfile.
  const defaultProfileId = pages.at(0)?.accountId;

  return (
    <TooltipProvider>
      <div className="p-5 lg:p-8 space-y-8">
        {/* ── Page header ── */}
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold tracking-tight">
              Pages Facebook
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed max-w-lg">
              Connectez vos pages pour que l&apos;IA réponde automatiquement aux
              messages, gère les commentaires et synchronise vos conversations.
            </p>

            {pages.length > 0 && (
              <p className="text-xs text-muted-foreground/60 mt-2 flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Synchronisation automatique {nextSyncLabel()} · toutes les 12h
              </p>
            )}
          </div>

          {/* Stat pills — only shown when pages exist */}
          {pages.length > 0 && (
            <div className="flex items-center gap-2 shrink-0 mt-0.5">
              <StatPill value={pages.length} label="pages" />
              <StatPill
                value={activeCount}
                label="IA active"
                variant="emerald"
              />
              <StatPill value={webhookCount} label="webhook" variant="violet" />
            </div>
          )}
        </div>

        {/* ── Content ── */}
        {loading ? (
          <PageSkeleton />
        ) : (
          <FacebookPagesGrid
            pages={pages}
            syncingIds={syncingIds}
            syncSummaries={syncSummaries}
            onAdd={() => setConnectAccountOpen(true)}
            onSync={async (id) => {
              await syncPage(id);
            }}
            onRemove={removePage}
          />
        )}

        {/* ── Dialogs ── */}
        <ConnectAccountDialog
          open={connectAccountOpen}
          onClose={() => setConnectAccountOpen(false)}
          businessProfileId={defaultProfileId}
        />
        <SelectPageDialog
          open={selectPageOpen}
          onClose={() => {
            setSelectPageOpen(false);
            refresh();
          }}
          onSuccess={refresh}
        />
      </div>
    </TooltipProvider>
  );
}

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({
  value,
  label,
  variant,
}: {
  value: number;
  label: string;
  variant?: "emerald" | "violet";
}) {
  const classes =
    variant === "emerald"
      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600"
      : variant === "violet"
        ? "bg-violet-500/10 border-violet-500/20 text-violet-600"
        : "bg-secondary border-border/60 text-foreground";

  return (
    <div
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${classes}`}
    >
      <span className="text-sm font-bold tabular-nums">{value}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div>
      {/* Section header skeleton */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-5 w-5 rounded-full" />
        </div>
        <Skeleton className="h-8 w-32 rounded-md" />
      </div>

      {/* Cards grid skeleton */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border/40 p-4 space-y-3"
          >
            {/* Header */}
            <div className="flex items-start gap-3">
              <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
            {/* Badges */}
            <div className="flex gap-1.5">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((_, j) => (
                <Skeleton key={j} className="h-14 rounded-lg" />
              ))}
            </div>
            {/* Footer */}
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-8 flex-1 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
