/**
 * @file features/facebook/components/facebook-pages-grid.tsx
 */

import { Button } from "@/components/ui/button";
import { IconBrandFacebook, IconPlus } from "@tabler/icons-react";
import type { FacebookPage, SyncSummary } from "../types/facebook.types";
import { FacebookPageCard } from "./facebook-page-card";

interface FacebookPagesGridProps {
  pages:        FacebookPage[];
  syncingIds:   Set<string>;
  syncSummaries: Map<string, SyncSummary>;
  onAdd:        () => void;
  onSync:       (businessProfileId: string) => Promise<void>;
  onRemove:     (businessProfileId: string) => Promise<void>;
}

export function FacebookPagesGrid({
  pages, syncingIds, syncSummaries, onAdd, onSync, onRemove,
}: FacebookPagesGridProps) {
  if (pages.length === 0) return <FacebookEmptyState onAdd={onAdd} />;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Pages connectées
          </h2>
          <span className="inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold px-1.5">
            {pages.length}
          </span>
        </div>
        <Button variant="outline" size="sm" className="h-8 gap-2 text-xs" onClick={onAdd}>
          <IconPlus className="h-3.5 w-3.5" />
          Ajouter une page
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pages.map((page) => (
          <FacebookPageCard
            key={page.id}
            page={page}
            isSyncing={syncingIds.has(page.accountId)}
            lastSummary={syncSummaries.get(page.accountId)}
            onSync={() => onSync(page.accountId)}
            onDisconnect={() => onRemove(page.accountId)}
          />
        ))}
        <AddPageTile onClick={onAdd} />
      </div>
    </div>
  );
}

function AddPageTile({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border/40 bg-card/20 p-8 hover:border-primary/40 hover:bg-primary/3 transition-all min-h-[280px] group"
    >
      <div className="h-10 w-10 rounded-xl bg-primary/8 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
        <IconPlus className="h-5 w-5 text-primary" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold">Ajouter une page</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Nécessite une connexion Facebook
        </p>
      </div>
    </button>
  );
}

function FacebookEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="relative mb-6">
        <div className="h-20 w-20 rounded-2xl bg-[#1877F2]/8 flex items-center justify-center border border-[#1877F2]/15">
          <IconBrandFacebook className="h-10 w-10 text-[#1877F2]/70" />
        </div>
        <div className="absolute inset-0 rounded-2xl border-2 border-[#1877F2]/10 scale-110 opacity-60" />
      </div>

      <h3 className="text-base font-semibold mb-1.5">Aucune page connectée</h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-6 leading-relaxed">
        Connectez vos pages Facebook pour que l&apos;IA puisse automatiser
        vos réponses et analyser vos messages.
      </p>

      <div className="flex flex-wrap justify-center gap-2 mb-8">
        {[
          "💬 Réponses automatisées",
          "📊 Analyses et statistiques",
          "🔔 Notifications en temps réel",
          "📦 Synchronisation des commandes",
        ].map((f) => (
          <span key={f} className="text-xs text-muted-foreground bg-secondary/60 border border-border/50 rounded-full px-3 py-1">
            {f}
          </span>
        ))}
      </div>

      <Button
        className="gap-2 bg-[#1877F2] hover:bg-[#1877F2]/90 text-white shadow-sm shadow-[#1877F2]/20"
        onClick={onAdd}
      >
        <IconBrandFacebook className="h-4 w-4" />
        Connecter ma première page
      </Button>

      <p className="text-[11px] text-muted-foreground mt-4">
        Connexion sécurisée via Facebook OAuth — votre mot de passe n&apos;est jamais partagé
      </p>
    </div>
  );
}
