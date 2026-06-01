/**
 * @file features/business-profile/components/ui-primitives.tsx
 * Unchanged — included for completeness.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { IconCheck, IconInfoCircle } from "@tabler/icons-react";
import type { ReactNode } from "react";

export type AccentColor =
  | "primary" | "violet" | "sky" | "emerald"
  | "amber"   | "facebook" | "none";

const ACCENT_STEP: Record<AccentColor, string> = {
  primary:  "text-primary bg-primary/10 border-primary/15",
  violet:   "text-violet-600 bg-violet-500/10 border-violet-500/15",
  sky:      "text-sky-600 bg-sky-500/10 border-sky-500/15",
  emerald:  "text-emerald-600 bg-emerald-500/10 border-emerald-500/15",
  amber:    "text-amber-600 bg-amber-500/10 border-amber-500/15",
  facebook: "text-[#1877F2] bg-[#1877F2]/10 border-[#1877F2]/15",
  none:     "text-muted-foreground bg-secondary/60 border-border/40",
};

interface SectionCardProps {
  step:      string;
  icon:      ReactNode;
  title:     string;
  accent:    AccentColor;
  badge?:    ReactNode;
  subtitle?: string;
  children:  ReactNode;
}

export function SectionCard({
  step, icon, title, accent, badge, subtitle, children,
}: SectionCardProps) {
  return (
    <Card className="relative overflow-hidden rounded-xl border-border/50 bg-card/80 shadow-sm">
      <CardHeader className="border-b border-border/35 px-5 py-4">
        <CardTitle className="flex items-center gap-3 text-[13px] font-semibold">
          <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${ACCENT_STEP[accent]}`}>
            {step}
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/45 bg-secondary/35">
            {icon}
          </span>
          <span className="min-w-0 flex-1 truncate">{title}</span>
          {badge && <span className="shrink-0">{badge}</span>}
        </CardTitle>
        {subtitle && (
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{subtitle}</p>
        )}
      </CardHeader>
      <CardContent className="px-5 py-5">{children}</CardContent>
    </Card>
  );
}

interface FieldProps {
  label:     ReactNode;
  hint?:     string;
  required?: boolean;
  children:  ReactNode;
}

export function Field({ label, hint, required, children }: FieldProps) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1 text-xs font-semibold text-foreground">
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[11px] leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}

interface ToggleCardProps {
  label:   string;
  desc:    string;
  active:  boolean;
  onClick: () => void;
}

export function ToggleCard({ label, desc, active, onClick }: ToggleCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-lg border p-3 text-left transition-all ${
        active
          ? "border-primary/45 bg-primary/8 ring-1 ring-primary/20"
          : "border-border/50 bg-background hover:border-border hover:bg-secondary/35"
      }`}
    >
      {active && (
        <span className="absolute right-2.5 top-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <IconCheck className="h-3 w-3" />
        </span>
      )}
      <p className={`pr-5 text-xs font-semibold leading-snug ${active ? "text-primary" : ""}`}>
        {label}
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{desc}</p>
    </button>
  );
}

export function InfoNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-border/45 bg-secondary/30 px-3 py-2.5">
      <IconInfoCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
      <p className="text-[11px] text-muted-foreground leading-relaxed">{children}</p>
    </div>
  );
}
