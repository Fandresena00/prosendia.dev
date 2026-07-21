"use client";

import { ProsendiaLogo } from "@/components/shared/prosendia-logo";
import { ThemeSwitcher } from "@/components/shared/theme-switcher";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

interface NavProps {
  onScrollTo: (id: string) => void;
}

const LINKS = [
  { id: "features", label: "Fonctionnalités" },
  { id: "pricing", label: "Tarifs" },
  { id: "contact", label: "Contact" },
] as const;

export function Nav({ onScrollTo }: NavProps) {
  const [open, setOpen] = useState(false);

  // Lock body scroll while the mobile panel is open, and always close
  // the panel if the viewport grows back to desktop width.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handleNav = (id: string) => {
    setOpen(false);
    onScrollTo(id);
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
      {/* Top accent line */}
      <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-primary/30 to-transparent" />

      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:px-6">
        <button
          onClick={() => handleNav("hero")}
          className="flex items-center gap-2"
          aria-label="prosendia — retour en haut"
        >
          <ProsendiaLogo size={15} rounded="rounded-lg" />
          <span className="text-sm font-bold tracking-tight">prosendia</span>
        </button>

        {/* Desktop links */}
        <div className="hidden items-center gap-7 md:flex">
          {LINKS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => handleNav(id)}
              className="group relative py-1 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {label}
              <span className="absolute inset-x-0 -bottom-0.5 h-px scale-x-0 rounded-full bg-linear-to-r from-primary to-primary/60 transition-transform duration-300 group-hover:scale-x-100 origin-left" />
            </button>
          ))}
        </div>

        {/* Desktop actions */}
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

        {/* Mobile trigger — always visible below md, so the nav never
            appears to "disappear" on phone. */}
        <div className="flex items-center gap-1.5 md:hidden">
          <ThemeSwitcher />
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={open}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 text-foreground transition-colors hover:bg-secondary/60"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={open ? "close" : "open"}
                initial={{ opacity: 0, rotate: -45 }}
                animate={{ opacity: 1, rotate: 0 }}
                exit={{ opacity: 0, rotate: 45 }}
                transition={{ duration: 0.15 }}
                className="flex"
              >
                {open ? (
                  <X className="h-4.5 w-4.5" />
                ) : (
                  <Menu className="h-4.5 w-4.5" />
                )}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
      </div>

      {/* Mobile panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-b border-border/50 bg-background/95 backdrop-blur-md md:hidden"
          >
            <div className="flex flex-col gap-1 px-5 pb-5 pt-2">
              {LINKS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => handleNav(id)}
                  className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
                >
                  {label}
                </button>
              ))}

              <div className="mt-3 flex flex-col gap-2.5 border-t border-border/40 pt-4">
                <Link href="/sign-in" onClick={() => setOpen(false)}>
                  <button className="w-full rounded-lg border border-border/60 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary/60">
                    Se connecter
                  </button>
                </Link>
                <Link href="/sign-up" onClick={() => setOpen(false)}>
                  <button
                    className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90"
                    style={{ boxShadow: "0 0 14px oklch(0.52 0.24 256 / 28%)" }}
                  >
                    Commencer gratuitement
                  </button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
