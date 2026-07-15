"use client";

/**
 * @file features/inbox/components/SuggestionBar.tsx
 *
 * Preview shown above the composer while/after the AI drafts a reply
 * suggestion (triggered by the Sparkles button in ChatView). Text streams in
 * live as chunks arrive over the WebSocket; the agent clicks "Utiliser cette
 * suggestion" to copy it straight into the composer, or dismisses it.
 */

import { Loader2, Sparkles, X } from "lucide-react";
import type { SuggestionStatus } from "../hooks/useInbox";

interface SuggestionBarProps {
  status:     SuggestionStatus;
  text:       string;
  error?:     string | null;
  onAccept:   () => void;
  onDismiss:  () => void;
}

export function SuggestionBar({ status, text, error, onAccept, onDismiss }: SuggestionBarProps) {
  const isBusy = status === "loading" || status === "streaming";

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-250 mx-3 mt-2 rounded-2xl border border-primary/20 bg-primary/5 overflow-hidden">
      <div className="flex items-center gap-2 px-3.5 pt-2.5">
        <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
        <p className="text-[11px] font-semibold text-primary flex-1">
          {status === "error" ? "Suggestion indisponible" : "Suggestion IA"}
        </p>
        {isBusy && <Loader2 className="h-3 w-3 animate-spin text-primary/60" />}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Fermer la suggestion"
          className="h-5 w-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-black/5 transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      <div className="px-3.5 pb-2.5 pt-1.5">
        {status === "error" ? (
          <p className="text-xs text-destructive leading-relaxed">
            {error ?? "Impossible de générer une suggestion pour le moment."}
          </p>
        ) : (
          <p className="text-xs leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
            {text || "Réflexion en cours…"}
            {isBusy && (
              <span className="inline-block w-1 h-3 bg-primary/70 ml-0.5 align-middle animate-pulse" />
            )}
          </p>
        )}
      </div>

      {status === "done" && text.trim() && (
        <button
          type="button"
          onClick={onAccept}
          className="w-full text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/15 transition-colors py-2 border-t border-primary/15"
        >
          Utiliser cette suggestion
        </button>
      )}
    </div>
  );
}
