"use client";

import type { PhotoAttachment } from "../types/inbox.types";

interface PhotoTileProps {
  photo: PhotoAttachment;
  height: number;
  className?: string;
}

/**
 * Renders a single photo tile.
 * Uses a plain <img> tag for blob: / objectUrl sources because
 * next/image requires explicit width+height props for non-fill usage,
 * and blob: URLs are client-only temporary references that Next.js
 * cannot optimize. For remote URLs, <img> is equally correct here
 * since tiles have fixed pixel dimensions.
 */
export function PhotoTile({ photo, height, className = "" }: PhotoTileProps) {
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
          className={`w-full h-full bg-linear-to-br ${photo.gradient} flex items-center justify-center`}
        >
          <svg className="h-8 w-8 opacity-25 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={1.5} />
            <circle cx="8.5" cy="8.5" r="1.5" strokeWidth={1.5} />
            <path d="M21 15l-5-5L5 21" strokeWidth={1.5} />
          </svg>
        </div>
      )}
    </div>
  );
}
