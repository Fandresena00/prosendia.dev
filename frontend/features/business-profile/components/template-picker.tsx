/**
 * @file features/business-profile/components/template-picker.tsx
 * Collapsible grid of preset templates. Applies a template on click.
 */

import { Badge } from "@/components/ui/badge";
import { IconSparkles, IconX } from "@tabler/icons-react";
import { TONE_OPTIONS, STYLE_OPTIONS } from "../data/business-profile.data";
import type { Template } from "../types/business-profile.types";

interface TemplatePickerProps {
  templates:     Template[];
  onApply:       (tpl: Template) => void;
  onClose:       () => void;
}

export function TemplatePicker({ templates, onApply, onClose }: TemplatePickerProps) {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/4 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <IconSparkles className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">Choisir un exemple de départ</p>
          <Badge variant="secondary" className="text-[10px] h-5">Pré-rempli</Badge>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
          aria-label="Fermer"
        >
          <IconX className="h-4 w-4" />
        </button>
      </div>

      {/* Template grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {templates.map((tpl) => {
          const toneLbl  = TONE_OPTIONS.find((t) => t.value === tpl.tone)?.label  ?? tpl.tone;
          const styleLbl = STYLE_OPTIONS.find((s) => s.value === tpl.responseStyle)?.label ?? tpl.responseStyle;

          return (
            <button
              key={tpl.businessType}
              type="button"
              onClick={() => onApply(tpl)}
              className="text-left rounded-xl border border-border/50 bg-background hover:border-primary/40 hover:bg-primary/4 transition-all p-4 space-y-1.5"
            >
              <p className="text-sm font-semibold">{tpl.label}</p>
              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {tpl.description}
              </p>
              <p className="text-[11px] text-primary font-medium">
                {toneLbl} · {styleLbl}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
