/**
 * @file features/facebook/components/connect-account-dialog.tsx
 *
 * Step 1 of the connect flow.
 * Redirects the user to the Facebook OAuth dialog.
 */

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { IconBrandFacebook, IconShield } from "@tabler/icons-react";
import { Info } from "lucide-react";
import { useState } from "react";
import { getOAuthUrl } from "../services/facebook.service";

// TODO: Replace with real businessProfileId from auth/profile context
const BUSINESS_PROFILE_ID = "default-profile-id";

const SECURITY_TIPS = [
  "Vous êtes redirigé sur Facebook — VendeoAI ne voit jamais votre mot de passe",
  "Vous choisissez exactement quelles pages partager avec VendeoAI",
  "Vous pouvez révoquer l'accès à tout moment depuis vos paramètres Facebook",
  "Vos données sont chiffrées et ne sont jamais revendues",
];

const PRE_CONNECT_TIPS = [
  "Assurez-vous d'être connecté au bon compte Facebook dans votre navigateur",
  "Acceptez toutes les permissions demandées pour que l'IA fonctionne correctement",
  "Vous pourrez sélectionner plusieurs pages en une seule fois",
];

interface ConnectAccountDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ConnectAccountDialog({ open, onClose }: ConnectAccountDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleConnect = async () => {
    setError(null);
    setIsRedirecting(true);
    try {
      const url = await getOAuthUrl(BUSINESS_PROFILE_ID);
      window.location.href = url;
    } catch (err) {
      setIsRedirecting(false);
      setError(err instanceof Error ? err.message : "Impossible d'obtenir l'URL OAuth.");
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2.5 text-base">
            <div className="h-8 w-8 rounded-full bg-[#1877F2]/10 flex items-center justify-center">
              <IconBrandFacebook className="h-4.5 w-4.5 text-[#1877F2]" />
            </div>
            Connecter un compte Facebook
          </AlertDialogTitle>
        </AlertDialogHeader>

        <div className="space-y-4 py-1">
          {/* Security card */}
          <div className="rounded-lg border border-[#1877F2]/20 bg-[#1877F2]/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <IconShield className="h-4 w-4 text-[#1877F2] shrink-0" />
              <p className="text-sm font-semibold text-[#1877F2]">
                Connexion 100 % sécurisée via Facebook
              </p>
            </div>
            <ul className="space-y-2">
              {SECURITY_TIPS.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#1877F2] mt-1.5 shrink-0" />
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          {/* Tips card */}
          <div className="rounded-lg border border-border/50 bg-secondary/30 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <p className="text-xs font-semibold text-muted-foreground">
                Avant de continuer
              </p>
            </div>
            <ul className="space-y-1.5">
              {PRE_CONNECT_TIPS.map((tip, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                  <span className="text-primary/60 mt-0.5 shrink-0">·</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <AlertDialogCancel className="flex-1 h-9 text-sm" disabled={isRedirecting}>
              Annuler
            </AlertDialogCancel>
            <Button
              className="flex-1 h-9 gap-2 bg-[#1877F2] hover:bg-[#1877F2]/90 text-white"
              onClick={handleConnect}
              disabled={isRedirecting}
            >
              <IconBrandFacebook className="h-4 w-4" />
              {isRedirecting ? "Redirection…" : "Continuer avec Facebook"}
            </Button>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
