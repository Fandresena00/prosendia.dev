"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { IconPhoto, IconPlus, IconTrash } from "@tabler/icons-react";
import type { PhotoPreset } from "../types/inbox.types";

interface PhotoPresetSheetProps {
  presets: PhotoPreset[];
  onSelectPreset: (p: PhotoPreset) => void;
  onOpenAdd: () => void;
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
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
          <IconPhoto className="h-[18px] w-[18px]" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[300px] p-0 flex flex-col overflow-hidden">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/40 shrink-0">
          <SheetTitle className="text-base">Photos prédéfinies</SheetTitle>
          <p className="text-xs text-muted-foreground">
            Envoyez rapidement une photo avec son texte
          </p>
        </SheetHeader>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-3">
            {presets.length >= 10 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                Maximum de 10 presets atteint
              </p>
            )}
            {presets.map((p) => {
              const firstPhoto = p.photos[0];
              return (
                <div
                  key={p.id}
                  className="rounded-xl border border-border/50 overflow-hidden bg-card hover:border-primary/30 transition-colors group"
                >
                  {/* Photo thumbnail */}
                  <div className={`h-20 relative overflow-hidden bg-linear-to-br ${firstPhoto?.gradient ?? "from-primary/20 to-primary/10"}`}>
                    {firstPhoto?.objectUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={firstPhoto.objectUrl} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center opacity-30">
                        <IconPhoto className="h-8 w-8 text-white" />
                      </div>
                    )}
                    {/* Multiple photos badge */}
                    {p.photos.length > 1 && (
                      <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
                        {p.photos.length} photos
                      </div>
                    )}
                  </div>

                  <div className="p-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-bold leading-snug">{p.name}</p>
                      {onRemovePreset && (
                        <button
                          onClick={() => onRemovePreset(p.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
                        >
                          <IconTrash className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                      {p.description}
                    </p>
                    <Button
                      size="sm"
                      className="w-full h-8 gap-1.5 mt-1 rounded-lg"
                      onClick={() => onSelectPreset(p)}
                    >
                      <IconPhoto className="h-3.5 w-3.5" />
                      Envoyer ce preset
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="px-4 py-3 border-t border-border/40 shrink-0">
          <Button
            variant="outline"
            className="w-full h-9 gap-2 text-sm"
            disabled={presets.length >= 10}
            onClick={onOpenAdd}
          >
            <IconPlus className="h-4 w-4" />
            Ajouter un preset
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
