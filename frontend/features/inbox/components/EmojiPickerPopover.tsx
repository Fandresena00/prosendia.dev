"use client";

/**
 * Install: npm install @emoji-mart/react @emoji-mart/data
 *
 * EmojiPickerPopover wraps emoji-mart inside a shadcn Popover.
 * The Picker is dynamically imported to avoid SSR issues.
 */
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Smile } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";

// Dynamically imported to avoid SSR issues with emoji-mart
const EmojiMartPicker = dynamic(
  () => import("@emoji-mart/react").then((m) => m.default ?? m),
  {
    ssr: false,
    loading: () => (
      <div className="h-87.5 w-88 flex items-center justify-center text-muted-foreground text-xs">
        Chargement…
      </div>
    ),
  },
);

interface EmojiPickerPopoverProps {
  onSelect: (emoji: { native: string }) => void;
  /** Theme of the picker — "light" | "dark" | "auto" */
  theme?: "light" | "dark" | "auto";
}

export function EmojiPickerPopover({
  onSelect,
  theme = "auto",
}: EmojiPickerPopoverProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Emoji"
          className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-primary hover:bg-primary/8 transition-colors"
        >
          <Smile className="h-4.5 w-4.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="p-0 border-0 shadow-xl bg-transparent w-auto"
        sideOffset={8}
      >
        <EmojiMartPicker
          data={async () => {
            const response = await fetch(
              "https://cdn.jsdelivr.net/npm/@emoji-mart/data",
            );
            return response.json();
          }}
          onEmojiSelect={(emoji: { native: string }) => {
            onSelect(emoji);
            setOpen(false);
          }}
          theme={theme}
          locale="fr"
          previewPosition="none"
          skinTonePosition="none"
          searchPosition="top"
          navPosition="bottom"
          perLine={8}
        />
      </PopoverContent>
    </Popover>
  );
}
