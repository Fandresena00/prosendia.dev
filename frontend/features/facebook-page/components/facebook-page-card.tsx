/**
 * @file features/facebook/components/facebook-page-card.tsx
 *
 * Redesigned card:
 * - Centered avatar + name header (not squished left)
 * - Real Facebook stats: followers, fans, conversations, posts
 * - Sync button shows result summary after sync
 * - No toggle switch — just Sync and View Page buttons
 * - Token health indicator
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  IconAlertTriangle,
  IconCheck,
  IconDotsVertical,
  IconExternalLink,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";
import { useState } from "react";
import type { FacebookPage, SyncSummary } from "../types/facebook.types";

interface FacebookPageCardProps {
  page:       FacebookPage;
  isSyncing:  boolean;
  lastSummary?: SyncSummary;
  onSync:     () => Promise<void>;
  onDisconnect: () => Promise<void>;
}

export function FacebookPageCard({
  page, isSyncing, lastSummary, onSync, onDisconnect,
}: FacebookPageCardProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting,  setIsDeleting]  = useState(false);
  const [justSynced,  setJustSynced]  = useState(false);

  const handleSync = async () => {
    await onSync();
    setJustSynced(true);
    setTimeout(() => setJustSynced(false), 3000);
  };

  const handleConfirmDisconnect = async () => {
    setIsDeleting(true);
    await onDisconnect();
    setIsDeleting(false);
    setShowConfirm(false);
  };

  const tokenValid = page.tokenStatus.toUpperCase() === "VALID";

  return (
    <>
      <Card
        className={`border-border/50 transition-all relative overflow-hidden group ${
          page.active
            ? "border-primary/20 shadow-sm shadow-primary/5"
            : "hover:border-border"
        }`}
      >
        {/* Active accent bar */}
        {page.active && (
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-primary/80 via-primary/60 to-primary/20" />
        )}

        {/* ── Three-dot menu ── */}
        <div className="absolute top-3 right-2 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <IconDotsVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={() => setShowConfirm(true)}
                className="text-xs gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
              >
                <IconTrash className="h-3.5 w-3.5" />
                Déconnecter la page
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <CardContent className="p-5">
          {/* ── Header: centered avatar + name ── */}
          <div className="flex flex-col items-center text-center mb-4 pt-1">
            <div className="relative mb-3">
              <Avatar className="h-14 w-14 rounded-xl border-2 border-border/40 shadow-sm">
                <AvatarImage src={page.avatar} alt={page.name} className="object-cover" />
                <AvatarFallback className="rounded-xl bg-primary/10 text-primary font-bold text-lg">
                  {page.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              {/* Active dot */}
              {page.active && (
                <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-background" />
              )}
            </div>

            <p className="text-sm font-bold leading-snug truncate w-full px-2">
              {page.name}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{page.category}</p>

            {/* Badges row */}
            <div className="flex flex-wrap justify-center items-center gap-1.5 mt-2.5">
              <Badge
                variant="outline"
                className={`text-[10px] h-5 px-2 ${
                  page.connected
                    ? "border-emerald-500/30 text-emerald-600 bg-emerald-500/5"
                    : "border-destructive/30 text-destructive bg-destructive/5"
                }`}
              >
                {page.connected ? "● Connectée" : "● Déconnectée"}
              </Badge>

              {page.active && (
                <Badge className="text-[10px] h-5 px-2 bg-primary/15 text-primary border-primary/20" variant="outline">
                  IA active
                </Badge>
              )}

              {!tokenValid && (
                <Badge variant="outline" className="text-[10px] h-5 px-2 border-amber-500/30 text-amber-600 bg-amber-500/5">
                  Token expiré
                </Badge>
              )}

              {page.webhookSubscribed && (
                <Badge variant="outline" className="text-[10px] h-5 px-2 border-violet-500/30 text-violet-500 bg-violet-500/5">
                  Webhook ✓
                </Badge>
              )}
            </div>
          </div>

          {/* ── Stats grid: 2×2 ── */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <StatCell
              icon="👥"
              label="Abonnés"
              value={page.followersCount > 0
                ? page.followersCount.toLocaleString("fr-FR")
                : "—"
              }
              accent="violet"
            />
            <StatCell
              icon="❤️"
              label="J'aime"
              value={page.fanCount > 0
                ? page.fanCount.toLocaleString("fr-FR")
                : "—"
              }
              accent="rose"
            />
            <StatCell
              icon="💬"
              label="Conversations"
              value={page.conversationsSynced > 0
                ? `${page.conversationsSynced} sync.`
                : "—"
              }
              accent="sky"
            />
            <StatCell
              icon="🕒"
              label="Dernière sync"
              value={page.lastSync}
              small
            />
          </div>

          {/* ── Sync result banner (3s after sync) ── */}
          {justSynced && lastSummary && (
            <div className="flex items-center gap-2 mb-3 rounded-lg bg-emerald-500/8 border border-emerald-500/20 px-3 py-2">
              <IconCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <p className="text-[11px] text-emerald-600 font-medium">
                Sync réussie ·{" "}
                {lastSummary.conversations >= 0
                  ? `${lastSummary.conversations} conversation(s)`
                  : "Conversations : erreur"}
                {lastSummary.posts === -1 && (
                  <span className="text-amber-600"> · Posts : permission manquante</span>
                )}
              </p>
            </div>
          )}

          {/* ── Footer: Sync + View page ── */}
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={`flex-1 h-8 gap-1.5 text-xs transition-all ${
                    isSyncing ? "opacity-70" : "hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                  }`}
                  disabled={isSyncing}
                  onClick={handleSync}
                >
                  <IconRefresh className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                  {isSyncing ? "Sync…" : "Synchroniser"}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs max-w-[200px] text-center">
                Synchronise les conversations et stats depuis Facebook
              </TooltipContent>
            </Tooltip>

            <a href={page.pageUrl} target="_blank" rel="noopener noreferrer">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs text-[#1877F2] border-[#1877F2]/20 hover:bg-[#1877F2]/5 hover:border-[#1877F2]/40"
              >
                <IconExternalLink className="h-3 w-3" />
                Voir
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* ── Disconnect confirmation ── */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3 text-destructive mb-2">
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <IconAlertTriangle className="h-5 w-5" />
              </div>
              <AlertDialogTitle>Déconnecter la page ?</AlertDialogTitle>
            </div>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Êtes-vous sûr de vouloir déconnecter{" "}
                  <strong>{page.name}</strong> ?
                </p>
                <div className="bg-muted p-3 rounded-md text-xs border-l-2 border-destructive/60">
                  <strong>Attention :</strong> L&apos;IA s&apos;arrêtera
                  immédiatement de répondre aux messages et les synchronisations
                  automatiques seront interrompues.
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleConfirmDisconnect(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? "Déconnexion…" : "Oui, déconnecter"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ─── StatCell ─── */
function StatCell({
  icon, label, value, accent, small = false,
}: {
  icon: string;
  label: string;
  value: string;
  accent?: "violet" | "sky" | "rose";
  small?: boolean;
}) {
  const textColor =
    accent === "violet" ? "text-violet-500" :
    accent === "sky"    ? "text-sky-500"    :
    accent === "rose"   ? "text-rose-500"   :
    "text-foreground";

  return (
    <div className="flex flex-col items-center text-center px-2 py-2.5 rounded-xl bg-secondary/40 border border-border/30">
      <span className="text-base leading-none mb-1">{icon}</span>
      <p className={`font-bold leading-tight ${small ? "text-[10px]" : "text-sm"} ${textColor}`}>
        {value}
      </p>
      <p className="text-[9px] text-muted-foreground uppercase tracking-wide mt-0.5">
        {label}
      </p>
    </div>
  );
}
