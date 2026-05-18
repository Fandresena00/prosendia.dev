"use client";
/**
 * @file features/posts-comments/components/post-config-panel.tsx
 * AI configuration panel for a selected post.
 * Shows a warning when the 10-post autoReply limit is reached.
 */

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  IconAlertTriangle,
  IconBrandFacebook,
  IconDeviceFloppy,
  IconMessageForward,
  IconRobot,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import type { ApiPostAiConfig, PostAiConfigForm } from "../types/posts-comments.types";

interface PostConfigPanelProps {
  config:               ApiPostAiConfig | null;
  loading:              boolean;
  saving:               boolean;
  error:                string | null;
  autoReplyCount:       number;
  autoReplyLimitReached: boolean;
  onSave:               (form: Partial<PostAiConfigForm>) => void;
}

const MAX_AUTO_REPLY = 10;

export function PostConfigPanel({
  config,
  loading,
  saving,
  error,
  autoReplyCount,
  autoReplyLimitReached,
  onSave,
}: PostConfigPanelProps) {
  const [form, setForm] = useState<PostAiConfigForm>({
    autoReply:           false,
    privateReplyEnabled: false,
    privateReplyMessage: "",
    customInstructions:  "",
    replyLanguage:       "",
    maxReplyTokens:      120,
  });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!config) return;
    setForm({
      autoReply:           config.autoReply,
      privateReplyEnabled: config.privateReplyEnabled,
      privateReplyMessage: config.privateReplyMessage ?? "",
      customInstructions:  config.customInstructions  ?? "",
      replyLanguage:       config.replyLanguage        ?? "",
      maxReplyTokens:      config.maxReplyTokens       ?? 120,
    });
    setDirty(false);
  }, [config]);

  const set = <K extends keyof PostAiConfigForm>(k: K, v: PostAiConfigForm[K]) => {
    setForm((p) => ({ ...p, [k]: v }));
    setDirty(true);
  };

  const isAutoReplyBlocked =
    autoReplyLimitReached && !form.autoReply; // limit reached AND this post doesn't have it yet

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="px-6 py-5 space-y-6">

        {/* Auto-reply limit banner */}
        {autoReplyLimitReached && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/8 px-3.5 py-3">
            <IconAlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-700">
                Limite atteinte ({autoReplyCount}/{MAX_AUTO_REPLY})
              </p>
              <p className="text-[10px] text-amber-600/80 mt-0.5">
                Vous avez atteint la limite de {MAX_AUTO_REPLY} posts avec réponse automatique.
                Désactivez l'IA sur un autre post pour l'activer ici.
              </p>
            </div>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/8 px-3.5 py-3">
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}

        {/* Automation toggles */}
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Automatisation
          </p>

          {/* Auto-reply toggle */}
          <div className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-colors ${
            form.autoReply
              ? "border-emerald-500/25 bg-emerald-500/5"
              : "border-border/40 bg-secondary/20"
          }`}>
            <div className="flex items-center gap-2.5">
              <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${
                form.autoReply ? "bg-emerald-500/15" : "bg-secondary"
              }`}>
                <IconRobot className={`h-3.5 w-3.5 ${
                  form.autoReply ? "text-emerald-600" : "text-muted-foreground"
                }`} />
              </div>
              <div>
                <p className="text-xs font-semibold">Réponses IA aux commentaires</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {isAutoReplyBlocked
                    ? `Limite atteinte (${autoReplyCount}/${MAX_AUTO_REPLY})`
                    : "Filtre et répond automatiquement aux commentaires utiles"}
                </p>
              </div>
            </div>
            <Switch
              checked={form.autoReply}
              disabled={isAutoReplyBlocked}
              onCheckedChange={(v) => set("autoReply", v)}
            />
          </div>

          {/* Private reply toggle */}
          <div className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-colors ${
            form.privateReplyEnabled
              ? "border-[#1877F2]/25 bg-[#1877F2]/5"
              : "border-border/40 bg-secondary/20"
          }`}>
            <div className="flex items-center gap-2.5">
              <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${
                form.privateReplyEnabled ? "bg-[#1877F2]/10" : "bg-secondary"
              }`}>
                <IconMessageForward className={`h-3.5 w-3.5 ${
                  form.privateReplyEnabled ? "text-[#1877F2]" : "text-muted-foreground"
                }`} />
              </div>
              <div>
                <p className="text-xs font-semibold">Réponse privée automatique (DM)</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Envoie aussi un DM privé en réponse au commentaire
                </p>
              </div>
            </div>
            <Switch
              checked={form.privateReplyEnabled}
              onCheckedChange={(v) => set("privateReplyEnabled", v)}
            />
          </div>

          {form.privateReplyEnabled && (
            <div className="pl-1 space-y-1.5">
              <p className="text-[10px] text-muted-foreground bg-[#1877F2]/5 border border-[#1877F2]/15 rounded-lg px-3 py-2 flex items-start gap-2">
                <IconBrandFacebook className="h-3.5 w-3.5 text-[#1877F2] shrink-0 mt-0.5" />
                Facebook autorise l&apos;envoi d&apos;un DM en réponse directe à un commentaire.
              </p>
              <Label className="text-[11px] text-muted-foreground">
                Message DM fixe (laissez vide pour génération IA)
              </Label>
              <Textarea
                value={form.privateReplyMessage}
                onChange={(e) => set("privateReplyMessage", e.target.value)}
                rows={2}
                placeholder="Laissez vide pour que l'IA génère le message…"
                className="text-xs resize-none bg-secondary/20"
              />
            </div>
          )}
        </div>

        <Separator className="bg-border/40" />

        {/* Custom instructions */}
        <div className="space-y-2">
          <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Instructions spécifiques à ce post
          </Label>
          <Textarea
            value={form.customInstructions}
            onChange={(e) => set("customInstructions", e.target.value)}
            rows={3}
            className="text-xs resize-none bg-secondary/20"
            placeholder="Ex: Ce post concerne notre promotion -20%. Toujours mentionner la date limite."
          />
          <p className="text-[10px] text-muted-foreground">
            S&apos;ajoutent au prompt global pour contextualiser les réponses à ce post.
          </p>
        </div>

        {/* Save button */}
        {dirty && (
          <Button
            className="w-full h-9 gap-2 text-sm"
            onClick={() => onSave(form)}
            disabled={saving}
          >
            {saving ? (
              <>
                <div className="h-3.5 w-3.5 rounded-full border-2 border-transparent border-t-current animate-spin" />
                Enregistrement…
              </>
            ) : (
              <>
                <IconDeviceFloppy className="h-3.5 w-3.5" />
                Enregistrer
              </>
            )}
          </Button>
        )}
      </div>
    </ScrollArea>
  );
}
