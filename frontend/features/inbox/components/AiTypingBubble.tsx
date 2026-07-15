"use client";

/**
 * @file features/inbox/components/AiTypingBubble.tsx
 *
 * Messenger-style "prosendia est en train d'écrire…" bubble, shown in the
 * message flow while ai_typing_start is active for the open conversation
 * (cleared on ai_typing_stop, on the next new_message, or after a ~20s
 * safety timeout — see useInbox).
 */

import { Bot } from "lucide-react";

export function AiTypingBubble() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 duration-200 flex items-end gap-2 justify-end mt-3">
      <div className="flex flex-col items-end max-w-[75%]">
        <p className="text-[11px] text-muted-foreground mb-1 px-1 flex items-center gap-1">
          <Bot className="h-3 w-3" /> prosendia écrit…
        </p>
        <div className="rounded-2xl rounded-br-md bg-primary/90 px-4 py-3 flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-primary-foreground/80 animate-bounce"
              style={{ animationDelay: `${i * 150}ms`, animationDuration: "900ms" }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
