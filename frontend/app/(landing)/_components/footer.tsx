"use client";

import { ProsendiaLogo } from "@/components/shared/prosendia-logo";
import { IconBrandFacebook, IconBrandWhatsapp } from "@tabler/icons-react";
import { MailIcon } from "lucide-react";

const LINK_COLUMNS = [
  {
    title: "Produit",
    links: [
      ["#features", "Fonctionnalités"],
      ["#pricing", "Tarifs"],
      ["#contact", "Contact"],
    ],
  },
  {
    title: "Légal",
    links: [
      ["/privacy", "Confidentialité"],
      ["/terms", "CGU"],
    ],
  },
] as const;

export function Footer() {
  return (
    <footer className="relative z-10 border-t border-border/40 px-6 py-12">
      {/* Top accent */}
      <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-primary/20 to-transparent" />

      <div className="mx-auto max-w-5xl">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <ProsendiaLogo size={6} rounded="rounded-lg" />
              <span className="text-sm font-bold text-foreground">
                prosendia
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              L&apos;assistant IA qui vend à votre place sur Facebook
            </p>
          </div>

          {LINK_COLUMNS.map(({ title, links }) => (
            <div key={title}>
              <p className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {title}
              </p>
              <ul className="space-y-2.5">
                {links.map(([href, label]) => (
                  <li key={label}>
                    <a
                      href={href}
                      className="text-[12px] text-muted-foreground/55 transition-colors hover:text-foreground"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <p className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Nous contacter
            </p>
            <ul className="space-y-2.5">
              <li>
                <a
                  href="mailto:contact@genforus.com"
                  className="text-[12px] text-muted-foreground/55 transition-colors hover:text-foreground"
                >
                  contact@genforus.com
                </a>
              </li>
              <li>
                <a
                  href="https://wa.me/261375112731"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[12px] text-muted-foreground/55 transition-colors hover:text-foreground"
                >
                  +261 37 51 127 31
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-border/30 pt-6 md:flex-row">
          <p className="text-[11px] text-muted-foreground/45">
            © 2026 prosendia. Tous droits réservés.
          </p>
          <div className="flex gap-4">
            <a
              href="https://wa.me/261375112731"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
              className="text-muted-foreground/45 transition-colors hover:text-foreground"
            >
              <IconBrandWhatsapp className="h-4 w-4" />
            </a>
            <a
              href="mailto:contact@genforus.com"
              aria-label="Email"
              className="text-muted-foreground/45 transition-colors hover:text-foreground"
            >
              <MailIcon className="h-4 w-4" />
            </a>
            <a
              href="#"
              aria-label="Facebook"
              className="text-muted-foreground/45 transition-colors hover:text-foreground"
            >
              <IconBrandFacebook className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
