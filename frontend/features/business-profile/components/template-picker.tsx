"use client";

/**
 * @file features/business-profile/components/template-picker.tsx
 * Template picker — shows both hardcoded examples AND saved user profiles.
 */

import { Badge } from "@/components/ui/badge";
import { IconBookmark, IconSparkles, IconX } from "@tabler/icons-react";
import { TONE_OPTIONS, STYLE_OPTIONS } from "../data/business-profile.data";
import type { Template } from "../types/business-profile.types";

interface TemplatePickerProps {
  templates: Template[];
  onApply:   (tpl: Template) => void;
  onClose:   () => void;
}

export function TemplatePicker({ templates, onApply, onClose }: TemplatePickerProps) {
  const userTemplates    = templates.filter((t) => t.isUserSaved);
  const defaultTemplates = templates.filter((t) => !t.isUserSaved);

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/3 p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <IconSparkles className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">Choisir un point de départ</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
        >
          <IconX className="h-4 w-4" />
        </button>
      </div>

      {/* User saved profiles */}
      {userTemplates.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <IconBookmark className="h-3.5 w-3.5 text-amber-500" />
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Mes profils sauvegardés
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {userTemplates.map((tpl) => (
              <TemplateCard key={tpl.profileId} tpl={tpl} onApply={onApply} isUserSaved />
            ))}
          </div>
        </div>
      )}

      {/* Divider (only when both sections exist) */}
      {userTemplates.length > 0 && (
        <div className="border-t border-border/40" />
      )}

      {/* Default templates */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <IconSparkles className="h-3.5 w-3.5 text-primary" />
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Exemples pré-remplis
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {defaultTemplates.map((tpl) => (
            <TemplateCard key={tpl.businessType} tpl={tpl} onApply={onApply} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Template card ─────────────────────────────────────────────────────────────

function TemplateCard({
  tpl,
  onApply,
  isUserSaved = false,
}: {
  tpl:          Template;
  onApply:      (t: Template) => void;
  isUserSaved?: boolean;
}) {
  const toneLabel  = TONE_OPTIONS.find((t) => t.value === tpl.tone)?.label  ?? tpl.tone;
  const styleLabel = STYLE_OPTIONS.find((s) => s.value === tpl.responseStyle)?.label ?? tpl.responseStyle;

  return (
    <button
      type="button"
      onClick={() => onApply(tpl)}
      className={`text-left rounded-xl border transition-all p-4 space-y-2 group ${
        isUserSaved
          ? "border-amber-500/25 bg-amber-500/4 hover:border-amber-500/50 hover:bg-amber-500/8"
          : "border-border/50 bg-background hover:border-primary/40 hover:bg-primary/4"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-snug">{tpl.label}</p>
        {isUserSaved && (
          <Badge variant="secondary" className="text-[9px] h-4 px-1.5 shrink-0 bg-amber-500/10 text-amber-600 border-amber-500/20">
            Sauvegardé
          </Badge>
        )}
      </div>
      {tpl.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {tpl.description}
        </p>
      )}
      <p className={`text-[11px] font-medium ${isUserSaved ? "text-amber-600" : "text-primary"}`}>
        {toneLabel} · {styleLabel}
        {tpl.autoReply && " · Auto-reply ✓"}
      </p>
    </button>
  );
}
