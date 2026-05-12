/**
 * @file features/business-profile/components/ui-primitives.tsx
 * Unchanged — included for completeness.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { IconInfoCircle } from "@tabler/icons-react";
import type { ReactNode } from "react";

export type AccentColor =
  | "primary" | "violet" | "sky" | "emerald"
  | "amber"   | "facebook" | "none";

const ACCENT_BAR: Record<AccentColor, string> = {
  primary:  "bg-primary/60",
  violet:   "bg-violet-500/60",
  sky:      "bg-sky-500/60",
  emerald:  "bg-emerald-500/60",
  amber:    "bg-amber-500/60",
  facebook: "bg-[#1877F2]/60",
  none:     "bg-border/40",
};

const ACCENT_STEP: Record<AccentColor, string> = {
  primary:  "text-primary bg-primary/8",
  violet:   "text-violet-500 bg-violet-500/8",
  sky:      "text-sky-500 bg-sky-500/8",
  emerald:  "text-emerald-500 bg-emerald-500/8",
  amber:    "text-amber-500 bg-amber-500/8",
  facebook: "text-[#1877F2] bg-[#1877F2]/8",
  none:     "text-muted-foreground bg-secondary/60",
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
    <Card className="border-border/40 bg-card/60 backdrop-blur-sm relative overflow-hidden">
      <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${ACCENT_BAR[accent]}`} />
      <CardHeader className="pb-4 pl-6">
        <CardTitle className="text-[13px] font-semibold flex items-center gap-2.5">
          <span className={`text-[10px] font-bold rounded-md px-1.5 py-0.5 ${ACCENT_STEP[accent]}`}>
            {step}
          </span>
          {icon}
          {title}
          {badge}
        </CardTitle>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardHeader>
      <CardContent className="pl-6 pb-6">{children}</CardContent>
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
    <div className="space-y-1.5">
      <Label className="text-xs font-medium flex items-center gap-1">
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
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
      className={`rounded-lg border p-2.5 text-left transition-all ${
        active
          ? "border-primary/40 bg-primary/8 ring-1 ring-primary/20"
          : "border-border/50 bg-secondary/20 hover:border-border hover:bg-secondary/40"
      }`}
    >
      <p className={`text-xs font-semibold leading-snug ${active ? "text-primary" : ""}`}>
        {label}
      </p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
    </button>
  );
}

export function InfoNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg bg-secondary/40 border border-border/40 px-3 py-2.5">
      <IconInfoCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
      <p className="text-[11px] text-muted-foreground leading-relaxed">{children}</p>
    </div>
  );
}
