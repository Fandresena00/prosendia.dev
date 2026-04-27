"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { IconInfoCircle, IconPhoto, IconPlus, IconX } from "@tabler/icons-react";
import { useRef, useState } from "react";
import { PHOTO_GRADS } from "../data/inbox.mock";
import type { PhotoPreset, PresetPhoto } from "../types/inbox.types";

interface AddPresetDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (p: Omit<PhotoPreset, "id">) => void;
}

export function AddPresetDialog({ open, onClose, onAdd }: AddPresetDialogProps) {
  const [name, setName]               = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos]           = useState<PresetPhoto[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    setName("");
    setDescription("");
    setPhotos([]);
    onClose();
  };

  const canAdd = name.trim() && description.trim();

  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    const newPhotos: PresetPhoto[] = Array.from(files).map((f, i) => ({
      id: crypto.randomUUID(),
      objectUrl: URL.createObjectURL(f),
      gradient: PHOTO_GRADS[(photos.length + i) % PHOTO_GRADS.length],
    }));
    setPhotos((p) => [...p, ...newPhotos]);
  };

  const removePhoto = (id: string) => setPhotos((p) => p.filter((ph) => ph.id !== id));

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <IconPhoto className="h-5 w-5 text-primary" />
            Ajouter une photo prédéfinie
          </AlertDialogTitle>
          <AlertDialogDescription>
            Créez une ou plusieurs photos avec leur description pour envoi rapide.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-1">
          {/* ── Multi-photo info banner ── */}
          <div className="flex gap-2.5 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-primary/80">
            <IconInfoCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-primary">Photos multiples</p>
              <p className="leading-relaxed text-muted-foreground">
                Vous pouvez ajouter <strong>plusieurs photos</strong> pour un même preset.
                Au moment de l'envoi, toutes les photos seront envoyées ensemble dans une
                seule bulle de message, accompagnées de la description.
              </p>
            </div>
          </div>

          {/* ── Photo picker zone ── */}
          <div>
            <Label className="text-xs font-medium mb-2 block">
              Photos
              {photos.length > 0 && (
                <span className="ml-2 text-primary font-semibold">{photos.length} sélectionnée{photos.length > 1 ? "s" : ""}</span>
              )}
            </Label>

            {/* Photo grid preview */}
            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-1.5 mb-2">
                {photos.map((ph) => (
                  <div key={ph.id} className="relative group aspect-square">
                    <div className={`w-full h-full rounded-lg overflow-hidden bg-linear-to-br ${ph.gradient}`}>
                      {ph.objectUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={ph.objectUrl} alt="preview" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <button
                      onClick={() => removePhoto(ph.id)}
                      className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-foreground text-background flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <IconX className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add more photos button */}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full h-20 rounded-xl border-2 border-dashed border-border/50 flex flex-col items-center justify-center gap-1.5 hover:border-primary/50 hover:bg-primary/3 transition-colors text-muted-foreground"
            >
              <IconPlus className="h-5 w-5" />
              <span className="text-xs">Ajouter des photos</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }}
            />
          </div>

          {/* ── Name ── */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Nom du preset</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex : Nouvelle collection"
              className="h-9 text-sm"
            />
          </div>

          {/* ── Description ── */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Description{" "}
              <span className="text-muted-foreground font-normal">(s&apos;insère automatiquement dans le message)</span>
            </Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="text-sm resize-none"
              placeholder="Texte qui s'insérera automatiquement dans le message…"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <AlertDialogCancel className="flex-1 h-9 text-sm">Annuler</AlertDialogCancel>
          <Button
            className="flex-1 h-9 text-sm"
            disabled={!canAdd}
            onClick={() => {
              onAdd({ name, description, photos });
              handleClose();
            }}
          >
            Ajouter
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
