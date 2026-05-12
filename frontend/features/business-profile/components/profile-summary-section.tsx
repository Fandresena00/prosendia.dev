"use client";

/**
 * @file features/business-profile/components/profile-summary-section.tsx
 *
 * CHANGES:
 *  - Shows reference images / presets the AI can send to clients
 *  - WhatsApp row removed
 *  - Reference images count shown with "Utilisées par l'IA" badge
 */

import { Badge } from "@/components/ui/badge";
import { IconPhoto, IconSparkles } from "@tabler/icons-react";
import { BUSINESS_TYPES, STYLE_OPTIONS, TONE_OPTIONS } from "../data/business-profile.data";
import type { BusinessProfileForm, ReferencePresetDto } from "../types/business-profile.types";
import { SectionCard } from "./ui-primitives";

interface ProfileSummarySectionProps {
  form:             BusinessProfileForm;
  referencePresets: ReferencePresetDto[];
}

export function ProfileSummarySection({
  form,
  referencePresets,
}: ProfileSummarySectionProps) {
  const businessLabel = BUSINESS_TYPES.find((t) => t.value === form.businessType)?.label ?? form.businessType;
  const toneLabel     = TONE_OPTIONS.find((t)  => t.value === form.tone)?.label          ?? form.tone;
  const styleLabel    = STYLE_OPTIONS.find((s)  => s.value === form.responseStyle)?.label ?? form.responseStyle;

  const totalImages = referencePresets.reduce((sum, p) => sum + p.images.length, 0);

  const rows = [
    {
      icon:  "🏪",
      label: "Business",
      value: `${form.name} — ${businessLabel}`,
      color: "border-violet-500/20 bg-violet-500/5 text-violet-600",
    },
    {
      icon:  "🎙️",
      label: "Ton & Style",
      value: `${toneLabel} · ${styleLabel}`,
      color: "border-sky-500/20 bg-sky-500/5 text-sky-600",
    },
    {
      icon:  "🤖",
      label: "Mode",
      value: form.autoReply
        ? "Auto-reply activé — l'IA répond automatiquement"
        : "Mode suggestion — validation manuelle requise",
      color: form.autoReply
        ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-600"
        : "border-amber-500/20 bg-amber-500/5 text-amber-600",
    },
    {
      icon:  "📘",
      label: "Page Facebook",
      value: form.facebookPageId ? `facebook.com/${form.facebookPageId}` : "Aucune page liée",
      color: "border-[#1877F2]/20 bg-[#1877F2]/5 text-[#1877F2]",
    },
  ];

  return (
    <SectionCard
      step="06"
      icon={<IconSparkles className="h-4 w-4 text-amber-500" />}
      title="Résumé du profil"
      accent="amber"
    >
      <div className="space-y-3">
        {rows.map((row) => (
          <div
            key={row.label}
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${row.color}`}
          >
            <span className="text-base shrink-0 mt-0.5">{row.icon}</span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">
                {row.label}
              </p>
              <p className="text-[12px] font-medium mt-0.5 leading-snug">
                {row.value}
              </p>
            </div>
          </div>
        ))}

        {/* Reference images used by AI */}
        <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <IconPhoto className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary/60">
                Images de référence
              </p>
              <Badge variant="default" className="text-[9px] h-4 px-1.5">
                Utilisées par l'IA
              </Badge>
            </div>
            {referencePresets.length === 0 ? (
              <p className="text-[12px] font-medium mt-0.5 text-primary">
                Aucune image — ajoutez-en dans l'inbox
              </p>
            ) : (
              <div className="mt-1.5 space-y-1">
                {referencePresets.slice(0, 3).map((preset) => (
                  <div key={preset.id} className="flex items-center gap-2">
                    {/* Thumbnail */}
                    {preset.images[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={preset.images[0].url}
                        alt={preset.name}
                        className="h-6 w-6 rounded object-cover shrink-0"
                      />
                    )}
                    <p className="text-[11px] font-medium text-primary truncate">
                      {preset.name}
                    </p>
                    <span className="text-[10px] text-primary/60 shrink-0">
                      {preset.images.length} photo{preset.images.length > 1 ? "s" : ""}
                    </span>
                  </div>
                ))}
                {referencePresets.length > 3 && (
                  <p className="text-[11px] text-primary/60">
                    +{referencePresets.length - 3} autre{referencePresets.length - 3 > 1 ? "s" : ""}
                  </p>
                )}
                <p className="text-[11px] text-primary/70 mt-1">
                  {totalImages} image{totalImages > 1 ? "s" : ""} au total — l'IA peut les envoyer aux clients
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
