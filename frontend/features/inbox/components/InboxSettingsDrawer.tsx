"use client";

/**
 * @file features/inbox/components/InboxSettingsDrawer.tsx
 *
 * UI preferences only — stored in localStorage, instant effect.
 * Business profile settings (AI tone, auto-reply) are managed separately
 * in the Business Profile settings page to avoid duplication.
 */

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { IconSettings } from "@tabler/icons-react";
import { Layout, Volume2, Clock, AlignJustify } from "lucide-react";
import type { InboxUiPrefs } from "../services/inbox.service";

interface InboxSettingsDrawerProps {
  open:            boolean;
  onClose:         () => void;
  uiPrefs:         InboxUiPrefs;
  onUpdateUiPrefs: (partial: Partial<InboxUiPrefs>) => void;
}

export function InboxSettingsDrawer({
  open, onClose, uiPrefs, onUpdateUiPrefs,
}: InboxSettingsDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[300px] p-0 flex flex-col">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/40 shrink-0">
          <SheetTitle className="flex items-center gap-2 text-sm font-semibold">
            <IconSettings className="h-4 w-4 text-primary" />
            Préférences d&apos;affichage
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            Personnalisez l&apos;apparence de l&apos;inbox.
            Les paramètres IA sont dans les réglages du profil.
          </p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

          {/* ── Affichage ── */}
          <section className="space-y-4">
            <SectionTitle icon={<Layout className="h-3.5 w-3.5 text-primary" />} label="Affichage" />

            <SettingRow
              label="Mode compact"
              desc="Réduit la taille des éléments de la liste"
            >
              <Switch
                checked={uiPrefs.compactMode}
                onCheckedChange={(v) => onUpdateUiPrefs({ compactMode: v })}
              />
            </SettingRow>

            <div className="space-y-1.5">
              <p className="text-xs font-medium">Densité du texte</p>
              <Select
                value={uiPrefs.textDensity ?? "normal"}
                onValueChange={(v) =>
                  onUpdateUiPrefs({ textDensity: v as "normal" | "dense" | "spacious" })
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dense"    className="text-xs">Dense</SelectItem>
                  <SelectItem value="normal"   className="text-xs">Normal</SelectItem>
                  <SelectItem value="spacious" className="text-xs">Aéré</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </section>

          <Separator className="bg-border/30" />

          {/* ── Horodatages ── */}
          <section className="space-y-4">
            <SectionTitle icon={<Clock className="h-3.5 w-3.5 text-amber-500" />} label="Horodatages" />

            <SettingRow
              label="Afficher l'heure sur chaque message"
              desc="Montre l'horodatage sous chaque bulle"
            >
              <Switch
                checked={uiPrefs.showTimestamps}
                onCheckedChange={(v) => onUpdateUiPrefs({ showTimestamps: v })}
              />
            </SettingRow>
          </section>

          <Separator className="bg-border/30" />

          {/* ── Messages ── */}
          <section className="space-y-4">
            <SectionTitle icon={<AlignJustify className="h-3.5 w-3.5 text-violet-500" />} label="Messages" />

            <SettingRow
              label="Grouper les bulles consécutives"
              desc="Fusionne visuellement les messages du même expéditeur"
            >
              <Switch
                checked={uiPrefs.groupBubbles ?? true}
                onCheckedChange={(v) => onUpdateUiPrefs({ groupBubbles: v })}
              />
            </SettingRow>
          </section>

          <Separator className="bg-border/30" />

          {/* ── Notifications ── */}
          <section className="space-y-4">
            <SectionTitle icon={<Volume2 className="h-3.5 w-3.5 text-emerald-500" />} label="Notifications" />

            <SettingRow
              label="Son de notification"
              desc="Bip lors d'un nouveau message entrant"
            >
              <Switch
                checked={uiPrefs.soundEnabled}
                onCheckedChange={(v) => onUpdateUiPrefs({ soundEnabled: v })}
              />
            </SettingRow>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SectionTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function SettingRow({
  label, desc, children,
}: {
  label:    string;
  desc:     string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium leading-none mb-0.5">{label}</p>
        <p className="text-[11px] text-muted-foreground leading-snug">{desc}</p>
      </div>
      {children}
    </div>
  );
}
