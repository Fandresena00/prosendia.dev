/**
 * @file src/features/auth/components/shared/password-field.tsx
 * Show/hide toggle + real-time strength requirements display.
 */

"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Check, Eye, EyeOff, X } from "lucide-react";
import { forwardRef, useState } from "react";

// ─── Password strength rules ──────────────────────────────────────────────────

interface Rule {
  label: string;
  test: (v: string) => boolean;
}

const RULES: Rule[] = [
  { label: "8 caractères minimum", test: (v) => v.length >= 8 },
  { label: "Une majuscule", test: (v) => /[A-Z]/.test(v) },
  { label: "Une minuscule", test: (v) => /[a-z]/.test(v) },
  { label: "Un chiffre", test: (v) => /\d/.test(v) },
  { label: "Un caractère spécial", test: (v) => /[^A-Za-z0-9]/.test(v) },
];

interface PasswordRequirementsProps {
  value: string;
  className?: string;
}

export function PasswordRequirements({ value, className }: PasswordRequirementsProps) {
  if (!value) return null;
  return (
    <div className={cn("grid grid-cols-1 gap-1 pt-1", className)}>
      {RULES.map((rule) => {
        const ok = rule.test(value);
        return (
          <div key={rule.label} className="flex items-center gap-1.5">
            {ok
              ? <Check className="h-3 w-3 shrink-0 text-emerald-400" />
              : <X className="h-3 w-3 shrink-0 text-muted-foreground/50" />
            }
            <span className={cn(
              "text-[11px] transition-colors",
              ok ? "text-emerald-400" : "text-muted-foreground/60"
            )}>
              {rule.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Email live validation ────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface EmailHintProps {
  value: string;
  error?: string;
}

export function EmailHint({ value, error }: EmailHintProps) {
  if (error) return <p className="text-[11px] text-destructive">{error}</p>;
  if (!value) return null;
  const valid = EMAIL_RE.test(value);
  return (
    <div className="flex items-center gap-1.5">
      {valid
        ? <Check className="h-3 w-3 text-emerald-400" />
        : <X className="h-3 w-3 text-muted-foreground/50" />
      }
      <span className={cn("text-[11px] transition-colors", valid ? "text-emerald-400" : "text-muted-foreground/60")}>
        {valid ? "Email valide" : "Format invalide"}
      </span>
    </div>
  );
}

// ─── PasswordInput with toggle ────────────────────────────────────────────────

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  showRequirements?: boolean;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ label, error, hint, showRequirements, value, ...props }, ref) => {
    const [show, setShow] = useState(false);
    const strValue = typeof value === "string" ? value : "";

    return (
      <div className="space-y-1.5">
        {label && <Label className="text-[12px] font-medium">{label}</Label>}
        <div className="relative">
          <Input
            ref={ref}
            type={show ? "text" : "password"}
            className="h-9 pr-9 text-[13px]"
            value={value}
            aria-invalid={!!error}
            {...props}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none"
            tabIndex={-1}
            aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          >
            {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
        {error
          ? <p className="text-[11px] text-destructive">{error}</p>
          : hint
          ? <p className="text-[11px] text-muted-foreground/60">{hint}</p>
          : null
        }
        {showRequirements && <PasswordRequirements value={strValue} />}
      </div>
    );
  }
);
PasswordInput.displayName = "PasswordInput";
