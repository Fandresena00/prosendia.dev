/**
 * @file features/business-profile/components/identity-section.tsx
 * Section 01 — Business identity (name, type, description).
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { IconBuildingStore } from "@tabler/icons-react";
import { BUSINESS_TYPES } from "../data/business-profile.data";
import type { BusinessType } from "../types/business-profile.types";
import { Field, SectionCard } from "./ui-primitives";

interface IdentitySectionProps {
  name:           string;
  businessType:   BusinessType;
  description:    string;
  onNameChange:         (v: string) => void;
  onBusinessTypeChange: (v: BusinessType) => void;
  onDescriptionChange:  (v: string) => void;
}

export function IdentitySection({
  name, businessType, description,
  onNameChange, onBusinessTypeChange, onDescriptionChange,
}: IdentitySectionProps) {
  return (
    <SectionCard
      step="01"
      icon={<IconBuildingStore className="h-4 w-4 text-violet-500" />}
      title="Identité du business"
      accent="violet"
    >
      <div className="space-y-5">
        <Field label="Nom du business" required>
          <Input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            className="h-9 text-sm"
            placeholder="Ma Boutique"
          />
        </Field>

        <Field label="Type d'activité" required>
          <Select
            value={businessType}
            onValueChange={(v) => onBusinessTypeChange(v as BusinessType)}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BUSINESS_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          label="Description"
          hint="Aide l'IA à comprendre votre business."
        >
          <Textarea
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            rows={3}
            className="text-sm resize-none"
            placeholder="Décrivez votre activité…"
          />
        </Field>
      </div>
    </SectionCard>
  );
}
