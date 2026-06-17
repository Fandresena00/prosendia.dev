/**
 * @file features/facebook/components/connect-account-dialog.tsx
 *
 * Step 1 of the OAuth connect flow.
 * Redirects the user to the Facebook OAuth consent screen.
 *
 * CHANGE — plan-based connection limit (point: limite selon le plan actuel):
 *   `connectedPagesLimit` is now accepted so the dialog can show an upgrade
 *   banner and disable "Continuer avec Facebook" BEFORE redirecting to
 *   Facebook OAuth. Without this, a user at their plan's page limit would
 *   go through the entire OAuth consent flow only to have the final
 *   connectPage() call rejected with a 400 — confusing and wasteful.
 *
 * Usage:
 *   <ConnectAccountDialog
 *     open={open}
 *     onClose={handleClose}
 *     businessProfileId={activeProfileId}   // optional — auto-created if omitted
 *     connectedPagesLimit={connectedPagesLimit}
 *   />
 */

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { IconAlertTriangle, IconBrandFacebook, IconShield } from "@tabler/icons-react";
import { Info } from "lucide-react";
import { useState } from "react";
import { getOAuthUrl } from "../services/facebook.service";
import type { ConnectedPagesLimitInfo } from "../types/facebook.types";

const SECURITY_NOTES = [
  "Vous êtes redirigé sur Facebook — VendeoAI ne voit jamais votre mot de passe",
  "Vous choisissez exactement quelles pages partager avec VendeoAI",
  "Vous pouvez révoquer l'accès à tout moment depuis vos paramètres Facebook",
  "Vos tokens sont chiffrés AES-256 et ne sont jamais revendus",
];

const PRE_CONNECT_TIPS = [
  "Assurez-vous d'être connecté au bon compte Facebook dans votre navigateur",
  "Acceptez toutes les permissions demandées pour que l'IA fonctionne correctement",
  "Vous pourrez sélectionner plusieurs pages en une seule fois",
];

interface ConnectAccountDialogProps {
  open:               boolean;
  onClose:            () => void;
  /**
   * businessProfileId to pass as the OAuth `state` parameter.
   * When undefined the backend will auto-create a default BusinessProfile.
   */
  businessProfileId?: string;
  /** Plan-based limit on connected pages (point: limite selon le plan actuel). */
  connectedPagesLimit?: ConnectedPagesLimitInfo;
}

export function ConnectAccountDialog({
  open,
  onClose,
  businessProfileId,
  connectedPagesLimit,
}: ConnectAccountDialogProps) {
  const [error,        setError]        = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const isLimitReached =
    !!connectedPagesLimit &&
    connectedPagesLimit.max !== null &&
    connectedPagesLimit.current >= connectedPagesLimit.max;

  const handleConnect = async () => {
    if (isLimitReached) return;
    setError(null);
    setIsRedirecting(true);
    try {
      // Pass the profileId (or a placeholder the backend accepts) as OAuth state
      const profileId = businessProfileId ?? "default";
      const url = await getOAuthUrl(profileId);
      window.location.href = url;
    } catch (err) {
      setIsRedirecting(false);
      setError(
        err instanceof Error
          ? err.message
          : "Impossible d'obtenir l'URL d'autorisation Facebook.",
      );
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2.5 text-sm font-semibold">
            <div className="h-7 w-7 rounded-full bg-[#1877F2]/10 flex items-center justify-center shrink-0">
              <IconBrandFacebook className="h-4 w-4 text-[#1877F2]" />
            </div>
            Connecter un compte Facebook
          </AlertDialogTitle>
        </AlertDialogHeader>

        <div className="space-y-3 py-1">
          {/* Plan limit banner (point: limite selon le plan actuel) */}
          {isLimitReached && connectedPagesLimit && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/8 p-3.5">
              <div className="flex items-center gap-2 mb-1">
                <IconAlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <p className="text-xs font-semibold text-amber-700">
                  Limite du plan {connectedPagesLimit.planName} atteinte (
                  {connectedPagesLimit.current}/{connectedPagesLimit.max})
                </p>
              </div>
              <p className="text-[11px] text-amber-600/80 leading-relaxed">
                Déconnectez une page existante, ou passez à un abonnement
                supérieur pour connecter davantage de pages Facebook.
              </p>
            </div>
          )}

          {/* Security note */}
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3.5">
            <div className="flex items-center gap-2 mb-2.5">
              <IconShield className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                Connexion sécurisée via Facebook OAuth
              </p>
            </div>
            <ul className="space-y-1.5">
              {SECURITY_NOTES.map((note, i) => (
                <li key={i} className="flex items-start gap-2 text-[11px] text-muted-foreground">
                  <span className="h-1 w-1 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  {note}
                </li>
              ))}
            </ul>
          </div>

          {/* Tips */}
          <div className="rounded-lg border border-border/50 bg-secondary/30 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <p className="text-[11px] font-semibold text-muted-foreground">
                Avant de continuer
              </p>
            </div>
            <ul className="space-y-1.5">
              {PRE_CONNECT_TIPS.map((tip, i) => (
                <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-2">
                  <span className="text-muted-foreground/40 mt-0.5 shrink-0">·</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-destructive bg-destructive/8 border border-destructive/20 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <AlertDialogCancel
              className="flex-1 h-8 text-xs"
              disabled={isRedirecting}
            >
              Annuler
            </AlertDialogCancel>
            <Button
              className="flex-1 h-8 text-xs gap-1.5 bg-[#1877F2] hover:bg-[#1877F2]/90 text-white"
              onClick={handleConnect}
              disabled={isRedirecting || isLimitReached}
            >
              <IconBrandFacebook className="h-3.5 w-3.5" />
              {isRedirecting
                ? "Redirection…"
                : isLimitReached
                  ? "Limite atteinte"
                  : "Continuer avec Facebook"}
            </Button>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
