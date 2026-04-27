/**
 * @file features/business-profile/components/instructions-section.tsx
 * Section 03 — AI instructions for private messages.
 * Section 04 — AI instructions for post comments.
 */

import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { IconBrandFacebook, IconRobot } from "@tabler/icons-react";
import { InfoNote, SectionCard } from "./ui-primitives";

/* ─── Section 03: Messages ─── */
interface MessageInstructionsSectionProps {
  value:    string;
  onChange: (v: string) => void;
}

export function MessageInstructionsSection({
  value, onChange,
}: MessageInstructionsSectionProps) {
  return (
    <SectionCard
      step="03"
      icon={<IconRobot className="h-4 w-4 text-sky-500" />}
      title="Instructions IA — Messages"
      accent="sky"
      badge={
        <Badge variant="default" className="text-[10px] h-5 px-1.5">
          Important
        </Badge>
      }
      subtitle="Utilisées pour répondre aux messages privés Facebook."
    >
      <div className="space-y-3">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={7}
          className="text-sm resize-none font-mono text-xs leading-relaxed"
          placeholder="Tu es l'assistant de [nom]. Réponds en français..."
        />
        <InfoNote>
          Ces instructions guident l&apos;IA sur comment répondre aux messages
          privés. Soyez précis sur le ton, la langue et les comportements
          souhaités.
        </InfoNote>
      </div>
    </SectionCard>
  );
}

/* ─── Section 04: Comments ─── */
interface CommentInstructionsSectionProps {
  value:    string;
  onChange: (v: string) => void;
}

export function CommentInstructionsSection({
  value, onChange,
}: CommentInstructionsSectionProps) {
  return (
    <SectionCard
      step="04"
      icon={<IconBrandFacebook className="h-4 w-4 text-[#1877F2]" />}
      title="Instructions IA — Commentaires"
      accent="facebook"
      subtitle="Utilisées pour répondre aux commentaires des posts."
    >
      <div className="space-y-3">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={7}
          className="text-sm resize-none font-mono text-xs leading-relaxed"
          placeholder="Pour chaque commentaire, réponds avec..."
        />
        <InfoNote>
          Ces instructions s&apos;appliquent aux commentaires publics sur vos
          publications. Indiquez si l&apos;IA doit inviter en MP, mentionner
          des produits, etc.
        </InfoNote>
      </div>
    </SectionCard>
  );
}
