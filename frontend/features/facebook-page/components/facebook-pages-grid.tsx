/**
 * @file features/facebook/components/facebook-pages-grid.tsx
 *
 * CHANGE — plan-based connection limit (point: limite selon le plan actuel):
 *   `connectedPagesLimit` is passed down to disable both the header
 *   "Ajouter une page" button and the AddPageTile when the plan's maxPages
 *   has been reached, with a clear upgrade message instead of letting the
 *   user open the OAuth dialog only to find out at the last step.
 */

import { Button } from "@/components/ui/button";
import {
  IconAlertTriangle,
  IconBrandFacebook,
  IconMessageCircle,
  IconPlus,
  IconRobot,
  IconShieldCheck,
  IconTrendingUp,
} from "@tabler/icons-react";
import type { ConnectedPagesLimitInfo, FacebookPage, SyncSummary } from "../types/facebook.types";
import { FacebookPageCard } from "./facebook-page-card";

interface FacebookPagesGridProps {
  pages:         FacebookPage[];
  syncingIds:    Set<string>;
  syncSummaries: Map<string, SyncSummary>;
  /** Plan-based limit on connected pages (point: limite selon le plan actuel). */
  connectedPagesLimit?: ConnectedPagesLimitInfo;
  onAdd:         () => void;
  onSync:        (businessProfileId: string) => Promise<void>;
  onRemove:      (businessProfileId: string) => Promise<void>;
}

export function FacebookPagesGrid({
  pages, syncingIds, syncSummaries, connectedPagesLimit, onAdd, onSync, onRemove,
}: FacebookPagesGridProps) {
  const isLimitReached =
    !!connectedPagesLimit &&
    connectedPagesLimit.max !== null &&
    connectedPagesLimit.current >= connectedPagesLimit.max;

  if (pages.length === 0) return <FacebookEmptyState onAdd={onAdd} />;

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-2">
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
          disabled={isLimitReached}
          title={
            isLimitReached
              ? `Limite du plan ${connectedPagesLimit?.planName} atteinte`
              : undefined
          }
        >
          <IconPlus className="h-3.5 w-3.5" />
          Ajouter une page
        </Button>
      </div>

      {/* Plan limit banner (point: limite selon le plan actuel) */}
      {isLimitReached && connectedPagesLimit && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/8 px-3.5 py-3 mb-4">
          <IconAlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-700">
              Limite du plan {connectedPagesLimit.planName} atteinte (
              {connectedPagesLimit.current}/{connectedPagesLimit.max})
            </p>
            <p className="text-[11px] text-amber-600/80 mt-0.5 leading-relaxed">
              Déconnectez une page existante, ou passez à un abonnement
              supérieur pour en connecter davantage.
            </p>
          </div>
        </div>
      )}

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

        <AddPageTile onClick={onAdd} disabled={isLimitReached} />
      </div>
    </div>
  );
}

// ─── Add page tile ────────────────────────────────────────────────────────────

function AddPageTile({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`
        flex flex-col items-center justify-center gap-3 rounded-xl
        border border-dashed border-border/50
        p-8 min-h-[240px]
        transition-all duration-200 group
        ${disabled
          ? "opacity-50 cursor-not-allowed"
          : "hover:border-emerald-500/40 hover:bg-emerald-500/3"
        }
      `}
    >
      <div className={`h-9 w-9 rounded-lg bg-secondary flex items-center justify-center transition-colors ${
        disabled ? "" : "group-hover:bg-emerald-500/10"
      }`}>
        <IconPlus className={`h-4.5 w-4.5 text-muted-foreground transition-colors ${
          disabled ? "" : "group-hover:text-emerald-600"
        }`} />
      </div>
      <div className="text-center">
        <p className={`text-sm font-semibold transition-colors ${
          disabled ? "" : "group-hover:text-emerald-600"
        }`}>
          {disabled ? "Limite atteinte" : "Ajouter une page"}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {disabled ? "Passez à un abonnement supérieur" : "Via Facebook OAuth"}
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
