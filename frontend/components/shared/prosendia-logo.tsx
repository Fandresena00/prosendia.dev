"use client";

import { APP_NAME } from "@/lib/utils";
import Image from "next/image";

interface ProsendiaLogoProps {
  size?: number;
  rounded?: string;
}

export function ProsendiaLogo({
  size = 7,
  rounded = "rounded-lg",
}: ProsendiaLogoProps) {
  const px = size * 4;
  return (
    <div className="relative shrink-0" style={{ width: px, height: px }}>
      {/* Dark mode logo */}
      <Image
        src="/logo/prosendia_logo_iconic_dark.svg"
        loading="eager"
        alt="prosendia"
        fill
        className={`h-8 w-8 ${rounded} hidden dark:block`}
        style={{ boxShadow: "0 0 14px oklch(0.52 0.24 256 / 28%)" }}
      />
      {/* Light mode logo */}
      <Image
        src="/logo/prosendia_logo_iconic_light.svg"
        alt="prosendia"
        loading="eager"
        fill
        className={`h-8 w-8 ${rounded} block dark:hidden`}
        style={{ boxShadow: "0 0 14px oklch(0.52 0.24 256 / 18%)" }}
      />
    </div>
  );
}
