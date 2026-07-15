"use client";

/**
 * @file features/inbox/components/MessagingWindowClosedBanner.tsx
 *
 * Replaces the composer (input bar) once Facebook's 24h standard messaging
 * window has closed — i.e. more than 24h since the client's last message.
 * Facebook rejects free-form Page → client sends outside this window, so
 * rather than let the agent type into a composer that will just fail, we
 * explain why and point them to Messenger directly.
 */

import { Button } from "@/components/ui/button";
import { Clock, ExternalLink } from "lucide-react";

interface MessagingWindowClosedBannerProps {
  clientName:        string;
  messengerDeepLink: string | null;
}

export function MessagingWindowClosedBanner({
  clientName,
  messengerDeepLink,
}: MessagingWindowClosedBannerProps) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 flex items-start gap-3 px-4 py-3.5">
      <div className="h-9 w-9 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
        <Clock className="h-4.5 w-4.5 text-amber-600" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold leading-snug">
          Fenêtre de messagerie fermée
        </p>
        <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
          Facebook n&apos;autorise l&apos;envoi de messages libres que dans les
          24h suivant le dernier message de <strong>{clientName}</strong>. Ce
          délai est dépassé — répondez-lui directement depuis Messenger pour
          rouvrir la conversation.
        </p>

        {messengerDeepLink ? (
          <Button
            asChild
            size="sm"
            className="h-8 gap-1.5 text-xs rounded-full mt-2.5"
          >
            <a href={messengerDeepLink} target="_blank" rel="noreferrer">
              Ouvrir Messenger
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        ) : (
          <p className="text-[11px] text-muted-foreground italic mt-2">
            Aucune page Facebook connectée pour ouvrir Messenger directement.
          </p>
        )}
      </div>
    </div>
  );
}
