"use client";

/**
 * @file features/business-profile/pages/business-profile.page.tsx
 *
 * CHANGES:
 *  - Connected to the backend API via useBusinessProfile hook
 *  - ProfileSwitcher added in the header (switch between Facebook pages)
 *  - WhatsApp removed from ChannelsSection
 *  - Multi-step save animation via saveState
 *  - Loading skeleton while profile loads
 *  - Reference images shown in profile summary (used by AI to send images)
 */

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { IconCheck, IconLoader2, IconSparkles } from "@tabler/icons-react";
import Link from "next/link";
import { BehaviorSection } from "../components/behavior-section";
import { ChannelsSection } from "../components/channels-section";
import { IdentitySection } from "../components/identity-section";
import {
  CommentInstructionsSection,
  MessageInstructionsSection,
} from "../components/instructions-section";
import { ProfileSummarySection } from "../components/profile-summary-section";
import { ProfileSwitcher } from "../components/profile-switcher";
import { SaveFooter } from "../components/save-footer";
import { TemplatePicker } from "../components/template-picker";
import { useBusinessProfile } from "../hooks/use-business-profile";

export function BusinessProfilePage() {
  const bp = useBusinessProfile();

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (bp.loadingProfiles) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-80" />
          </div>
          <Skeleton className="h-9 w-52 rounded-xl" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (bp.profiles.length === 0) {
    return (
      <div className="p-6 lg:p-8">
        <Empty className="min-h-[60vh] border">
          <EmptyHeader>
            <EmptyTitle>Aucune page Facebook connectee</EmptyTitle>
            <EmptyDescription>
              Le profil business depend d&apos;une page Facebook. Connectez une page pour commencer la configuration.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href="/facebook-page">Connecter une page Facebook</Link>
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-8">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Profil Business</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configurez comment votre assistant IA parle à vos clients Facebook
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {/* Profile switcher — one profile per connected Facebook page */}
          <ProfileSwitcher
            profiles={bp.profiles}
            activeProfileId={bp.activeProfileId}
            loading={bp.loadingProfiles}
            onSwitch={bp.switchProfile}
          />

          {/* Template examples button */}
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2"
            onClick={bp.toggleTemplates}
          >
            <IconSparkles className="h-3.5 w-3.5 text-primary" />
            Exemples
          </Button>

          {/* Quick save button */}
          <Button
            size="sm"
            className="h-9 gap-2 min-w-[120px] transition-all duration-300"
            style={
              bp.saveState === "idle"
                ? { boxShadow: "0 0 12px oklch(0.52 0.24 256 / 22%)" }
                : bp.saveState === "saved"
                  ? { boxShadow: "0 0 12px oklch(0.65 0.2 150 / 30%)", backgroundColor: "oklch(0.65 0.2 150)" }
                  : undefined
            }
            onClick={bp.handleSave}
            disabled={bp.saveState === "saving"}
          >
            {bp.saveState === "saving" && <IconLoader2 className="h-3.5 w-3.5 animate-spin" />}
            {bp.saveState === "saved"  && <IconCheck   className="h-3.5 w-3.5" />}
            {bp.saveState === "idle"   && <IconCheck   className="h-3.5 w-3.5" />}
            {bp.saveState === "error"  && <IconCheck   className="h-3.5 w-3.5" />}
            {bp.saveState === "saving" ? "Sauvegarde…"
              : bp.saveState === "saved" ? "Sauvegardé !"
              : "Sauvegarder"}
          </Button>
        </div>
      </div>

      {/* ── Template picker ── */}
      {bp.showTemplates && (
        <TemplatePicker
          templates={bp.allTemplates}
          onApply={bp.applyTemplate}
          onClose={bp.closeTemplates}
        />
      )}

      {/* ── Profile loading overlay ── */}
      {bp.loadingProfile ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      ) : (
        /* ── Main 2-column grid ── */
        <div className="grid gap-6 lg:grid-cols-2">
          <IdentitySection
            name={bp.form.name}
            businessType={bp.form.businessType}
            description={bp.form.description}
            onNameChange={bp.setName}
            onBusinessTypeChange={bp.setBusinessType}
            onDescriptionChange={bp.setDescription}
          />

          <BehaviorSection
            tone={bp.form.tone}
            responseStyle={bp.form.responseStyle}
            autoReply={bp.form.autoReply}
            onToneChange={bp.setTone}
            onResponseStyleChange={bp.setResponseStyle}
            onAutoReplyChange={bp.setAutoReply}
          />

          <MessageInstructionsSection
            value={bp.form.aiInstructions}
            onChange={bp.setAIInstructions}
          />

          <CommentInstructionsSection
            value={bp.form.commentInstructions}
            onChange={bp.setCommentInstructions}
          />

          {/* Facebook channel — WhatsApp removed */}
          <ChannelsSection
            facebookPageId={bp.form.facebookPageId}
            onFacebookChange={bp.setFacebookPageId}
          />

          <ProfileSummarySection
            form={bp.form}
            referencePresets={bp.referencePresets}
          />
        </div>
      )}

      {/* ── Save footer with multi-step animation ── */}
      <SaveFooter saveState={bp.saveState} onSave={bp.handleSave} />
    </div>
  );
}
