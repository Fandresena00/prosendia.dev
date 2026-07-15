"use client";

import { ThemeSwitcher } from "@/components/shared/theme-switcher";
import { ProsendiaLogo } from "@/components/shared/prosendia-logo";
import Link from "next/link";

interface NavProps {
  onScrollTo: (id: string) => void;
}

export function Nav({ onScrollTo }: NavProps) {
  return (
    <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
      {/* Top accent line */}
      <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-primary/30 to-transparent" />
      <div className="mx-auto flex h-13 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <ProsendiaLogo size={7} rounded="rounded-lg" />
          <span className="text-sm font-bold tracking-tight">prosendia</span>
        </div>

        <div className="hidden items-center gap-7 md:flex">
          {[
            { id: "features", label: "Fonctionnalités" },
            { id: "pricing", label: "Tarifs" },
            { id: "faq", label: "FAQ" },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => onScrollTo(id)}
              className="group relative py-1 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {label}
              <span className="absolute inset-x-0 -bottom-0.5 h-px scale-x-0 rounded-full bg-linear-to-r from-primary to-primary/60 transition-transform duration-300 group-hover:scale-x-100 origin-left" />
            </button>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <ThemeSwitcher />
          <Link href="/sign-in">
            <button className="rounded-lg px-3.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground">
              Se connecter
            </button>
          </Link>
          <Link href="/sign-up">
            <button
              className="rounded-lg bg-primary px-4 py-1.5 text-[12px] font-semibold text-primary-foreground transition-all hover:opacity-90"
              style={{ boxShadow: "0 0 14px oklch(0.52 0.24 256 / 28%)" }}
            >
              Commencer
            </button>
          </Link>
        </div>
      </div>
    </nav>
  );
}
