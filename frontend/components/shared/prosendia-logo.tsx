"use client";

import Image from "next/image";

interface ProsendiaLogoProps {
  size?: number;
  rounded?: string;
}

// Single transparent-background mark — the icon's own blue → teal gradient
// already reads with enough contrast on both the light and dark surface,
// so we no longer need to ship and switch between two separate SVGs.
export function ProsendiaLogo({
  size = 7,
  rounded = "rounded-lg",
}: ProsendiaLogoProps) {
  const px = size * 4;
  return (
    <div
      className={`relative shrink-0 ${rounded} overflow-hidden`}
      style={{ width: px, height: px }}
    >
      <Image
        src="/logo/prosendia-logo.png"
        alt="prosendia"
        fill
        loading="eager"
        sizes={`${px}px`}
        className="object-contain drop-shadow-[0_0_10px_oklch(0.52_0.24_256_/_25%)]"
      />
    </div>
  );
}
