'use client';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  IconCloudUpload,
  IconPhoto,
  IconPlus,
  IconX,
} from '@tabler/icons-react';
import { useRef, useState } from 'react';
import type { PhotoPreset, PresetPhoto } from '../types/inbox.types';

const PHOTO_GRADS = [
  'from-blue-500/40 to-indigo-600/30',
  'from-violet-500/40 to-purple-600/30',
  'from-emerald-500/40 to-teal-600/30',
  'from-amber-500/40 to-orange-600/30',
  'from-rose-500/40 to-pink-600/30',
  'from-cyan-500/40 to-sky-600/30',
];

interface AddPresetDialogProps {
  open: boolean;
  onClose: () => void;
  /** onAdd receives the preset data + the original File objects for backend upload */
  onAdd: (p: Omit<PhotoPreset, 'id'> & { files: File[] }) => Promise<void>;
}

export function AddPresetDialog({ open, onClose, onAdd }: AddPresetDialogProps) {
  const [name,        setName]        = useState('');
  const [description, setDescription] = useState('');
  const [photos,      setPhotos]      = useState<PresetPhoto[]>([]);
  const [files,       setFiles]       = useState<File[]>([]);
  const [saving,      setSaving]      = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    setName('');
    setDescription('');
    setPhotos([]);
    setFiles([]);
    setSaving(false);
    onClose();
  };

  const canAdd = name.trim() && description.trim() && photos.length > 0;

  const addPhotos = (incoming: FileList | null) => {
    if (!incoming) return;
    const arr = Array.from(incoming);
    setFiles((f) => [...f, ...arr]);
    setPhotos((p) => [
      ...p,
      ...arr.map((f, i) => ({
        id:        crypto.randomUUID(),
        objectUrl: URL.createObjectURL(f),
        gradient:  PHOTO_GRADS[(p.length + i) % PHOTO_GRADS.length],
      })),
    ]);
  };

  const removePhoto = (id: string) => {
    const idx = photos.findIndex((p) => p.id === id);
    if (idx === -1) return;
    setPhotos((p) => p.filter((ph) => ph.id !== id));
    setFiles((f) => f.filter((_, i) => i !== idx));
  };

  const handleAdd = async () => {
    if (!canAdd) return;
    setSaving(true);
    try {
      await onAdd({ name, description, photos, files });
      handleClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-sm font-semibold">
            <IconPhoto className="h-4.5 w-4.5 text-primary" />
            Nouvelle image de référence
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs">
            Créez un preset d&apos;images avec description pour envoi rapide dans les conversations.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-1">
          {/* ── Info banner ── */}
          <div className="flex gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs">
            <IconCloudUpload className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-600" />
            <div>
              <p className="font-semibold text-emerald-700 dark:text-emerald-400 mb-0.5">
                Images stockées sur le serveur
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Les images de référence sont hébergées par VendeoAI et envoyées
                directement sur Facebook. Elles restent disponibles même après fermeture du navigateur.
              </p>
            </div>
          </div>

          {/* ── Photo grid ── */}
          <div>
            <Label className="text-xs font-medium mb-2 block">
              Photos
              {photos.length > 0 && (
                <span className="ml-2 text-primary font-semibold">
                  {photos.length} sélectionnée{photos.length > 1 ? 's' : ''}
                </span>
              )}
            </Label>

            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-1.5 mb-2">
                {photos.map((ph) => (
                  <div key={ph.id} className="relative group aspect-square">
                    <div
                      className={`w-full h-full rounded-lg overflow-hidden bg-gradient-to-br ${ph.gradient}`}
                    >
                      {ph.objectUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={ph.objectUrl}
                          alt="preview"
                          className="w-full h-full object-cover"
                        />
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

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full h-16 rounded-lg border-2 border-dashed border-border/50 flex flex-col items-center justify-center gap-1 hover:border-primary/40 hover:bg-primary/3 transition-colors text-muted-foreground"
            >
              <IconPlus className="h-4 w-4" />
              <span className="text-xs">Ajouter des photos</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }}
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
              Description{' '}
              <span className="text-muted-foreground font-normal">
                (insérée automatiquement dans le message)
              </span>
            </Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="text-sm resize-none"
              placeholder="Texte qui s'insèrera automatiquement…"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <AlertDialogCancel className="flex-1 h-8 text-xs" disabled={saving}>
            Annuler
          </AlertDialogCancel>
          <Button
            className="flex-1 h-8 text-xs"
            disabled={!canAdd || saving}
            onClick={handleAdd}
          >
            {saving ? 'Enregistrement…' : 'Ajouter'}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
