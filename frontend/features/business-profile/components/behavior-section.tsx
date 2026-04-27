/**
 * @file features/business-profile/components/behavior-section.tsx
 * Section 02 — AI behavior: tone, response style, auto-reply toggle.
 */

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { IconRobot } from "@tabler/icons-react";
import { STYLE_OPTIONS, TONE_OPTIONS } from "../data/business-profile.data";
import type { ResponseStyle, Tone } from "../types/business-profile.types";
import { SectionCard, ToggleCard } from "./ui-primitives";

interface BehaviorSectionProps {
  tone:          Tone;
  responseStyle: ResponseStyle;
  autoReply:     boolean;
  onToneChange:          (v: Tone) => void;
  onResponseStyleChange: (v: ResponseStyle) => void;
  onAutoReplyChange:     (v: boolean) => void;
}

export function BehaviorSection({
  tone, responseStyle, autoReply,
  onToneChange, onResponseStyleChange, onAutoReplyChange,
}: BehaviorSectionProps) {
  return (
    <SectionCard
      step="02"
      icon={<IconRobot className="h-4 w-4 text-primary" />}
      title="Comportement de l'IA"
      accent="primary"
    >
      <div className="space-y-5">
        {/* Tone */}
        <div className="space-y-2.5">
          <Label className="text-xs font-medium">Ton de communication</Label>
          <div className="grid grid-cols-3 gap-2">
            {TONE_OPTIONS.map((t) => (
              <ToggleCard
                key={t.value}
                label={t.label}
                desc={t.desc}
                active={tone === t.value}
                onClick={() => onToneChange(t.value)}
              />
            ))}
          </div>
        </div>

        {/* Response style */}
        <div className="space-y-2.5">
          <Label className="text-xs font-medium">Style de réponse</Label>
          <div className="grid grid-cols-3 gap-2">
            {STYLE_OPTIONS.map((s) => (
              <ToggleCard
                key={s.value}
                label={s.label}
                desc={s.desc}
                active={responseStyle === s.value}
                onClick={() => onResponseStyleChange(s.value)}
              />
            ))}
          </div>
        </div>

        {/* Auto-reply toggle */}
        <div
          className={`flex items-center justify-between rounded-xl border px-4 py-3.5 transition-colors ${
            autoReply
              ? "border-emerald-500/25 bg-emerald-500/5"
              : "border-border/40 bg-secondary/20"
          }`}
        >
          <div>
            <p className="text-sm font-semibold">Auto-reply</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {autoReply
                ? "L'IA répond automatiquement aux messages."
                : "L'IA suggère — vous validez avant envoi."}
            </p>
          </div>
          <Switch checked={autoReply} onCheckedChange={onAutoReplyChange} />
        </div>
      </div>
    </SectionCard>
  );
}
