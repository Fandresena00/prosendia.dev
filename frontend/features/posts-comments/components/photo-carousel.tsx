"use client";
/**
 * @file features/posts-comments/components/photo-carousel.tsx
 */

import { Badge } from "@/components/ui/badge";
import { ImageIcon } from "lucide-react";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PHOTO_GRADIENTS } from "../data/posts-comments.data";

interface PhotoCarouselProps {
  photos: string[];
}

export function PhotoCarousel({ photos }: PhotoCarouselProps) {
  const [idx, setIdx] = useState(0);
  if (!photos.length) return null;

  return (
    <div
      className="relative rounded-lg overflow-hidden"
      style={{ aspectRatio: "16/9", background: PHOTO_GRADIENTS[idx % PHOTO_GRADIENTS.length] }}
    >
      <div className="absolute inset-0 flex items-center justify-center opacity-30">
        <ImageIcon className="h-8 w-8" />
      </div>

      {photos.length > 1 && (
        <>
          <button
            onClick={() => setIdx((i) => (i - 1 + photos.length) % photos.length)}
            className="absolute left-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-background/80 flex items-center justify-center hover:bg-background transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setIdx((i) => (i + 1) % photos.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-background/80 flex items-center justify-center hover:bg-background transition-colors"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1">
            {photos.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === idx ? "w-4 bg-white" : "w-1.5 bg-white/50"
                }`}
              />
            ))}
          </div>
          <Badge
            variant="secondary"
            className="absolute top-2 right-2 text-[10px] bg-background/80"
          >
            {idx + 1}/{photos.length}
          </Badge>
        </>
      )}
    </div>
  );
}
