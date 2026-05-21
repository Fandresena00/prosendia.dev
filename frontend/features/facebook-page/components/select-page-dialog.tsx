/**
 * @file features/facebook/components/select-page-dialog.tsx
 *
 * Step 2 of the OAuth connect flow.
 * Shown after Facebook redirects back with `?oauth=ok`.
 * Reads available pages from sessionStorage (written by the /callback route handler).
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
  open:       boolean;
  onClose:    () => void;
  onSuccess?: () => void;
}

export function SelectPageDialog({
  open,
  onClose,
  onSuccess,
}: SelectPageDialogProps) {
  const [step,         setStep]         = useState<DialogStep>("select");
  const [pages,        setPages]        = useState<OAuthCallbackPage[]>([]);
  const [selectedPage, setSelectedPage] = useState<OAuthCallbackPage | null>(null);
  const [error,        setError]        = useState<string | null>(null);

  // Load pages from sessionStorage when the dialog first opens
  if (open && pages.length === 0 && step === "select") {
    const stored = sessionStorage.getItem("fb_oauth_pages");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as OAuthCallbackPage[];
        if (parsed.length > 0) setPages(parsed);
      } catch {
        // Malformed JSON — ignore, user will see "no pages available"
      }
    }
  }

  const handleConnect = async () => {
    if (!selectedPage) return;
    setStep("connecting");
    setError(null);

    try {
      const businessProfileId =
        sessionStorage.getItem("fb_oauth_business_profile_id") ?? undefined;

      await connectPage({
        businessProfileId,
        pageId:              selectedPage.id,
        pageAccessToken:     selectedPage.accessToken,
        pageName:            selectedPage.name,
        instagramAccountId:  selectedPage.instagramAccountId ?? undefined,
      });

      // Clear sessionStorage — pages are now connected
      sessionStorage.removeItem("fb_oauth_pages");
      sessionStorage.removeItem("fb_oauth_business_profile_id");

      setStep("done");
      onSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Une erreur est survenue.";
      setStep("select");

      if (msg.includes("already connected to another business profile")) {
        // Hide the already-connected page and update sessionStorage
        const remaining = pages.filter((p) => p.id !== selectedPage.id);
        setPages(remaining);
        sessionStorage.setItem("fb_oauth_pages", JSON.stringify(remaining));
        setSelectedPage(null);
        setError(
          `"${selectedPage.name}" est déjà connectée à un autre compte. Elle a été retirée de la liste.`,
        );
      } else {
        setError(msg);
      }
    }
  };

  const handleClose = () => {
    if (step === "connecting") return; // Block close during connection
    setStep("select");
    setSelectedPage(null);
    setError(null);
    onClose();
  };

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2.5 text-sm font-semibold">
            <div className="h-7 w-7 rounded-full bg-[#1877F2]/10 flex items-center justify-center shrink-0">
              <IconBrandFacebook className="h-4 w-4 text-[#1877F2]" />
            </div>
            {step === "done" ? "Page connectée !" : "Sélectionner une page"}
          </AlertDialogTitle>
        </AlertDialogHeader>

        {/* ── Step: select ── */}
        {step === "select" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Choisissez la page Facebook que l&apos;IA doit gérer.
            </p>

            {/* Error banner */}
            {error && (
              <div className="flex items-start gap-2 p-2.5 rounded-md bg-destructive/8 border border-destructive/20 text-destructive">
                <IconAlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">{error}</p>
              </div>
            )}

            {/* Page list */}
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
              {pages.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  Aucune page disponible. Relancez la connexion Facebook.
                </p>
              ) : (
                pages.map((page) => {
                  const isSelected = selectedPage?.id === page.id;
                  return (
                    <button
                      key={page.id}
                      onClick={() => setSelectedPage(page)}
                      className={`
                        w-full flex items-center justify-between p-2.5 rounded-lg border
                        transition-all text-left
                        ${isSelected
                          ? "border-emerald-500/40 bg-emerald-500/5 ring-1 ring-emerald-500/20"
                          : "border-border hover:border-border hover:bg-accent/40"
                        }
                      `}
                    >
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-8 w-8 rounded-md border border-border/50 shrink-0">
                          <AvatarImage
                            src={`https://graph.facebook.com/${page.id}/picture?type=large`}
                            alt={page.name}
                          />
                          <AvatarFallback className="rounded-md bg-primary/10 text-primary font-bold text-xs">
                            {page.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-xs font-semibold truncate max-w-[160px]">
                            {page.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-tight mt-0.5">
                            {page.category}
                          </p>
                        </div>
                      </div>

                      {isSelected && (
                        <div className="h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                          <IconCheck className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <AlertDialogCancel className="flex-1 h-8 text-xs">
                Annuler
              </AlertDialogCancel>
              <Button
                disabled={!selectedPage}
                onClick={handleConnect}
                className="flex-1 h-8 text-xs"
              >
                Connecter la page
              </Button>
            </div>
          </div>
        )}

        {/* ── Step: connecting ── */}
        {step === "connecting" && (
          <div className="flex flex-col items-center gap-4 py-10">
            <IconLoader2 className="h-9 w-9 text-primary animate-spin" />
            <div className="text-center">
              <p className="text-sm font-semibold">Connexion en cours…</p>
              <p className="text-xs text-muted-foreground mt-1">
                Liaison de &quot;{selectedPage?.name}&quot; à votre compte VendeoAI.
              </p>
            </div>
          </div>
        )}

        {/* ── Step: done ── */}
        {step === "done" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <IconCheck className="h-6 w-6 text-emerald-500" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold">Page ajoutée !</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                L&apos;IA est maintenant active sur{" "}
                <span className="font-semibold text-foreground">{selectedPage?.name}</span>.
              </p>
            </div>
            <Button className="w-full h-8 text-xs mt-1" onClick={handleClose}>
              Terminer
            </Button>
          </div>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
