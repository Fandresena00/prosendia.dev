/**
 * @file features/business-profile/components/profile-summary-section.tsx
 * Section 06 — Live read-only summary of the current profile configuration.
 */

import { IconSparkles } from "@tabler/icons-react";
import { BUSINESS_TYPES, STYLE_OPTIONS, TONE_OPTIONS } from "../data/business-profile.data";
import type { BusinessProfileForm } from "../types/business-profile.types";
import { SectionCard } from "./ui-primitives";

interface ProfileSummarySectionProps {
  form: BusinessProfileForm;
}

export function ProfileSummarySection({ form }: ProfileSummarySectionProps) {
  const businessLabel = BUSINESS_TYPES.find((t) => t.value === form.businessType)?.label ?? form.businessType;
  const toneLabel     = TONE_OPTIONS.find((t)  => t.value === form.tone)?.label          ?? form.tone;
  const styleLabel    = STYLE_OPTIONS.find((s)  => s.value === form.responseStyle)?.label ?? form.responseStyle;

  const rows: { icon: string; label: string; value: string; color: string }[] = [
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
      icon:  "📱",
      label: "Canaux",
      value: `${form.facebookPageId ? `fb.com/${form.facebookPageId}` : "Pas de page liée"} · ${form.whatsappNumber || "Pas de WhatsApp"}`,
      color: "border-border/40 bg-secondary/30 text-foreground",
    },
  ];

  return (
    <SectionCard
      step="06"
      icon={<IconSparkles className="h-4 w-4 text-amber-500" />}
      title="Résumé du profil actuel"
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
      </div>
    </SectionCard>
  );
}
