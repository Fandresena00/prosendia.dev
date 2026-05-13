"use client";
/**
 * @file features/business-profile/hooks/use-business-profile.ts
 *
 * FIXES (same pattern as use-facebook-pages.ts)
 * ──────────────────────────────────────────────
 * 1. API calls only fire when `status === "authenticated"`
 * 2. AuthenticationError caught gracefully — no unhandled rejection crash
 * 3. State cleared on logout (unauthenticated status)
 */

import { AuthenticationError, NetworkError } from "@/lib/errors";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  fetchProfile,
  fetchProfiles,
  updateProfile,
} from "../services/business-profile.service";
import { TEMPLATES } from "../data/business-profile.data";
import type {
  BusinessProfileForm,
  BusinessProfileResponseDto,
  BusinessProfileSummaryDto,
  BusinessType,
  ReferencePresetDto,
  ResponseStyle,
  Template,
  Tone,
} from "../types/business-profile.types";

function buildFacebookPageAvatarUrl(pageId: string | null): string | null {
  if (!pageId) return null;
  return `https://graph.facebook.com/${encodeURIComponent(pageId)}/picture?type=large&width=96&height=96`;
}

// ─── Save state ───────────────────────────────────────────────────────────────

export type SaveState = "idle" | "saving" | "saved" | "error";

// ─── Default form ─────────────────────────────────────────────────────────────

const EMPTY_FORM: BusinessProfileForm = {
  name:                "",
  businessType:        "OTHER",
  description:         "",
  tone:                "FRIENDLY",
  responseStyle:       "MIXED",
  autoReply:           false,
  aiInstructions:      "",
  commentInstructions: "",
  facebookPageId:      "",
};

// ─── Map API → form ───────────────────────────────────────────────────────────

function apiToForm(data: BusinessProfileResponseDto): BusinessProfileForm {
  return {
    name:                data.name,
    businessType:        data.businessType as BusinessType,
    description:         data.description       ?? "",
    tone:               (data.tone              as Tone)          ?? "FRIENDLY",
    responseStyle:      (data.responseStyle     as ResponseStyle) ?? "MIXED",
    autoReply:           data.autoReply,
    aiInstructions:      data.aiInstructions    ?? "",
    commentInstructions: data.commentInstructions ?? "",
    facebookPageId:      data.facebookPageId    ?? "",
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBusinessProfile() {
  const authStatus    = useAuthStore((s) => s.status);
  const handleAuthErr = useAuthStore((s) => s.handleAuthError);

  const [profiles,        setProfiles]        = useState<BusinessProfileSummaryDto[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [form,            setForm]            = useState<BusinessProfileForm>(EMPTY_FORM);
  const [referencePresets, setReferencePresets] = useState<ReferencePresetDto[]>([]);
  const [loadingProfile,  setLoadingProfile]  = useState(false);
  const [showTemplates,   setShowTemplates]   = useState(false);
  const [saveState,       setSaveState]       = useState<SaveState>("idle");

  // ── FIX: Load profiles only when authenticated ─────────────────────────────

  useEffect(() => {
    if (authStatus !== "authenticated") {
      // Clear on logout
      if (authStatus === "unauthenticated") {
        setProfiles([]);
        setActiveProfileId(null);
        setForm(EMPTY_FORM);
        setReferencePresets([]);
      }
      return;
    }

    setLoadingProfiles(true);
    fetchProfiles()
      .then((list) => {
        setProfiles(
          list.map((profile) => ({
            ...profile,
            facebookPageAvatarUrl: buildFacebookPageAvatarUrl(
              profile.facebookPageId,
            ),
          })),
        );
        if (list.length > 0) setActiveProfileId(list[0].id);
      })
      .catch((error) => {
        // FIX: Catch AuthenticationError gracefully
        if (error instanceof AuthenticationError) { handleAuthErr(error); return; }
        if (error instanceof NetworkError) return;
        toast.error("Impossible de charger les profils.");
      })
      .finally(() => setLoadingProfiles(false));
  }, [authStatus, handleAuthErr]);

  // ── Load full profile when active profile changes ──────────────────────────

  useEffect(() => {
    if (!activeProfileId || authStatus !== "authenticated") return;
    setLoadingProfile(true);

    fetchProfile(activeProfileId)
      .then((data) => {
        setForm(apiToForm(data));
        setReferencePresets(data.referencePresets);
      })
      .catch((error) => {
        if (error instanceof AuthenticationError) { handleAuthErr(error); return; }
        if (error instanceof NetworkError) return;
        toast.error("Impossible de charger le profil.");
      })
      .finally(() => setLoadingProfile(false));
  }, [activeProfileId, authStatus, handleAuthErr]);

  // ── Template list = hardcoded + saved profiles ─────────────────────────────

  const allTemplates: Template[] = [
    ...TEMPLATES,
    ...profiles
      .filter((p) => p.id !== activeProfileId)
      .map((p): Template => ({
        label:        `📋 ${p.name}`,
        profileId:    p.id,
        isUserSaved:  true,
        name:         p.name,
        businessType: p.businessType as BusinessType,
        description:  "",
        tone:         "FRIENDLY",
        responseStyle: "MIXED",
        autoReply:    p.autoReply,
        aiInstructions:      "",
        commentInstructions: "",
      })),
  ];

  // ── Apply template ─────────────────────────────────────────────────────────

  const applyTemplate = useCallback(
    async (tpl: Template) => {
      if (tpl.isUserSaved && tpl.profileId) {
        try {
          const data = await fetchProfile(tpl.profileId);
          setForm((prev) => ({
            ...prev,
            name:                data.name,
            businessType:        data.businessType as BusinessType,
            description:         data.description       ?? prev.description,
            tone:               (data.tone as Tone)     ?? prev.tone,
            responseStyle:      (data.responseStyle as ResponseStyle) ?? prev.responseStyle,
            autoReply:           data.autoReply,
            aiInstructions:      data.aiInstructions    ?? prev.aiInstructions,
            commentInstructions: data.commentInstructions ?? prev.commentInstructions,
          }));
        } catch (error) {
          if (error instanceof AuthenticationError) { handleAuthErr(error); return; }
          toast.error("Impossible de charger ce profil.");
        }
      } else {
        setForm((prev) => ({
          ...prev,
          name:                tpl.name,
          businessType:        tpl.businessType,
          description:         tpl.description,
          tone:                tpl.tone,
          responseStyle:       tpl.responseStyle,
          autoReply:           tpl.autoReply,
          aiInstructions:      tpl.aiInstructions,
          commentInstructions: tpl.commentInstructions,
        }));
      }
      setShowTemplates(false);
    },
    [handleAuthErr],
  );

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!activeProfileId || saveState === "saving") return;
    setSaveState("saving");
    try {
      const updated = await updateProfile(activeProfileId, {
        name:                form.name,
        businessType:        form.businessType,
        description:         form.description,
        tone:                form.tone,
        responseStyle:       form.responseStyle,
        autoReply:           form.autoReply,
        aiInstructions:      form.aiInstructions,
        commentInstructions: form.commentInstructions,
      });
      setForm(apiToForm(updated));
      setReferencePresets(updated.referencePresets);
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === activeProfileId
            ? { ...p, name: updated.name, autoReply: updated.autoReply }
            : p,
        ),
      );
      setSaveState("saved");
      toast.success("Profil sauvegardé !", {
        description: "L'IA utilise maintenant cette configuration.",
        duration: 3000,
      });
      setTimeout(() => setSaveState("idle"), 2500);
    } catch (error) {
      if (error instanceof AuthenticationError) { handleAuthErr(error); return; }
      setSaveState("error");
      toast.error("Échec de la sauvegarde. Veuillez réessayer.");
      setTimeout(() => setSaveState("idle"), 2000);
    }
  }, [activeProfileId, saveState, form, handleAuthErr]);

  // ── Field setters ──────────────────────────────────────────────────────────

  function setField<K extends keyof BusinessProfileForm>(k: K, v: BusinessProfileForm[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  const switchProfile = useCallback((profileId: string) => {
    if (profileId === activeProfileId) return;
    setActiveProfileId(profileId);
    setShowTemplates(false);
  }, [activeProfileId]);

  return {
    profiles,
    activeProfileId,
    switchProfile,
    loadingProfiles,
    loadingProfile,
    form,
    referencePresets,
    showTemplates,
    allTemplates,
    toggleTemplates:  () => setShowTemplates((v) => !v),
    closeTemplates:   () => setShowTemplates(false),
    applyTemplate,
    saveState,
    handleSave,
    setName:                (v: string)        => setField("name", v),
    setBusinessType:        (v: BusinessType)  => setField("businessType", v),
    setDescription:         (v: string)        => setField("description", v),
    setTone:                (v: Tone)          => setField("tone", v),
    setResponseStyle:       (v: ResponseStyle) => setField("responseStyle", v),
    setAutoReply:           (v: boolean)       => setField("autoReply", v),
    setAIInstructions:      (v: string)        => setField("aiInstructions", v),
    setCommentInstructions: (v: string)        => setField("commentInstructions", v),
    setFacebookPageId:      (v: string)        => setField("facebookPageId", v),
  };
}
