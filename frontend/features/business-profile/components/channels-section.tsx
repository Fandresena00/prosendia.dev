/**
 * @file features/business-profile/components/channels-section.tsx
 * Section 05 — Contact channels: Facebook page ID and WhatsApp number.
 */

import { Input } from "@/components/ui/input";
import { IconBrandFacebook, IconBrandWhatsapp } from "@tabler/icons-react";
import { Field, SectionCard } from "./ui-primitives";

interface ChannelsSectionProps {
  facebookPageId:  string;
  whatsappNumber:  string;
  onFacebookChange: (v: string) => void;
  onWhatsappChange: (v: string) => void;
}

export function ChannelsSection({
  facebookPageId, whatsappNumber,
  onFacebookChange, onWhatsappChange,
}: ChannelsSectionProps) {
  return (
    <SectionCard
      step="05"
      icon={<span className="text-sm leading-none">📞</span>}
      title="Canaux de contact"
      accent="none"
    >
      <div className="space-y-5">
        <Field
          label={
            <span className="flex items-center gap-1.5">
              <IconBrandFacebook className="h-3.5 w-3.5 text-[#1877F2]" />
              ID / Lien page Facebook
            </span>
          }
          hint="L'identifiant unique de votre page Facebook."
        >
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground shrink-0 select-none">
              facebook.com/
            </span>
            <Input
              value={facebookPageId}
              onChange={(e) => onFacebookChange(e.target.value)}
              className="h-9 text-sm flex-1"
              placeholder="maboutique"
            />
          </div>
        </Field>

        <Field
          label={
            <span className="flex items-center gap-1.5">
              <IconBrandWhatsapp className="h-3.5 w-3.5 text-emerald-500" />
              Numéro WhatsApp (notifications)
            </span>
          }
          hint="Recevez des alertes pour les messages importants."
        >
          <Input
            value={whatsappNumber}
            onChange={(e) => onWhatsappChange(e.target.value)}
            className="h-9 text-sm"
            placeholder="+261 34 ..."
          />
        </Field>
      </div>
    </SectionCard>
  );
}
