/**
 * @file features/facebook/components/facebook-pages-grid.tsx
 */

import { Button } from "@/components/ui/button";
import {
  IconBrandFacebook,
  IconMessageCircle,
  IconPlus,
  IconRobot,
  IconShieldCheck,
  IconTrendingUp,
} from "@tabler/icons-react";
import type { FacebookPage, SyncSummary } from "../types/facebook.types";
import { FacebookPageCard } from "./facebook-page-card";

interface FacebookPagesGridProps {
  pages:         FacebookPage[];
  syncingIds:    Set<string>;
  syncSummaries: Map<string, SyncSummary>;
  onAdd:         () => void;
  onSync:        (businessProfileId: string) => Promise<void>;
  onRemove:      (businessProfileId: string) => Promise<void>;
}

export function FacebookPagesGrid({
  pages, syncingIds, syncSummaries, onAdd, onSync, onRemove,
}: FacebookPagesGridProps) {
  if (pages.length === 0) return <FacebookEmptyState onAdd={onAdd} />;

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Pages connectées
          </p>
          <span className="inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-emerald-500/15 text-emerald-600 text-[10px] font-bold px-1.5">
            {pages.length}
          </span>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={onAdd}
        >
          <IconPlus className="h-3.5 w-3.5" />
          Ajouter une page
        </Button>
      </div>

      {/* Cards grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

// ─── Add page tile ────────────────────────────────────────────────────────────

function AddPageTile({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`
        flex flex-col items-center justify-center gap-3 rounded-xl
        border border-dashed border-border/50
        p-8 min-h-[240px]
        hover:border-emerald-500/40 hover:bg-emerald-500/3
        transition-all duration-200 group
      `}
    >
      <div className="h-9 w-9 rounded-lg bg-secondary flex items-center justify-center group-hover:bg-emerald-500/10 transition-colors">
        <IconPlus className="h-4.5 w-4.5 text-muted-foreground group-hover:text-emerald-600 transition-colors" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold group-hover:text-emerald-600 transition-colors">
          Ajouter une page
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Via Facebook OAuth
        </p>
      </div>
    </button>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: IconRobot,
    title: "Réponses automatisées",
    description: "L'IA répond à vos messages 24h/24",
  },
  {
    icon: IconTrendingUp,
    title: "Analyses et statistiques",
    description: "Suivez vos performances en temps réel",
  },
  {
    icon: IconMessageCircle,
    title: "Gestion des commentaires",
    description: "Modérez et répondez aux commentaires",
  },
  {
    icon: IconShieldCheck,
    title: "Connexion sécurisée",
    description: "OAuth officiel — jamais de mot de passe",
  },
] as const;

function FacebookEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center py-16 px-4 text-center">
      {/* Icon */}
      <div className="relative mb-7">
        <div className="h-16 w-16 rounded-2xl bg-[#1877F2]/8 border border-[#1877F2]/15 flex items-center justify-center">
          <IconBrandFacebook className="h-8 w-8 text-[#1877F2]/80" />
        </div>
        {/* Emerald pulse ring */}
        <div className="absolute -inset-2 rounded-2xl border border-emerald-500/20 animate-pulse" />
      </div>

      {/* Copy */}
      <h3 className="text-base font-semibold mb-2">
        Aucune page connectée
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm leading-relaxed mb-8">
        Connectez vos pages Facebook pour que l&apos;IA automatise vos
        réponses, gère vos commentaires et synchronise vos conversations.
      </p>

      {/* Feature grid */}
      <div className="grid grid-cols-2 gap-3 mb-8 w-full max-w-md">
        {FEATURES.map(({ icon: Icon, title, description }) => (
          <div
            key={title}
            className="flex items-start gap-2.5 p-3 rounded-lg border border-border/50 bg-card/50 text-left"
          >
            <div className="h-6 w-6 rounded-md bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
              <Icon className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-semibold leading-tight">{title}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                {description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <Button
        className="gap-2 bg-[#1877F2] hover:bg-[#1877F2]/90 text-white h-9 text-sm shadow-sm shadow-[#1877F2]/20"
        onClick={onAdd}
      >
        <IconBrandFacebook className="h-4 w-4" />
        Connecter ma première page
      </Button>

      <p className="text-[11px] text-muted-foreground/60 mt-4">
        Connexion via OAuth officiel Facebook · votre mot de passe n&apos;est jamais partagé
      </p>
    </div>
  );
}
