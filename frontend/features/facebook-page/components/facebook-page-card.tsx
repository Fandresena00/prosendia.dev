/**
 * @file features/facebook/components/facebook-page-card.tsx
 *
 * Linear-inspired page card:
 * - Horizontal header: avatar left, name + badges right
 * - Three stat cells with Tabler icons (no emojis)
 * - Emerald accent for active state and sync success
 * - Token health badge with clear visual hierarchy
 * - Disconnect confirmation dialog
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
import { Card, CardContent, CardFooter } from "@/components/ui/card";
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
  IconArrowUpRight,
  IconCheck,
  IconDotsVertical,
  IconMessages,
  IconPhotoFilled,
  IconRefresh,
  IconTrash,
  IconUsers,
  IconWebhook,
} from "@tabler/icons-react";
import { AlertCircle } from "lucide-react";
import { useState } from "react";
import type { FacebookPage, SyncSummary } from "../types/facebook.types";

interface FacebookPageCardProps {
  page:          FacebookPage;
  isSyncing:     boolean;
  lastSummary?:  SyncSummary;
  onSync:        () => Promise<void>;
  onDisconnect:  () => Promise<void>;
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
    setTimeout(() => setJustSynced(false), 4000);
  };

  const handleConfirmDisconnect = async () => {
    setIsDeleting(true);
    try {
      await onDisconnect();
    } finally {
      setIsDeleting(false);
      setShowConfirm(false);
    }
  };

  const health = page.tokenHealth;

  return (
    <>
      <Card className={`
        relative flex flex-col overflow-hidden transition-all duration-200
        border-border/60 hover:border-border
        ${page.active ? "ring-1 ring-emerald-500/20 border-emerald-500/30" : ""}
      `}>
        {/* Emerald left accent for active pages */}
        {page.active && (
          <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-emerald-500/70" />
        )}

        {/* ── Header ── */}
        <CardContent className="px-4 pt-4 pb-3 flex-1">
          <div className="flex items-start gap-3">
            {/* Avatar */}
            <div className="relative shrink-0">
              <Avatar className="h-10 w-10 rounded-lg border border-border/60">
                <AvatarImage
                  src={page.avatar}
                  alt={page.name}
                  className="object-cover"
                />
                <AvatarFallback className="rounded-lg bg-emerald-500/10 text-emerald-600 font-bold text-sm">
                  {page.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {/* Live dot */}
              {page.active && (
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-background shadow-sm" />
              )}
            </div>

            {/* Name + category */}
            <div className="flex-1 min-w-0 pr-6">
              <p className="text-sm font-semibold leading-snug truncate">{page.name}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{page.category}</p>
            </div>

            {/* Three-dot menu */}
            <div className="absolute top-3 right-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground/60 hover:text-foreground"
                  >
                    <IconDotsVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
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
          </div>

          {/* ── Badge row ── */}
          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            <Badge
              variant="outline"
              className={`text-[10px] h-5 px-1.5 gap-1 font-medium ${
                page.connected
                  ? "border-emerald-500/30 text-emerald-600 bg-emerald-500/8"
                  : "border-destructive/30 text-destructive bg-destructive/8"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${
                page.connected ? "bg-emerald-500" : "bg-destructive"
              }`} />
              {page.connected ? "Connectée" : "Déconnectée"}
            </Badge>

            {page.active && (
              <Badge
                variant="outline"
                className="text-[10px] h-5 px-1.5 gap-1 font-medium border-emerald-500/30 text-emerald-600 bg-emerald-500/8"
              >
                IA active
              </Badge>
            )}

            {health === "invalid" && (
              <Badge
                variant="outline"
                className="text-[10px] h-5 px-1.5 gap-1 font-medium border-amber-500/30 text-amber-600 bg-amber-500/8"
              >
                <AlertCircle className="h-2.5 w-2.5" />
                Token expiré
              </Badge>
            )}

            {health === "expiring" && (
              <Badge
                variant="outline"
                className="text-[10px] h-5 px-1.5 gap-1 font-medium border-orange-500/30 text-orange-600 bg-orange-500/8"
              >
                <AlertCircle className="h-2.5 w-2.5" />
                Expire bientôt
              </Badge>
            )}

            {page.webhookSubscribed && (
              <Badge
                variant="outline"
                className="text-[10px] h-5 px-1.5 gap-1 font-medium border-violet-500/30 text-violet-500 bg-violet-500/8"
              >
                <IconWebhook className="h-2.5 w-2.5" />
                Webhook
              </Badge>
            )}
          </div>

          {/* ── Stats row ── */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <StatCell
              icon={<IconUsers className="h-3.5 w-3.5" />}
              label="Abonnés"
              value={page.followersCount > 0
                ? formatCount(page.followersCount)
                : "—"
              }
            />
            <StatCell
              icon={<IconMessages className="h-3.5 w-3.5" />}
              label="Convs. sync."
              value={page.conversationsSynced > 0
                ? String(page.conversationsSynced)
                : "—"
              }
              accent="emerald"
            />
            <StatCell
              icon={<IconPhotoFilled className="h-3.5 w-3.5" />}
              label="Posts sync."
              value={
                lastSummary?.posts === -1
                  ? "N/A"
                  : page.postsSynced > 0
                    ? String(page.postsSynced)
                    : "—"
              }
            />
          </div>

          {/* ── Last sync ── */}
          <p className="text-[10px] text-muted-foreground/70 mt-3 tracking-tight">
            Dernière sync : {page.lastSync}
          </p>
          {lastSummary && (
            <p className="text-[10px] text-muted-foreground/70 mt-1 tracking-tight">
              Résultat : {formatSyncSummary(lastSummary)}
            </p>
          )}

          {/* ── Sync result banner ── */}
          {justSynced && lastSummary && (
            <div className="flex items-center gap-2 mt-3 rounded-md bg-emerald-500/8 border border-emerald-500/20 px-2.5 py-1.5">
              <IconCheck className="h-3 w-3 text-emerald-500 shrink-0" />
              <p className="text-[11px] text-emerald-600 font-medium leading-tight">
                Synchronisé · {lastSummary.conversations >= 0
                  ? `${lastSummary.conversations} conv.`
                  : "Convs : erreur"
                }
                {lastSummary.posts >= 0
                  ? ` · ${lastSummary.posts} posts`
                  : " · Posts : permission requise"
                }
              </p>
            </div>
          )}
        </CardContent>

        {/* ── Footer ── */}
        <CardFooter className="px-4 pb-4 pt-0 flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={`flex-1 h-8 text-xs gap-1.5 transition-colors ${
                  isSyncing
                    ? "opacity-60 cursor-not-allowed"
                    : "hover:border-emerald-500/40 hover:bg-emerald-500/5 hover:text-emerald-600"
                }`}
                disabled={isSyncing}
                onClick={handleSync}
              >
                <IconRefresh className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                {isSyncing ? "Sync…" : "Synchroniser"}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Synchronise les conversations et posts depuis Facebook
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href={page.pageUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0 text-[#1877F2] border-[#1877F2]/20 hover:bg-[#1877F2]/5 hover:border-[#1877F2]/40"
                >
                  <IconArrowUpRight className="h-3.5 w-3.5" />
                </Button>
              </a>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Ouvrir la page Facebook
            </TooltipContent>
          </Tooltip>
        </CardFooter>
      </Card>

      {/* ── Disconnect confirmation ── */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-9 w-9 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <IconAlertTriangle className="h-4.5 w-4.5 text-destructive" />
              </div>
              <AlertDialogTitle className="text-sm font-semibold">
                Déconnecter &quot;{page.name}&quot; ?
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-xs leading-relaxed text-muted-foreground">
              L&apos;IA cessera immédiatement de répondre aux messages et les
              synchronisations automatiques seront arrêtées. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel
              disabled={isDeleting}
              className="h-8 text-xs"
            >
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleConfirmDisconnect(); }}
              className="h-8 text-xs bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              disabled={isDeleting}
            >
              {isDeleting ? "Déconnexion…" : "Déconnecter"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── StatCell ─────────────────────────────────────────────────────────────────

function StatCell({
  icon, label, value, accent,
}: {
  icon:     React.ReactNode;
  label:    string;
  value:    string;
  accent?:  "emerald";
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-secondary/40 border border-border/40 px-2.5 py-2">
      <div className={`${accent === "emerald" ? "text-emerald-500" : "text-muted-foreground/60"}`}>
        {icon}
      </div>
      <p className={`text-sm font-semibold leading-none ${
        accent === "emerald" ? "text-emerald-600" : "text-foreground"
      }`}>
        {value}
      </p>
      <p className="text-[9px] text-muted-foreground uppercase tracking-wide leading-none">
        {label}
      </p>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString("fr-FR");
}

function formatSyncSummary(summary: SyncSummary): string {
  const convs = summary.conversations >= 0
    ? `${summary.conversations} conv.`
    : "Convs : erreur";
  const posts = summary.posts >= 0
    ? `${summary.posts} posts`
    : "Posts : permission requise";
  return `${convs} · ${posts} · ${summary.timestamp.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}
