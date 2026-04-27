/**
 * @file features/business-profile/hooks/use-business-profile.ts
 * Manages all form state for the business profile page.
 * Isolates logic from UI so components stay presentational.
 */

"use client";

import { useCallback, useState } from "react";
import { TEMPLATES } from "../data/business-profile.data";
import type {
  BusinessProfileForm,
  BusinessType,
  ResponseStyle,
  Template,
  Tone,
} from "../types/business-profile.types";

/* ─── Default form state ─── */
const DEFAULT_FORM: BusinessProfileForm = {
  name:                "Ma Boutique Mode",
  businessType:        "SHOP",
  description:         "Boutique en ligne vendant des vêtements et accessoires avec livraison à Antananarivo.",
  tone:                "FRIENDLY",
  responseStyle:       "SHORT",
  autoReply:           true,
  aiInstructions:
    "Tu es l'assistant de Ma Boutique Mode. Réponds en français ou malagasy.\nToujours proposer la livraison. Ne donne pas de remise sans accord humain.\nSois chaleureux et concis.",
  commentInstructions:
    "Pour chaque commentaire, réponds avec enthousiasme, mentionne la disponibilité et invite à écrire en MP pour commander.",
  facebookPageId:      "maboutiquemode",
  whatsappNumber:      "+261 34 00 000 00",
};

/* ─── Hook return type ─── */
export interface UseBusinessProfileResult {
  form: BusinessProfileForm;
  saved: boolean;
  showTemplates: boolean;
  templates: Template[];
  /* field setters */
  setName:                (v: string) => void;
  setBusinessType:        (v: BusinessType) => void;
  setDescription:         (v: string) => void;
  setTone:                (v: Tone) => void;
  setResponseStyle:       (v: ResponseStyle) => void;
  setAutoReply:           (v: boolean) => void;
  setAIInstructions:      (v: string) => void;
  setCommentInstructions: (v: string) => void;
  setFacebookPageId:      (v: string) => void;
  setWhatsappNumber:      (v: string) => void;
  /* actions */
  applyTemplate:     (tpl: Template) => void;
  handleSave:        () => void;
  toggleTemplates:   () => void;
  closeTemplates:    () => void;
}

export function useBusinessProfile(): UseBusinessProfileResult {
  const [form, setForm]             = useState<BusinessProfileForm>(DEFAULT_FORM);
  const [saved, setSaved]           = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  /* ── Generic field setter helper ── */
  function setField<K extends keyof BusinessProfileForm>(
    key: K,
    value: BusinessProfileForm[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  /* ── Apply template (overwrites relevant fields, keeps channels) ── */
  const applyTemplate = useCallback((tpl: Template) => {
    setForm((prev) => ({
      ...prev,
      name:                tpl.name,
      businessType:        tpl.businessType,
      description:         tpl.description,
      tone:                tpl.tone,
      responseStyle:       tpl.responseStyle,
      aiInstructions:      tpl.aiInstructions,
      commentInstructions: tpl.commentInstructions,
    }));
    setShowTemplates(false);
  }, []);

  /* ── Save with 2.5 s feedback ── */
  const handleSave = useCallback(() => {
    // TODO: call API service here
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }, []);

  return {
    form,
    saved,
    showTemplates,
    templates: TEMPLATES,
    /* individual setters */
    setName:                (v) => setField("name", v),
    setBusinessType:        (v) => setField("businessType", v),
    setDescription:         (v) => setField("description", v),
    setTone:                (v) => setField("tone", v),
    setResponseStyle:       (v) => setField("responseStyle", v),
    setAutoReply:           (v) => setField("autoReply", v),
    setAIInstructions:      (v) => setField("aiInstructions", v),
    setCommentInstructions: (v) => setField("commentInstructions", v),
    setFacebookPageId:      (v) => setField("facebookPageId", v),
    setWhatsappNumber:      (v) => setField("whatsappNumber", v),
    /* actions */
    applyTemplate,
    handleSave,
    toggleTemplates: () => setShowTemplates((v) => !v),
    closeTemplates:  () => setShowTemplates(false),
  };
}
