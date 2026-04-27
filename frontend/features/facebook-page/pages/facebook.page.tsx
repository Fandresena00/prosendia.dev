/**
 * @file features/facebook/pages/facebook.page.tsx
 */

"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ConnectAccountDialog } from "../components/connect-account-dialog";
import { FacebookPagesGrid } from "../components/facebook-pages-grid";
import { SelectPageDialog } from "../components/select-page-dialog";
import { useFacebookPages } from "../hooks/use-facebook-pages";

/* Next sync time label (12:00 or 00:00) */
function nextSyncLabel(): string {
  const h = new Date().getHours();
  if (h < 12) return "aujourd'hui à 12:00";
  return "demain à 00:00";
}

export function FacebookPage() {
  const {
    pages, loading, syncingIds, syncSummaries,
    refresh, removePage, syncPage,
  } = useFacebookPages();

  const [connectAccountOpen, setConnectAccountOpen] = useState(false);
  const [selectPageOpen,     setSelectPageOpen]     = useState(false);

  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("oauth") === "ok") {
      setSelectPageOpen(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [searchParams]);

  const activeCount  = useMemo(() => pages.filter((p) => p.active).length,          [pages]);
  const webhookCount = useMemo(() => pages.filter((p) => p.webhookSubscribed).length, [pages]);

  return (
    <TooltipProvider>
      <div className="p-5 lg:p-7 space-y-7">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4">
          <div className="max-w-xl">
            <h1 className="text-xl font-bold tracking-tight">Pages Facebook</h1>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              Connectez vos pages Facebook pour permettre à l&apos;IA de{" "}
              <span className="text-foreground/70 font-medium">
                répondre automatiquement aux messages privés
              </span>
              , gérer les commentaires et synchroniser vos conversations en temps réel.
              Une fois connectée, la page est entièrement pilotée par votre assistant IA.
            </p>

            {/* Auto-sync info pill */}
            {pages.length > 0 && (
              <p className="text-xs text-muted-foreground/70 mt-2 flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Synchronisation automatique {nextSyncLabel()} · toutes les 12h
              </p>
            )}
          </div>

          {/* Stat pills */}
          {pages.length > 0 && (
            <div className="flex items-center gap-2 shrink-0 mt-0.5">
              <StatPill value={pages.length} label="pages"     color="text-foreground" />
              <StatPill value={activeCount}  label="IA active" color="text-primary"    accent="primary" />
              <StatPill value={webhookCount} label="webhook"   color="text-violet-500" accent="violet"  />
            </div>
          )}
        </div>

        {/* ── Grid or skeleton ── */}
        {loading ? (
          <LoadingSkeleton />
        ) : (
          <FacebookPagesGrid
            pages={pages}
            syncingIds={syncingIds}
            syncSummaries={syncSummaries}
            onAdd={() => setConnectAccountOpen(true)}
            onSync={syncPage}
            onRemove={removePage}
          />
        )}

        {/* ── Dialogs ── */}
        <ConnectAccountDialog
          open={connectAccountOpen}
          onClose={() => setConnectAccountOpen(false)}
        />
        <SelectPageDialog
          open={selectPageOpen}
          onClose={() => { setSelectPageOpen(false); refresh(); }}
          onSuccess={refresh}
        />
      </div>
    </TooltipProvider>
  );
}

function StatPill({
  value, label, color, accent,
}: {
  value: number;
  label: string;
  color: string;
  accent?: "primary" | "violet";
}) {
  const bg =
    accent === "primary" ? "bg-primary/8 border-primary/20"       :
    accent === "violet"  ? "bg-violet-500/8 border-violet-500/20" :
    "bg-secondary/60 border-border/50";

  return (
    <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${bg}`}>
      <span className={`text-sm font-bold ${color}`}>{value}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-[280px] rounded-xl border border-border/40 bg-card/40 animate-pulse" />
      ))}
    </div>
  );
}
