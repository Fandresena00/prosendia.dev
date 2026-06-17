"use client";
/**
 * @file features/posts-comments/components/post-config-panel.tsx
 *
 * AI configuration panel for a selected post.
 *
 * REDESIGN + NEW FEATURES IN THIS REVISION
 * ─────────────────────────────────────────────────────────────────────────
 * 1. Visual redesign: sections are now distinct cards with icon+title
 *    headers, consistent spacing, and clearer visual hierarchy — replacing
 *    the previous flat stack of toggles and textareas. Matches the
 *    existing Linear/Vercel-inspired design language (OKLCH tokens,
 *    rounded-xl surfaces) already used elsewhere in the app.
 * 2. "✨ Suggestion IA" button on both privateReplyMessage and
 *    customInstructions — calls generateSuggestion(field, currentValue)
 *    from the hook, which consumes credits like any other AI call, and
 *    inserts the result into the textarea for the user to review/edit
 *    before saving (never auto-saves).
 * 3. NEW — "Répondre à tous les commentaires" toggle (replyToAllComments):
 *    bypasses the spam filter entirely for this post. Includes an inline
 *    warning that AI replies still consume credits per comment, so users
 *    don't enable it carelessly on high-traffic posts.
 * 4. NEW — Keyword rules editor: a flexible, NON-AI way to handle
 *    deterministic instructions ("reply 'test' to any comment containing
 *    'test'") instantly and for free (0 credits), or to mark certain
 *    keywords as always worth an AI reply (bypassing the spam filter
 *    without dictating exact wording). This directly answers "suivre les
 *    instructions à la lettre... sans utiliser abusivement l'IA".
 * 5. Instructions content is now rendered in readable prose blocks with
 *    clear labels instead of being visually identical to free-form input —
 *    easier to scan what's currently configured at a glance.
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  IconAlertTriangle,
  IconBolt,
  IconBrandFacebook,
  IconDeviceFloppy,
  IconMessageForward,
  IconPlus,
  IconRobot,
  IconSparkles,
  IconTrash,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import type {
  ApiPostAiConfig,
  KeywordRule,
  PostAiConfigForm,
} from "../types/posts-comments.types";

interface PostConfigPanelProps {
  config:               ApiPostAiConfig | null;
  loading:              boolean;
  saving:               boolean;
  error:                string | null;
  autoReplyCount:       number;
  autoReplyLimitReached: boolean;
  /** True while an AI suggestion is being generated for this field. */
  suggestingField?:     "privateReplyMessage" | "customInstructions" | null;
  onSave:               (form: Partial<PostAiConfigForm>) => void;
  /** Calls the AI suggestion endpoint; returns the suggested text or null on failure. */
  onSuggest?:           (
    field: "privateReplyMessage" | "customInstructions",
    currentValue: string,
  ) => Promise<string | null>;
}

const MAX_AUTO_REPLY = 10;

function emptyRule(): KeywordRule {
  return {
    id: `rule_${Math.random().toString(36).slice(2, 9)}`,
    keyword: "",
    matchType: "contains",
    replyText: "",
    sendPrivateReply: false,
    privateReplyText: "",
  };
}

export function PostConfigPanel({
  config,
  loading,
  saving,
  error,
  autoReplyCount,
  autoReplyLimitReached,
  suggestingField = null,
  onSave,
  onSuggest,
}: PostConfigPanelProps) {
  const [form, setForm] = useState<PostAiConfigForm>({
    autoReply:           false,
    privateReplyEnabled: false,
    privateReplyMessage: "",
    customInstructions:  "",
    replyLanguage:       "",
    maxReplyTokens:      120,
    replyToAllComments:  false,
    keywordRules:        [],
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
      replyToAllComments:  config.replyToAllComments   ?? false,
      keywordRules:        config.keywordRules ?? [],
    });
    setDirty(false);
  }, [config]);

  const set = <K extends keyof PostAiConfigForm>(k: K, v: PostAiConfigForm[K]) => {
    setForm((p) => ({ ...p, [k]: v }));
    setDirty(true);
  };

  const setRule = (id: string, patch: Partial<KeywordRule>) => {
    set(
      "keywordRules",
      form.keywordRules.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
  };

  const removeRule = (id: string) => {
    set("keywordRules", form.keywordRules.filter((r) => r.id !== id));
  };

  const addRule = () => {
    set("keywordRules", [...form.keywordRules, emptyRule()]);
  };

  const handleSuggest = async (field: "privateReplyMessage" | "customInstructions") => {
    if (!onSuggest) return;
    const suggestion = await onSuggest(field, form[field]);
    if (suggestion) set(field, suggestion);
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
      <div className="px-5 py-5 space-y-5">

        {/* Auto-reply limit banner */}
        {autoReplyLimitReached && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/8 px-3.5 py-3">
            <IconAlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-700">
                Limite atteinte ({autoReplyCount}/{MAX_AUTO_REPLY})
              </p>
              <p className="text-[10px] text-amber-600/80 mt-0.5 leading-relaxed">
                Vous avez atteint la limite de {MAX_AUTO_REPLY} posts avec réponse automatique.
                Désactivez l&apos;IA sur un autre post pour l&apos;activer ici.
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

        {/* ── Section: Automation ──────────────────────────────────────── */}
        <ConfigSection title="Automatisation">
          <ToggleRow
            icon={<IconRobot className="h-3.5 w-3.5" />}
            active={form.autoReply}
            activeColorClass="border-emerald-500/25 bg-emerald-500/5"
            iconActiveClass="bg-emerald-500/15 text-emerald-600"
            title="Réponses IA aux commentaires"
            description={
              isAutoReplyBlocked
                ? `Limite atteinte (${autoReplyCount}/${MAX_AUTO_REPLY})`
                : "Filtre et répond automatiquement aux commentaires utiles"
            }
            checked={form.autoReply}
            disabled={isAutoReplyBlocked}
            onCheckedChange={(v) => set("autoReply", v)}
          />

          <ToggleRow
            icon={<IconMessageForward className="h-3.5 w-3.5" />}
            active={form.privateReplyEnabled}
            activeColorClass="border-[#1877F2]/25 bg-[#1877F2]/5"
            iconActiveClass="bg-[#1877F2]/10 text-[#1877F2]"
            title="Réponse privée automatique (DM)"
            description="Envoie aussi un DM privé en réponse au commentaire"
            checked={form.privateReplyEnabled}
            onCheckedChange={(v) => set("privateReplyEnabled", v)}
          />

          {form.privateReplyEnabled && (
            <div className="pl-1 space-y-2 pt-1">
              <p className="text-[10px] text-muted-foreground bg-[#1877F2]/5 border border-[#1877F2]/15 rounded-lg px-3 py-2 flex items-start gap-2 leading-relaxed">
                <IconBrandFacebook className="h-3.5 w-3.5 text-[#1877F2] shrink-0 mt-0.5" />
                Facebook autorise l&apos;envoi d&apos;un DM en réponse directe à un commentaire.
              </p>
              <FieldWithSuggestion
                label="Message DM fixe (laissez vide pour génération IA)"
                value={form.privateReplyMessage}
                onChange={(v) => set("privateReplyMessage", v)}
                placeholder="Laissez vide pour que l'IA génère le message…"
                rows={2}
                suggesting={suggestingField === "privateReplyMessage"}
                onSuggest={onSuggest ? () => handleSuggest("privateReplyMessage") : undefined}
              />
            </div>
          )}
        </ConfigSection>

        <Separator className="bg-border/40" />

        {/* ── Section: Flexible reply rules (non-AI) ───────────────────── */}
        <ConfigSection
          title="Règles de réponse flexibles"
          subtitle="Sans IA — instantané et gratuit en crédits"
        >
          <ToggleRow
            icon={<IconBolt className="h-3.5 w-3.5" />}
            active={form.replyToAllComments}
            activeColorClass="border-violet-500/25 bg-violet-500/5"
            iconActiveClass="bg-violet-500/15 text-violet-600"
            title="Répondre à tous les commentaires"
            description="Ignore le filtre anti-spam pour ce post — l'IA répond à chaque commentaire"
            checked={form.replyToAllComments}
            onCheckedChange={(v) => set("replyToAllComments", v)}
          />
          {form.replyToAllComments && (
            <p className="text-[10px] text-amber-600/90 bg-amber-500/8 border border-amber-500/20 rounded-lg px-3 py-2 leading-relaxed flex items-start gap-2">
              <IconAlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              Chaque réponse IA consomme toujours des crédits. À utiliser avec
              prudence sur les posts à fort trafic.
            </p>
          )}

          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-semibold text-muted-foreground">
                Règles par mot-clé
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 rounded-full px-2.5 text-[10px]"
                onClick={addRule}
              >
                <IconPlus className="h-3 w-3" />
                Ajouter
              </Button>
            </div>

            {form.keywordRules.length === 0 ? (
              <p className="text-[10px] text-muted-foreground leading-relaxed bg-secondary/25 rounded-lg px-3 py-2.5">
                Ex: répondre exactement &quot;test&quot; à tout commentaire
                contenant &quot;test&quot;, sans appeler l&apos;IA. Cliquez sur
                &quot;Ajouter&quot; pour créer une règle.
              </p>
            ) : (
              <div className="space-y-2">
                {form.keywordRules.map((rule) => (
                  <KeywordRuleEditor
                    key={rule.id}
                    rule={rule}
                    onChange={(patch) => setRule(rule.id, patch)}
                    onRemove={() => removeRule(rule.id)}
                  />
                ))}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Avec un texte de réponse fixé, la règle s&apos;applique
              instantanément, sans IA, sans crédit. Laissez le texte vide pour
              seulement &quot;forcer&quot; une réponse IA sur ce mot-clé (les
              crédits sont alors utilisés normalement).
            </p>
          </div>
        </ConfigSection>

        <Separator className="bg-border/40" />

        {/* ── Section: Custom instructions ─────────────────────────────── */}
        <ConfigSection title="Instructions spécifiques à ce post">
          <FieldWithSuggestion
            label=""
            value={form.customInstructions}
            onChange={(v) => set("customInstructions", v)}
            placeholder="Ex: Ce post concerne notre promotion -20%. Toujours mentionner la date limite."
            rows={4}
            suggesting={suggestingField === "customInstructions"}
            onSuggest={onSuggest ? () => handleSuggest("customInstructions") : undefined}
          />
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Suivies à la lettre par l&apos;IA pour ce post — prioritaires sur
            les règles générales. S&apos;appliquent même si le post n&apos;a
            pas de légende.
          </p>
        </ConfigSection>

        {/* Save button */}
        {dirty && (
          <Button
            className="w-full h-9 gap-2 text-sm sticky bottom-0"
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

// ─── Sub-components ────────────────────────────────────────────────────────

/** A titled card-like section grouping related config controls. */
function ConfigSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
        {subtitle && (
          <p className="text-[10px] text-muted-foreground/70 mt-0.5">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}

/** A toggle row with icon, title, description — used for the main automation switches. */
function ToggleRow({
  icon,
  active,
  activeColorClass,
  iconActiveClass,
  title,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  icon: React.ReactNode;
  active: boolean;
  activeColorClass: string;
  iconActiveClass: string;
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-colors ${
        active ? activeColorClass : "border-border/40 bg-secondary/20"
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
            active ? iconActiveClass : "bg-secondary text-muted-foreground"
          }`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold">{title}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
            {description}
          </p>
        </div>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  );
}

/** Textarea field with an inline "✨ Suggestion IA" action button. */
function FieldWithSuggestion({
  label,
  value,
  onChange,
  placeholder,
  rows,
  suggesting,
  onSuggest,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  rows: number;
  suggesting: boolean;
  onSuggest?: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        {label ? (
          <Label className="text-[11px] text-muted-foreground">{label}</Label>
        ) : (
          <span />
        )}
        {onSuggest && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 gap-1 rounded-full px-2 text-[10px] text-violet-600 hover:bg-violet-500/10 hover:text-violet-700"
            disabled={suggesting}
            onClick={onSuggest}
          >
            {suggesting ? (
              <div className="h-3 w-3 rounded-full border-2 border-transparent border-t-current animate-spin" />
            ) : (
              <IconSparkles className="h-3 w-3" />
            )}
            Suggestion IA
          </Button>
        )}
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="text-xs resize-none bg-secondary/20 leading-relaxed"
        disabled={suggesting}
      />
    </div>
  );
}

/** Editor row for a single non-AI keyword reply rule. */
function KeywordRuleEditor({
  rule,
  onChange,
  onRemove,
}: {
  rule: KeywordRule;
  onChange: (patch: Partial<KeywordRule>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-secondary/15 p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <Input
          value={rule.keyword}
          onChange={(e) => onChange({ keyword: e.target.value })}
          placeholder="Mot-clé (ex: test)"
          className="h-8 text-xs flex-1"
        />
        <Select
          value={rule.matchType}
          onValueChange={(v) => onChange({ matchType: v as "contains" | "exact" })}
        >
          <SelectTrigger className="h-8 w-[110px] text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="contains" className="text-xs">Contient</SelectItem>
            <SelectItem value="exact" className="text-xs">Exact</SelectItem>
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
          onClick={onRemove}
        >
          <IconTrash className="h-3.5 w-3.5" />
        </Button>
      </div>

      <Textarea
        value={rule.replyText ?? ""}
        onChange={(e) => onChange({ replyText: e.target.value })}
        placeholder="Réponse fixe (laisser vide = forcer une réponse IA sans dicter le texte)"
        rows={2}
        className="text-xs resize-none bg-background"
      />

      <div className="flex items-center justify-between pt-0.5">
        <span className="text-[10px] text-muted-foreground">
          {rule.replyText?.trim()
            ? "Réponse fixe — 0 crédit"
            : "Réponse générée par l'IA — crédits consommés"}
        </span>
        <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
          <Switch
            checked={rule.sendPrivateReply}
            onCheckedChange={(v) => onChange({ sendPrivateReply: v })}
            className="scale-75"
          />
          + DM privé
        </label>
      </div>

      {rule.sendPrivateReply && (
        <Textarea
          value={rule.privateReplyText ?? ""}
          onChange={(e) => onChange({ privateReplyText: e.target.value })}
          placeholder="Message privé fixe pour cette règle (laisser vide = pas de DM)"
          rows={2}
          className="text-xs resize-none bg-background"
        />
      )}
    </div>
  );
}
