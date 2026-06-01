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
import {
  IconCheck,
  IconLoader2,
  IconSettings,
  IconSparkles,
} from "@tabler/icons-react";
import { Bot, Database, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { BehaviorSection } from "../components/behavior-section";
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
              Le profil business depend d&apos;une page Facebook. Connectez une
              page pour commencer la configuration.
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
    <div className="min-h-full bg-background p-4 sm:p-6 lg:p-8">
      {/* ── Header ── */}
      <div className="mb-6 rounded-xl border border-border/50 bg-card/80 p-5 shadow-sm lg:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/45 bg-secondary/35">
                <IconSettings className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">
                  Profil Business
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Paramétrez l’identité, le ton et les règles de réponse de
                  votre assistant.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <StatusPill
                icon={<Bot className="h-3.5 w-3.5" />}
                label="Assistant IA"
                value={
                  bp.form.autoReply ? "Auto-reply actif" : "Validation manuelle"
                }
              />
              <StatusPill
                icon={<ShieldCheck className="h-3.5 w-3.5" />}
                label="Canal"
                value="Facebook connecté"
              />
              <StatusPill
                icon={<Database className="h-3.5 w-3.5" />}
                label="Configuration"
                value={bp.saveState === "saved" ? "À jour" : "Modifiable"}
              />
            </div>
          </div>

          <div className="flex w-full flex-col gap-2.5 xl:w-[420px]">
            <ProfileSwitcher
              profiles={bp.profiles}
              activeProfileId={bp.activeProfileId}
              loading={bp.loadingProfiles}
              onSwitch={bp.switchProfile}
            />

            <div className="flex gap-2.5">
              <Button
                variant="outline"
                size="sm"
                className="h-9 flex-1 gap-2 rounded-lg"
                onClick={bp.toggleTemplates}
              >
                <IconSparkles className="h-3.5 w-3.5 text-primary" />
                Exemples
              </Button>

              <Button
                size="sm"
                className="h-9 flex-1 gap-2 rounded-lg"
                onClick={bp.handleSave}
                disabled={bp.saveState === "saving"}
              >
                {bp.saveState === "saving" && (
                  <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                {bp.saveState !== "saving" && (
                  <IconCheck className="h-3.5 w-3.5" />
                )}
                {bp.saveState === "saving"
                  ? "Sauvegarde…"
                  : bp.saveState === "saved"
                    ? "Sauvegardé"
                    : "Sauvegarder"}
              </Button>
            </div>
          </div>
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
        <div className="grid gap-5 lg:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="grid gap-5 lg:grid-cols-2">
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
          </div>

          <div className="xl:sticky xl:top-6 xl:self-start">
            <ProfileSummarySection
              form={bp.form}
              referencePresets={bp.referencePresets}
            />
          </div>
        </div>
      )}

      {/* ── Save footer with multi-step animation ── */}
      <div className="mt-6">
        <SaveFooter saveState={bp.saveState} onSave={bp.handleSave} />
      </div>
    </div>
  );
}

function StatusPill({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/45 bg-background px-3 py-2">
      <span className="text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-xs font-medium">{value}</p>
      </div>
    </div>
  );
}
