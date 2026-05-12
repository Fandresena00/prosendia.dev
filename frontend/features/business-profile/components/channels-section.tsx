"use client";

/**
 * @file features/business-profile/components/channels-section.tsx
 * Section 05 — Facebook page ID only. WhatsApp removed.
 */

import { Input } from "@/components/ui/input";
import { IconBrandFacebook } from "@tabler/icons-react";
import { Field, SectionCard } from "./ui-primitives";

interface ChannelsSectionProps {
  facebookPageId:   string;
  onFacebookChange: (v: string) => void;
}

export function ChannelsSection({
  facebookPageId,
  onFacebookChange,
}: ChannelsSectionProps) {
  return (
    <SectionCard
      step="05"
      icon={<IconBrandFacebook className="h-4 w-4 text-[#1877F2]" />}
      title="Page Facebook"
      accent="facebook"
      subtitle="Identifiant de la page utilisée par l'IA pour répondre."
    >
      <Field
        label="Identifiant de la page"
        hint="L'identifiant unique de votre page (ex : maboutique)."
      >
        <div className="flex items-center gap-0 rounded-lg border border-border/50 overflow-hidden focus-within:ring-1 focus-within:ring-primary/50">
          <span className="text-xs text-muted-foreground bg-secondary/60 px-3 h-9 flex items-center shrink-0 border-r border-border/50">
            facebook.com/
          </span>
          <Input
            value={facebookPageId}
            onChange={(e) => onFacebookChange(e.target.value)}
            className="h-9 text-sm border-0 rounded-none focus-visible:ring-0 bg-transparent"
            placeholder="maboutique"
          />
        </div>
      </Field>
    </SectionCard>
  );
}
