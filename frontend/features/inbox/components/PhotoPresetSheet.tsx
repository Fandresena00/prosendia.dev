"use client";

/**
 * @file features/inbox/components/PhotoPresetSheet.tsx
 * Reference image presets — redesigned with compact grid cards and hover preview.
 */

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  IconCloudUpload, IconPhoto, IconPlus, IconSend, IconTrash,
} from "@tabler/icons-react";
import type { PhotoPreset } from "../types/inbox.types";

interface PhotoPresetSheetProps {
  presets:         PhotoPreset[];
  onSelectPreset:  (p: PhotoPreset) => void;
  onOpenAdd:       () => void;
  onRemovePreset?: (id: string) => void;
}

export function PhotoPresetSheet({
  presets, onSelectPreset, onOpenAdd, onRemovePreset,
}: PhotoPresetSheetProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-1.5 px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/60"
          title="Images de référence"
        >
          <IconPhoto className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Références</span>
          {presets.length > 0 && (
            <span className="hidden sm:inline text-[10px] font-bold text-primary/70">
              ({presets.length})
            </span>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:w-[300px] p-0 flex flex-col overflow-hidden">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/40 shrink-0">
          <SheetTitle className="flex items-center gap-2 text-sm font-semibold">
            <IconPhoto className="h-4 w-4 text-primary" />
            Images de référence
            {presets.length > 0 && (
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                {presets.length}/10
              </span>
            )}
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            Photos produit hébergées — envoi direct sur Facebook
          </p>
        </SheetHeader>

        <ScrollArea className="flex-1 min-h-0 px-3 py-3">
          {presets.length === 0 ? (
            <EmptyPresets onOpenAdd={onOpenAdd} />
          ) : (
            <div className="space-y-2">
              {presets.map((preset) => (
                <PresetCard
                  key={preset.id}
                  preset={preset}
                  onSelect={onSelectPreset}
                  onRemove={onRemovePreset}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="px-3 py-3 border-t border-border/40 shrink-0">
          <Button
            variant="outline"
            className="w-full h-8 gap-1.5 text-xs rounded-lg"
            disabled={presets.length >= 10}
            onClick={onOpenAdd}
          >
            <IconPlus className="h-3.5 w-3.5" />
            {presets.length >= 10 ? "Limite atteinte (10 max)" : "Nouvelle image de référence"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── PresetCard ────────────────────────────────────────────────────────────────

function PresetCard({
  preset, onSelect, onRemove,
}: {
  preset:   PhotoPreset;
  onSelect: (p: PhotoPreset) => void;
  onRemove?: (id: string) => void;
}) {
  const images     = preset.photos;
  const imageCount = images.length;
  const isStored   = (preset.referenceImageUrls?.length ?? 0) > 0;

  return (
    <div className="group rounded-xl border border-border/50 bg-card overflow-hidden hover:border-primary/30 hover:shadow-sm transition-all duration-200">
      {/* Image strip — shows up to 4 thumbnails side by side */}
      <div className="relative h-[72px] flex overflow-hidden bg-secondary/40">
        {images.slice(0, 4).map((photo, i) => (
          <div
            key={i}
            className="flex-1 relative overflow-hidden"
            style={{ maxWidth: `${100 / Math.min(imageCount, 4)}%` }}
          >
            {photo.objectUrl ? (
              <Image
                src={photo.objectUrl}
                alt={preset.name}
                fill
                sizes="80px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <div
                className={`w-full h-full bg-gradient-to-br ${photo.gradient ?? "from-primary/20 to-primary/10"} flex items-center justify-center`}
              >
                <IconPhoto className="h-5 w-5 text-white/30" />
              </div>
            )}
          </div>
        ))}

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />

        {/* Badges */}
        <div className="absolute top-2 left-2 flex items-center gap-1">
          {isStored && (
            <span className="flex items-center gap-0.5 bg-emerald-500/90 text-white text-[9px] font-semibold rounded-full px-1.5 py-0.5">
              <IconCloudUpload className="h-2.5 w-2.5" />
              Stockée
            </span>
          )}
        </div>
        {imageCount > 1 && (
          <span className="absolute top-2 right-2 bg-black/60 text-white text-[9px] font-bold rounded-full px-1.5 py-0.5">
            {imageCount} photos
          </span>
        )}
      </div>

      {/* Info row */}
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate leading-snug">{preset.name}</p>
          <p className="text-[10px] text-muted-foreground truncate leading-snug mt-0.5">
            {preset.description}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onRemove && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemove(preset.id); }}
                    className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <IconTrash className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Supprimer</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          <Button
            size="sm"
            className="h-6 px-2 text-[10px] gap-1 rounded-md"
            onClick={() => onSelect(preset)}
          >
            <IconSend className="h-2.5 w-2.5" />
            Envoyer
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────────

function EmptyPresets({ onOpenAdd }: { onOpenAdd: () => void }) {
  return (
    <div className="flex flex-col items-center py-10 gap-4 text-center px-4">
      <div className="h-12 w-12 rounded-2xl bg-secondary flex items-center justify-center">
        <IconPhoto className="h-6 w-6 text-muted-foreground" />
      </div>
      <div>
        <p className="text-xs font-semibold">Aucune image de référence</p>
        <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
          Ajoutez des photos produit pour les envoyer en un clic directement
          depuis cette conversation.
        </p>
      </div>
      <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={onOpenAdd}>
        <IconPlus className="h-3.5 w-3.5" />
        Ajouter une image
      </Button>
    </div>
  );
}
