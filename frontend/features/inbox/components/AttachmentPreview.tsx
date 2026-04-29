'use client';

import { IconPhoto, IconX } from '@tabler/icons-react';
import type { FileAttachment, PhotoAttachment, PhotoPreset } from '../types/inbox.types';

interface AttachmentPreviewProps {
  photos:          PhotoAttachment[];
  file:            FileAttachment | null;
  preset:          PhotoPreset | null;
  onRemovePhoto:   (index: number) => void;
  onRemoveFile:    () => void;
  onRemovePreset:  () => void;
}

export function AttachmentPreview({
  photos,
  file,
  preset,
  onRemovePhoto,
  onRemoveFile,
  onRemovePreset,
}: AttachmentPreviewProps) {
  if (!photos.length && !file && !preset) return null;

  return (
    <div className="px-3 pt-3 pb-1 flex flex-wrap gap-2 border-t border-border/40">
      {/* Individual picked photos */}
      {photos.map((p, i) => (
        <div key={i} className="relative group">
          <div
            className={`h-16 w-16 rounded-xl overflow-hidden bg-gradient-to-br ${p.gradient}`}
          >
            {p.objectUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.objectUrl}
                alt={p.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <PlaceholderIcon />
            )}
          </div>
          <RemoveBtn onClick={() => onRemovePhoto(i)} />
        </div>
      ))}

      {/* Preset chip */}
      {preset && (
        <div className="relative group">
          <div className="flex items-center gap-2 h-16 px-3 rounded-xl border border-primary/25 bg-primary/5">
            {/* Thumbnail */}
            <div
              className={`h-10 w-10 rounded-lg overflow-hidden bg-gradient-to-br ${
                preset.photos[0]?.gradient ?? ''
              } flex items-center justify-center shrink-0`}
            >
              {preset.photos[0]?.objectUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preset.photos[0].objectUrl}
                  alt={preset.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <IconPhoto className="h-4 w-4 text-white/50" />
              )}
            </div>
            <div className="min-w-0 max-w-[110px]">
              <p className="text-xs font-semibold truncate">{preset.name}</p>
              <p className="text-[10px] text-primary/70 truncate">
                {preset.photos.length > 1
                  ? `${preset.photos.length} photos`
                  : 'Image de référence'}
              </p>
            </div>
          </div>
          <RemoveBtn onClick={onRemovePreset} />
        </div>
      )}

      {/* File chip */}
      {file && (
        <div className="relative group">
          <div className="flex items-center gap-2 h-16 px-3 rounded-xl border border-border/50 bg-secondary/40">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-[10px] font-bold text-primary">
                {file.name.split('.').pop()?.toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 max-w-[120px]">
              <p className="text-xs font-semibold truncate">{file.name}</p>
              <p className="text-[10px] text-muted-foreground">{file.size}</p>
            </div>
          </div>
          <RemoveBtn onClick={onRemoveFile} />
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-foreground flex items-center justify-center text-background opacity-0 group-hover:opacity-100 transition-opacity"
    >
      <IconX className="h-3 w-3" />
    </button>
  );
}

function PlaceholderIcon() {
  return (
    <div className="w-full h-full flex items-center justify-center opacity-30">
      <svg
        className="h-5 w-5 text-white"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={1.5} />
        <circle cx="8.5" cy="8.5" r="1.5" strokeWidth={1.5} />
        <path d="M21 15l-5-5L5 21" strokeWidth={1.5} />
      </svg>
    </div>
  );
}
