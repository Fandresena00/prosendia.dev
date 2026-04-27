"use client";

import React from "react";
import { motion } from "framer-motion";
import { fadeUpVariant } from "@/lib/motion";

// ─── SectionLabel ─────────────────────────────────────────────────────────────
// Internal primitive — not exported. Used only by SectionHeader.
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary">
      {children}
    </p>
  );
}

// ─── SectionHeader ────────────────────────────────────────────────────────────
interface SectionHeaderProps {
  label: string;
  title: React.ReactNode;
  sub?: string;
  center?: boolean;
}

export function SectionHeader({ label, title, sub, center = true }: SectionHeaderProps) {
  return (
    <motion.div
      className={`mb-12 ${center ? "text-center" : ""}`}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={fadeUpVariant}
    >
      <SectionLabel>{label}</SectionLabel>
      <h2 className="text-[1.75rem] font-bold tracking-tight md:text-[2.1rem]">
        {title}
      </h2>
      {sub && (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{sub}</p>
      )}
    </motion.div>
  );
}
