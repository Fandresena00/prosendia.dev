'use client';

import type { PhotoAttachment } from '../types/inbox.types';

interface PhotoTileProps {
  photo:      PhotoAttachment;
  height:     number;
  className?: string;
}

/**
 * Single photo tile.
 * Uses a plain <img> tag for blob:/https: URLs — next/image cannot handle blob:
 * URLs and these tiles have fixed pixel dimensions set via inline style.
 */
export function PhotoTile({ photo, height, className = '' }: PhotoTileProps) {
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ height }}>
      {photo.objectUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo.objectUrl}
          alt={photo.name}
          className="w-full h-full object-cover"
        />
      ) : (
        <div
          className={`w-full h-full bg-gradient-to-br ${photo.gradient} flex items-center justify-center`}
        >
          <svg
            className="h-8 w-8 opacity-25 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={1.5} />
            <circle cx="8.5" cy="8.5" r="1.5" strokeWidth={1.5} />
            <path d="M21 15l-5-5L5 21" strokeWidth={1.5} />
          </svg>
        </div>
      )}
    </div>
  );
}
