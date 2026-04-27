/**
 * @file features/business-profile/components/save-footer.tsx
 * Bottom save bar with two CTA buttons.
 */

import { Button } from "@/components/ui/button";
import { IconBuildingStore, IconCheck, IconRobot } from "@tabler/icons-react";

interface SaveFooterProps {
  saved:    boolean;
  onSave:   () => void;
}

export function SaveFooter({ saved, onSave }: SaveFooterProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm px-6 py-5">
      <div>
        <p className="text-sm font-semibold">Prêt à activer votre assistant ?</p>
        <p className="text-xs text-muted-foreground mt-1">
          Sauvegardez pour que les changements soient pris en compte par l&apos;IA.
        </p>
      </div>

      <div className="flex gap-3 shrink-0">
        <Button variant="outline" className="h-9 gap-2" onClick={onSave}>
          <IconBuildingStore className="h-3.5 w-3.5" />
          Sauvegarder le profil
        </Button>

        <Button
          className="h-9 gap-2"
          style={{ boxShadow: "0 4px 16px oklch(0.52 0.24 256 / 22%)" }}
          onClick={onSave}
        >
          {saved ? (
            <>
              <IconCheck className="h-3.5 w-3.5" />
              Assistant activé !
            </>
          ) : (
            <>
              <IconRobot className="h-3.5 w-3.5" />
              Activer l&apos;assistant IA
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
