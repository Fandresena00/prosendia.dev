"use client";

import type { PhotoAttachment } from "../types/inbox.types";
import { PhotoTile } from "./PhotoTile";

const MAX_W = 280;

export function PhotoGrid({ photos }: { photos: PhotoAttachment[] }) {
  const n = photos.length;
  if (n === 0) return null;

  if (n === 1)
    return (
      <div className="rounded-2xl overflow-hidden" style={{ width: MAX_W, maxWidth: "100%" }}>
        <PhotoTile photo={photos[0]} height={200} />
      </div>
    );

  if (n === 2)
    return (
      <div className="flex gap-0.5 rounded-2xl overflow-hidden" style={{ width: MAX_W, maxWidth: "100%" }}>
        <PhotoTile photo={photos[0]} height={180} className="flex-1" />
        <PhotoTile photo={photos[1]} height={180} className="flex-1" />
      </div>
    );

  if (n === 3)
    return (
      <div className="flex gap-0.5 rounded-2xl overflow-hidden" style={{ width: MAX_W, maxWidth: "100%" }}>
        <PhotoTile photo={photos[0]} height={200} className="flex-1" />
        <div className="flex flex-col gap-0.5 flex-1">
          <PhotoTile photo={photos[1]} height={98} />
          <PhotoTile photo={photos[2]} height={98} />
        </div>
      </div>
    );

  return (
    <div className="grid grid-cols-2 gap-0.5 rounded-2xl overflow-hidden" style={{ width: MAX_W, maxWidth: "100%" }}>
      {photos.slice(0, 4).map((p, i) => {
        const isLast = i === 3 && n > 4;
        return (
          <div key={i} className="relative" style={{ height: 130 }}>
            <PhotoTile photo={p} height={130} />
            {isLast && (
              <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
                <span className="text-white text-lg font-bold">+{n - 4}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
