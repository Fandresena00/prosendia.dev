/**
 * @file features/facebook/components/select-page-dialog.tsx
 *
 * Step 2 of the connect flow — shown after OAuth redirect.
 * Reads available pages from sessionStorage and lets the user pick one to connect.
 */

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  IconAlertCircle,
  IconBrandFacebook,
  IconCheck,
  IconLoader2,
} from "@tabler/icons-react";
import { useState } from "react";
import { connectPage } from "../services/facebook.service";
import type { OAuthCallbackPage } from "../types/facebook.types";

type DialogStep = "select" | "connecting" | "done";

interface SelectPageDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function SelectPageDialog({ open, onClose, onSuccess }: SelectPageDialogProps) {
  const [step, setStep]               = useState<DialogStep>("select");
  const [pages, setPages]             = useState<OAuthCallbackPage[]>([]);
  const [selectedPage, setSelectedPage] = useState<OAuthCallbackPage | null>(null);
  const [error, setError]             = useState<string | null>(null);

  /* Load pages from sessionStorage when dialog opens */
  if (open && pages.length === 0) {
    const stored = sessionStorage.getItem("fb_oauth_pages");
    if (stored) {
      try {
        setPages(JSON.parse(stored) as OAuthCallbackPage[]);
      } catch {
        /* malformed JSON — ignore */
      }
    }
  }

  const handleConnect = async () => {
    if (!selectedPage) return;
    setStep("connecting");
    setError(null);

    try {
      await connectPage({
        pageId: selectedPage.id,
        pageAccessToken: selectedPage.accessToken,
        pageName: selectedPage.name,
        instagramAccountId: selectedPage.instagramAccountId ?? undefined,
      });
      setStep("done");
      onSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Une erreur est survenue.";
      setStep("select");

      if (msg.includes("already connected to another business profile")) {
        /* Hide the already-connected page to avoid confusion */
        const remaining = pages.filter((p) => p.id !== selectedPage.id);
        setPages(remaining);
        sessionStorage.setItem("fb_oauth_pages", JSON.stringify(remaining));
        setSelectedPage(null);
        setError(`La page "${selectedPage.name}" est déjà connectée à un autre compte. Elle a été retirée de la liste.`);
      } else {
        setError(msg);
      }
    }
  };

  const handleClose = () => {
    setStep("select");
    setSelectedPage(null);
    setError(null);
    onClose();
  };

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="max-w-md gap-6">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2.5 text-base font-bold">
            <div className="h-8 w-8 rounded-full bg-[#1877F2]/10 flex items-center justify-center">
              <IconBrandFacebook className="h-4.5 w-4.5 text-[#1877F2]" />
            </div>
            {step === "done" ? "Page connectée !" : "Sélectionner une page"}
          </AlertDialogTitle>
        </AlertDialogHeader>

        {/* ── Step: select ── */}
        {step === "select" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Choisissez la page Facebook que l&apos;IA doit gérer.
            </p>

            {/* Error banner */}
            {error && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-destructive/8 border border-destructive/20 text-destructive animate-in fade-in slide-in-from-top-1">
                <IconAlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <p className="text-xs font-medium leading-relaxed">{error}</p>
              </div>
            )}

            {/* Page list */}
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {pages.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">
                  Aucune page disponible. Veuillez relancer la connexion.
                </p>
              )}
              {pages.map((page) => {
                const isSelected = selectedPage?.id === page.id;
                return (
                  <button
                    key={page.id}
                    onClick={() => setSelectedPage(page)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "border-border hover:border-primary/40 hover:bg-accent/40"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 rounded-md border border-border/50 shrink-0">
                        <AvatarImage
                          src={`https://graph.facebook.com/${page.id}/picture?type=large`}
                          alt={page.name}
                          className="object-cover"
                        />
                        <AvatarFallback className="rounded-md bg-primary/10 text-primary font-bold text-xs">
                          {page.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="text-left">
                        <p className="text-sm font-semibold truncate max-w-[180px]">
                          {page.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-tight">
                          {page.category}
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                        <IconCheck className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <AlertDialogCancel className="flex-1 h-9 text-sm">Annuler</AlertDialogCancel>
              <Button
                disabled={!selectedPage}
                onClick={handleConnect}
                className="flex-1 h-9"
              >
                Connecter la page
              </Button>
            </div>
          </div>
        )}

        {/* ── Step: connecting ── */}
        {step === "connecting" && (
          <div className="flex flex-col items-center gap-4 py-10">
            <IconLoader2 className="h-10 w-10 text-primary animate-spin" />
            <div className="text-center">
              <p className="text-sm font-semibold">Connexion en cours…</p>
              <p className="text-xs text-muted-foreground mt-1">
                Liaison de la page à votre profil VendeoAI.
              </p>
            </div>
          </div>
        )}

        {/* ── Step: done ── */}
        {step === "done" && (
          <div className="space-y-4 py-1">
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="h-14 w-14 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                <IconCheck className="h-7 w-7 text-emerald-500" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold">Page ajoutée avec succès !</p>
                <p className="text-xs text-muted-foreground mt-1">
                  L&apos;IA est maintenant active sur{" "}
                  <strong>{selectedPage?.name}</strong>.
                </p>
              </div>
            </div>
            <Button className="w-full h-9 text-sm" onClick={handleClose}>
              Terminer
            </Button>
          </div>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
