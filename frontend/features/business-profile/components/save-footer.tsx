"use client";

/**
 * @file features/business-profile/components/save-footer.tsx
 *
 * CHANGES:
 *  - Multi-step save animation: idle → saving (spinner) → saved (green check) → idle
 *  - Error state with red border pulse
 *  - Animated border on the card when saving
 *  - Disabled state during save to prevent double-submit
 */

import { Button } from "@/components/ui/button";
import { IconBuildingStore, IconCheck, IconLoader2, IconX } from "@tabler/icons-react";
import { IconRobot } from "@tabler/icons-react";
import type { SaveState } from "../hooks/use-business-profile";

interface SaveFooterProps {
  saveState: SaveState;
  onSave:    () => void;
}

const STATE_CONFIG = {
  idle: {
    card:       "border-border/40 bg-card/60",
    primary:    "bg-primary hover:bg-primary/90",
    primaryText: "Activer l'assistant IA",
    primaryIcon: <IconRobot className="h-3.5 w-3.5" />,
    outline:    "",
    outlineText: "Sauvegarder le profil",
    disabled:   false,
  },
  saving: {
    card:       "border-primary/30 bg-primary/3 animate-pulse",
    primary:    "bg-primary/80 cursor-not-allowed",
    primaryText: "Sauvegarde…",
    primaryIcon: <IconLoader2 className="h-3.5 w-3.5 animate-spin" />,
    outline:    "opacity-50 cursor-not-allowed",
    outlineText: "Sauvegarder…",
    disabled:   true,
  },
  saved: {
    card:       "border-emerald-500/30 bg-emerald-500/5",
    primary:    "bg-emerald-500 hover:bg-emerald-500/90",
    primaryText: "Assistant activé !",
    primaryIcon: <IconCheck className="h-3.5 w-3.5" />,
    outline:    "border-emerald-500/30 text-emerald-600",
    outlineText: "Profil sauvegardé !",
    disabled:   false,
  },
  error: {
    card:       "border-destructive/30 bg-destructive/5",
    primary:    "bg-destructive hover:bg-destructive/90",
    primaryText: "Réessayer",
    primaryIcon: <IconX className="h-3.5 w-3.5" />,
    outline:    "border-destructive/30 text-destructive",
    outlineText: "Erreur — Réessayer",
    disabled:   false,
  },
} as const;

export function SaveFooter({ saveState, onSave }: SaveFooterProps) {
  const cfg = STATE_CONFIG[saveState];

  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-2xl border px-6 py-5 backdrop-blur-sm transition-all duration-500 ${cfg.card}`}
    >
      {/* Left: context text */}
      <div>
        <p className="text-sm font-semibold">
          {saveState === "saved"
            ? "✅ Configuration appliquée"
            : saveState === "error"
              ? "❌ Erreur de sauvegarde"
              : saveState === "saving"
                ? "⏳ Sauvegarde en cours…"
                : "Prêt à activer votre assistant ?"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {saveState === "saved"
            ? "L'IA utilise maintenant cette configuration."
            : saveState === "error"
              ? "La sauvegarde a échoué. Vérifiez votre connexion."
              : saveState === "saving"
                ? "Mise à jour du profil et de la configuration IA…"
                : "Sauvegardez pour que les changements soient pris en compte."}
        </p>
      </div>

      {/* Right: action buttons */}
      <div className="flex gap-3 shrink-0">
        <Button
          variant="outline"
          className={`h-9 gap-2 transition-all duration-300 ${cfg.outline}`}
          onClick={onSave}
          disabled={cfg.disabled}
        >
          <IconBuildingStore className="h-3.5 w-3.5" />
          {cfg.outlineText}
        </Button>

        <Button
          className={`h-9 gap-2 transition-all duration-300 ${cfg.primary}`}
          style={
            saveState === "idle"
              ? { boxShadow: "0 4px 16px oklch(0.52 0.24 256 / 22%)" }
              : saveState === "saved"
                ? { boxShadow: "0 4px 16px oklch(0.65 0.2 150 / 30%)" }
                : undefined
          }
          onClick={onSave}
          disabled={cfg.disabled}
        >
          {cfg.primaryIcon}
          {cfg.primaryText}
        </Button>
      </div>
    </div>
  );
}
