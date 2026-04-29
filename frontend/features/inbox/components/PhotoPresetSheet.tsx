'use client';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { IconCloudUpload, IconPhoto, IconPlus, IconTrash } from '@tabler/icons-react';
import type { PhotoPreset } from '../types/inbox.types';

interface PhotoPresetSheetProps {
  presets:         PhotoPreset[];
  onSelectPreset:  (p: PhotoPreset) => void;
  onOpenAdd:       () => void;
  onRemovePreset?: (id: number) => void;
}

export function PhotoPresetSheet({
  presets,
  onSelectPreset,
  onOpenAdd,
  onRemovePreset,
}: PhotoPresetSheetProps) {
  return (
    <Sheet>
      {/* ── Trigger — shows icon + label ── */}
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-1.5 px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <IconPhoto className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Images de référence</span>
        </Button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="w-[300px] p-0 flex flex-col overflow-hidden"
      >
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/40 shrink-0">
          <SheetTitle className="flex items-center gap-2 text-sm font-semibold">
            <IconPhoto className="h-4 w-4 text-primary" />
            Images de référence
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            Envoyez rapidement une photo produit avec sa description
          </p>
        </SheetHeader>

        <ScrollArea className="flex-1 p-3">
          <div className="space-y-2.5">
            {presets.length === 0 && (
              <div className="flex flex-col items-center py-10 gap-3 text-center">
                <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center">
                  <IconPhoto className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs font-semibold">Aucune image de référence</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Ajoutez des photos produit pour les envoyer rapidement
                  </p>
                </div>
              </div>
            )}

            {presets.length >= 10 && (
              <p className="text-xs text-muted-foreground text-center py-2 bg-secondary/40 rounded-lg">
                Maximum 10 presets atteint
              </p>
            )}

            {presets.map((p) => {
              const firstPhoto = p.photos[0];
              // Use backend URL if available, else blob URL
              const thumbUrl = firstPhoto?.objectUrl;

              return (
                <div
                  key={p.id}
                  className="rounded-xl border border-border/50 overflow-hidden bg-card hover:border-primary/30 transition-colors group"
                >
                  {/* Thumbnail */}
                  <div
                    className={`h-20 relative overflow-hidden bg-gradient-to-br ${
                      firstPhoto?.gradient ?? 'from-primary/20 to-primary/10'
                    }`}
                  >
                    {thumbUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumbUrl}
                        alt={p.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center opacity-30">
                        <IconPhoto className="h-8 w-8 text-white" />
                      </div>
                    )}

                    {/* Stored badge */}
                    {p.referenceImageUrls?.length ? (
                      <div className="absolute top-2 left-2 flex items-center gap-1 bg-emerald-500/90 text-white text-[10px] font-semibold rounded-full px-1.5 py-0.5">
                        <IconCloudUpload className="h-2.5 w-2.5" />
                        Stockée
                      </div>
                    ) : null}

                    {p.photos.length > 1 && (
                      <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
                        {p.photos.length} photos
                      </div>
                    )}
                  </div>

                  <div className="p-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-bold leading-snug">{p.name}</p>
                      {onRemovePreset && (
                        <button
                          onClick={() => onRemovePreset(p.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
                        >
                          <IconTrash className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                      {p.description}
                    </p>
                    <Button
                      size="sm"
                      className="w-full h-7 gap-1.5 mt-1 rounded-lg text-xs"
                      onClick={() => onSelectPreset(p)}
                    >
                      <IconPhoto className="h-3 w-3" />
                      Envoyer ce preset
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="px-3 py-3 border-t border-border/40 shrink-0">
          <Button
            variant="outline"
            className="w-full h-8 gap-1.5 text-xs"
            disabled={presets.length >= 10}
            onClick={onOpenAdd}
          >
            <IconPlus className="h-3.5 w-3.5" />
            Nouvelle image de référence
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
