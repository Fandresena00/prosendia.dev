"use client";

import Image from "next/image";

interface VendeoLogoProps {
  size?: number;
  rounded?: string;
}

export function VendeoLogo({
  size = 7,
  rounded = "rounded-lg",
}: VendeoLogoProps) {
  const px = size * 4;
  return (
    <div className="relative shrink-0" style={{ width: px, height: px }}>
      {/* Dark mode logo */}
      <Image
        src="/logo/vendeoai_logo_iconic_dark.svg"
        loading="eager"
        alt="VendeoAI"
        fill
        className={`h-8 w-8 ${rounded} hidden dark:block`}
        style={{ boxShadow: "0 0 14px oklch(0.52 0.24 256 / 28%)" }}
      />
      {/* Light mode logo */}
      <Image
        src="/logo/vendeoai_logo_iconic_light.svg"
        alt="VendeoAI"
        loading="eager"
        fill
        className={`h-8 w-8 ${rounded} block dark:hidden`}
        style={{ boxShadow: "0 0 14px oklch(0.52 0.24 256 / 18%)" }}
      />
    </div>
  );
}
