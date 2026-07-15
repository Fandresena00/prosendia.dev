"use client";

/**
 * @file features/inbox/components/ChatView.tsx
 * Right-panel chat view with message list, input bar, and sync indicator.
 *
 * CHANGES (realtime upgrade):
 *   - sseStatus prop renamed to wsStatus (WebSocket, not SSE).
 *   - isAiTyping renders <AiTypingBubble/> under the message list.
 *   - When selected.canSendFreeform is false (Messenger 24h window closed),
 *     the entire composer is replaced by <MessagingWindowClosedBanner/>.
 *   - New Sparkles button triggers an AI reply suggestion; <SuggestionBar/>
 *     appears above the composer while it streams in.
 *   - newMessageIds drives a one-shot entrance animation on freshly-arrived
 *     bubbles (MessageRow's `isNew` prop) — history loaded on open/scroll
 *     does not animate, only realtime arrivals do.
 */

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { IconCamera, IconFile, IconSend } from "@tabler/icons-react";
import { ChevronLeft, Loader2, RefreshCw, Sparkles } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import type {
  Conv,
  ConvMode,
  FileAttachment,
  Msg,
  PhotoAttachment,
  PhotoPreset,
} from "../types/inbox.types";
import type { SuggestionStatus } from "../hooks/useInbox";
import { groupByDate } from "../utils/inbox.utils";
import { AiTypingBubble } from "./AiTypingBubble";
import { AttachmentPreview } from "./AttachmentPreview";
import { EmojiPickerPopover } from "./EmojiPickerPopover";
import { MessagingWindowClosedBanner } from "./MessagingWindowClosedBanner";
import { MessageRow } from "./MessageRow";
import { ModeToggle } from "./ModeToggle";
import { PhotoPresetSheet } from "./PhotoPresetSheet";
import { SuggestionBar } from "./SuggestionBar";

interface ChatViewProps {
  selected: Conv;
  onBack: () => void;
  isOnline: boolean;
  convMode: ConvMode;
  onModeChange: (mode: ConvMode) => void;
  msgs: Msg[];
  hasMore: boolean;
  loadingMsgs: boolean;
  onLoadMore: () => void;
  isSyncing?: boolean;
  wsStatus?: "connecting" | "connected" | "error";
  isAiTyping?: boolean;
  newMessageIds?: Set<string>;
  pendingPhotos: PhotoAttachment[];
  pendingFile: FileAttachment | null;
  pendingPreset: PhotoPreset | null;
  onRemovePhoto: (i: number) => void;
  onRemoveFile: () => void;
  onRemovePendingPreset: () => void;
  presets: PhotoPreset[];
  onSelectPreset: (p: PhotoPreset) => void;
  onOpenAddPreset: () => void;
  onRemovePreset: (id: string) => void;
  message: string;
  onMessageChange: (v: string) => void;
  canSend: boolean;
  onSend: () => void;
  onEmojiSelect: (e: { native: string }) => void;
  photoRef: RefObject<HTMLInputElement | null>;
  fileRef: RefObject<HTMLInputElement | null>;
  bottomRef: RefObject<HTMLDivElement | null>;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onPhotoFiles: (files: FileList | null) => void;
  onFileSelect: (files: FileList | null) => void;
  suggestion: { status: SuggestionStatus; text: string; error: string | null };
  onRequestSuggestion: () => void;
  onAcceptSuggestion: () => void;
  onDismissSuggestion: () => void;
  infoPanel?: ReactNode;
  className?: string;
}

export function ChatView({
  selected,
  onBack,
  isOnline,
  convMode,
  onModeChange,
  msgs,
  hasMore,
  loadingMsgs,
  onLoadMore,
  isSyncing = false,
  isAiTyping = false,
  newMessageIds,
  pendingPhotos,
  pendingFile,
  pendingPreset,
  onRemovePhoto,
  onRemoveFile,
  onRemovePendingPreset,
  presets,
  onSelectPreset,
  onOpenAddPreset,
  onRemovePreset,
  message,
  onMessageChange,
  canSend,
  onSend,
  onEmojiSelect,
  photoRef,
  fileRef,
  bottomRef,
  textareaRef,
  onPhotoFiles,
  onFileSelect,
  suggestion,
  onRequestSuggestion,
  onAcceptSuggestion,
  onDismissSuggestion,
  infoPanel,
  className = "",
}: ChatViewProps) {
  const grouped = groupByDate(msgs);
  const suggestionActive = suggestion.status !== "idle";
  const suggestionBusy = suggestion.status === "loading" || suggestion.status === "streaming";

  return (
    <div
      className={`flex flex-col flex-1 min-w-0 overflow-hidden ${className}`}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 border-b border-border/40 px-4 h-14 shrink-0 bg-background/80 backdrop-blur-sm">
        {/* Left: back + avatar + name */}
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            className="sm:hidden h-8 w-8 rounded-full shrink-0"
            onClick={onBack}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          <div className="relative shrink-0">
            <Avatar className="h-9 w-9">
              <AvatarImage
                src={selected.avatarUrl ?? undefined}
                alt={selected.client}
              />
              <AvatarFallback className="text-sm font-bold">
                {selected.initials}
              </AvatarFallback>
            </Avatar>
            {isOnline && (
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-background" />
            )}
          </div>

          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{selected.client}</p>
            <div className="flex items-center gap-1.5">
              <p className="text-[11px] text-muted-foreground">
                {isOnline ? "En ligne" : "Vu récemment"}
              </p>
              {/* Sync indicator — shows while sync-on-open runs */}
              {isSyncing && (
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                  sync…
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: mode toggle + presets + info panel */}
        <div className="flex items-center gap-1.5 shrink-0">
          <ModeToggle mode={convMode} onChange={onModeChange} />
          <PhotoPresetSheet
            presets={presets}
            onSelectPreset={(p) => {
              onSelectPreset(p);
              textareaRef.current?.focus();
            }}
            onOpenAdd={onOpenAddPreset}
            onRemovePreset={onRemovePreset}
          />
          {infoPanel}
        </div>
      </div>

      {/* ── Messages ── */}
      <ScrollArea className="flex-1 min-h-0 bg-background">
        <div className="px-4 py-4 max-w-full">
          {/* Load older button */}
          {hasMore && (
            <div className="flex justify-center mb-4">
              <button
                onClick={onLoadMore}
                className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 rounded-full px-4 py-1.5 transition-colors"
              >
                <Loader2 className="h-3.5 w-3.5" />
                Charger les messages précédents
              </button>
            </div>
          )}

          {/* Loading skeleton */}
          {loadingMsgs && msgs.length === 0 && <MessagesSkeleton />}

          {/* Grouped by date */}
          {grouped.map(({ date, messages }) => (
            <div key={date}>
              <DateSeparator label={date} />
              {messages.map((msg, mi) => (
                <MessageRow
                  key={msg.id}
                  msg={msg}
                  prevMsg={messages[mi - 1]}
                  nextMsg={messages[mi + 1]}
                  clientInitials={selected.initials}
                  clientAvatarUrl={selected.avatarUrl}
                  isNew={newMessageIds?.has(msg.id) ?? false}
                />
              ))}
            </div>
          ))}

          {/* AI composing a reply */}
          {isAiTyping && <AiTypingBubble />}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* ── Input bar (or 24h window closed banner) ── */}
      <div className="border-t border-border/40 bg-background/95 backdrop-blur-sm shrink-0">
        {selected.canSendFreeform ? (
          <>
            {suggestionActive && (
              <SuggestionBar
                status={suggestion.status}
                text={suggestion.text}
                error={suggestion.error}
                onAccept={onAcceptSuggestion}
                onDismiss={onDismissSuggestion}
              />
            )}

            <AttachmentPreview
              photos={pendingPhotos}
              file={pendingFile}
              preset={pendingPreset}
              onRemovePhoto={onRemovePhoto}
              onRemoveFile={onRemoveFile}
              onRemovePreset={onRemovePendingPreset}
            />

            <div className="flex items-end gap-1.5 px-3 py-2.5">
              {/* Camera */}
              <ActionButton label="Photo" onClick={() => photoRef.current?.click()}>
                <IconCamera className="h-4.5 w-4.5" />
              </ActionButton>
              <input
                ref={photoRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  onPhotoFiles(e.target.files);
                  e.target.value = "";
                }}
              />

              {/* File */}
              <ActionButton
                label="Fichier"
                onClick={() => fileRef.current?.click()}
              >
                <IconFile className="h-4.5 w-4.5" />
              </ActionButton>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  onFileSelect(e.target.files);
                  e.target.value = "";
                }}
              />

              {/* Emoji */}
              <EmojiPickerPopover onSelect={onEmojiSelect} />

              {/* AI suggestion */}
              <ActionButton
                label="Suggestion IA"
                onClick={onRequestSuggestion}
                disabled={suggestionBusy}
                active={suggestionActive}
              >
                <Sparkles className={`h-4.5 w-4.5 ${suggestionBusy ? "animate-pulse" : ""}`} />
              </ActionButton>

              {/* Text input */}
              <Textarea
                ref={textareaRef}
                placeholder="Écrire un message…"
                value={message}
                onChange={(e) => onMessageChange(e.target.value)}
                rows={1}
                className="flex-1 resize-none text-sm min-h-9 max-h-36 rounded-2xl border-0 bg-[#F0F2F5] dark:bg-[#3A3B3C] focus-visible:ring-1 focus-visible:ring-primary/50 py-2 px-4 leading-relaxed transition-shadow"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onSend();
                  }
                }}
              />

              {/* Send */}
              <Button
                size="icon"
                className="h-9 w-9 rounded-full shrink-0 bg-primary hover:bg-primary/90 transition-all active:scale-95"
                disabled={!canSend}
                onClick={onSend}
              >
                <IconSend className="h-4 w-4" />
              </Button>
            </div>
          </>
        ) : (
          <MessagingWindowClosedBanner
            clientName={selected.client}
            messengerDeepLink={selected.messengerDeepLink}
          />
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center my-4">
      <span className="text-xs text-muted-foreground font-medium bg-background px-3 py-1 rounded-full border border-border/30">
        {label}
      </span>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  children,
  disabled = false,
  active = false,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 transition-colors active:scale-95 disabled:opacity-50 disabled:pointer-events-none ${
        active ? "bg-primary/10 text-primary" : "text-primary hover:bg-primary/8"
      }`}
    >
      {children}
    </button>
  );
}

function MessagesSkeleton() {
  return (
    <div className="space-y-4 py-2">
      {[
        { align: "start", w: "w-48" },
        { align: "end", w: "w-40" },
        { align: "start", w: "w-56" },
        { align: "end", w: "w-32" },
      ].map((row, i) => (
        <div key={i} className={`flex items-end gap-2 justify-${row.align}`}>
          {row.align === "start" && (
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          )}
          <Skeleton className={`h-10 rounded-2xl ${row.w}`} />
        </div>
      ))}
    </div>
  );
}
