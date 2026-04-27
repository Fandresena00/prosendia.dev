/**
 * @file features/business-profile/pages/business-profile.page.tsx
 *
 * Root page component for the Business Profile feature.
 * Thin orchestrator: wires useBusinessProfile hook into section components.
 * No business logic lives here — it all lives in the hook.
 */

"use client";

import { Button } from "@/components/ui/button";
import { IconCheck, IconSparkles } from "@tabler/icons-react";
import { BehaviorSection } from "../components/behavior-section";
import { ChannelsSection } from "../components/channels-section";
import { IdentitySection } from "../components/identity-section";
import {
  CommentInstructionsSection,
  MessageInstructionsSection,
} from "../components/instructions-section";
import { ProfileSummarySection } from "../components/profile-summary-section";
import { SaveFooter } from "../components/save-footer";
import { TemplatePicker } from "../components/template-picker";
import { useBusinessProfile } from "../hooks/use-business-profile";

export function BusinessProfilePage() {
  const bp = useBusinessProfile();

  return (
    <div className="p-6 lg:p-8 space-y-8 ">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Profil Business</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configurez comment votre assistant IA parle à vos clients Facebook
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2"
            onClick={bp.toggleTemplates}
          >
            <IconSparkles className="h-3.5 w-3.5 text-primary" />
            Exemples
          </Button>

          <Button
            size="sm"
            className="h-9 gap-2"
            style={{ boxShadow: "0 0 12px oklch(0.52 0.24 256 / 22%)" }}
            onClick={bp.handleSave}
          >
            <IconCheck className="h-3.5 w-3.5" />
            {bp.saved ? "Sauvegardé !" : "Sauvegarder"}
          </Button>
        </div>
      </div>

      {/* ── Template picker (collapsible) ── */}
      {bp.showTemplates && (
        <TemplatePicker
          templates={bp.templates}
          onApply={bp.applyTemplate}
          onClose={bp.closeTemplates}
        />
      )}

      {/* ── Main 2-column grid ── */}
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

        <ChannelsSection
          facebookPageId={bp.form.facebookPageId}
          whatsappNumber={bp.form.whatsappNumber}
          onFacebookChange={bp.setFacebookPageId}
          onWhatsappChange={bp.setWhatsappNumber}
        />

        <ProfileSummarySection form={bp.form} />
      </div>

      {/* ── Save footer ── */}
      <SaveFooter saved={bp.saved} onSave={bp.handleSave} />
    </div>
  );
}
