"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  IconCamera,
  IconCheck,
  IconChecks,
  IconFile,
  IconInfoCircle,
  IconSend,
} from "@tabler/icons-react";
import { ChevronLeft, Loader2 } from "lucide-react";
import type { RefObject } from "react";
import type {
  Conv,
  ConvMode,
  FileAttachment,
  Msg,
  PhotoAttachment,
  PhotoPreset,
} from "../types/inbox.types";
import { groupByDate } from "../utils/inbox.utils";
import { AttachmentPreview } from "./AttachmentPreview";
import { EmojiPickerPopover } from "./EmojiPickerPopover";
import { FileBubble } from "./FileBubble";
import { ModeToggle } from "./ModeToggle";
import { PhotoGrid } from "./PhotoGrid";
import { PhotoPresetSheet } from "./PhotoPresetSheet";

interface ChatViewProps {
  selected: Conv;
  onBack: () => void;
  isOnline: boolean;
  convMode: ConvMode;
  onModeChange: (mode: ConvMode) => void;
  /* messages */
  visibleMsgs: Msg[];
  hasMore: boolean;
  onLoadMore: () => void;
  /* attachments */
  pendingPhotos: PhotoAttachment[];
  pendingFile: FileAttachment | null;
  pendingPreset: PhotoPreset | null;
  onRemovePhoto: (i: number) => void;
  onRemoveFile: () => void;
  onRemovePendingPreset: () => void;
  /* presets */
  presets: PhotoPreset[];
  onSelectPreset: (p: PhotoPreset) => void;
  onOpenAddPreset: () => void;
  onRemovePreset: (id: number) => void;
  /* input */
  message: string;
  onMessageChange: (v: string) => void;
  canSend: boolean;
  onSend: () => void;
  onEmojiSelect: (e: { native: string }) => void;
  /* file refs */
  photoRef: RefObject<HTMLInputElement | null>;
  fileRef: RefObject<HTMLInputElement | null>;
  bottomRef: RefObject<HTMLDivElement | null>;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onPhotoFiles: (files: FileList | null) => void;
  onFileSelect: (files: FileList | null) => void;
  className?: string;
}

export function ChatView({
  selected,
  onBack,
  isOnline,
  convMode,
  onModeChange,
  visibleMsgs,
  hasMore,
  onLoadMore,
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
  className = "",
}: ChatViewProps) {
  const grouped = groupByDate(visibleMsgs);

  return (
    <div
      className={`flex flex-col flex-1 min-w-0 overflow-hidden ${className}`}
    >
      {/* ── Chat header ── */}
      <div className="flex items-center justify-between gap-3 border-b border-border/40 px-4 h-15 shrink-0 bg-background/80 backdrop-blur-sm">
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
            <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center text-sm font-bold">
              {selected.initials}
            </div>
            {isOnline && (
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-background" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold truncate">{selected.client}</p>
            <p className="text-xs text-muted-foreground">
              {isOnline ? "En ligne" : "Vu récemment"}
            </p>
          </div>
        </div>

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

          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
            <IconInfoCircle className="h-4.5 w-4.5" />
          </Button>
        </div>
      </div>

      {/* ── Messages — ScrollArea fills remaining height ── */}
      <ScrollArea className="flex-1 min-h-0 bg-background">
        <div className="px-4 py-4 max-w-full">
          {/* Load more button */}
          {hasMore && (
            <div className="flex justify-center mb-4">
              <button
                onClick={onLoadMore}
                className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 transition-colors bg-primary/5 hover:bg-primary/10 rounded-full px-4 py-2"
              >
                <Loader2 className="h-3.5 w-3.5" />
                Charger les messages précédents
              </button>
            </div>
          )}

          {grouped.map(({ date, messages }) => (
            <div key={date}>
              {/* Date separator */}
              <div className="flex items-center justify-center my-4">
                <span className="text-xs text-muted-foreground font-medium bg-background px-3 py-1 rounded-full border border-border/30">
                  {date}
                </span>
              </div>

              {messages.map((msg, mi) => (
                <MessageRow
                  key={msg.id}
                  msg={msg}
                  prevMsg={messages[mi - 1]}
                  nextMsg={messages[mi + 1]}
                  clientInitials={selected.initials[0]}
                />
              ))}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* ── Input bar — never overflows ── */}
      <div className="border-t border-border/40 bg-background shrink-0">
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
          <button
            type="button"
            onClick={() => photoRef.current?.click()}
            className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-primary hover:bg-primary/8 transition-colors"
          >
            <IconCamera className="h-4.5 w-4.5" />
          </button>
          <input
            ref={photoRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={(e) => {
              onPhotoFiles(e.target.files);
              e.target.value = "";
            }}
          />

          {/* File */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-primary hover:bg-primary/8 transition-colors"
          >
            <IconFile className="h-4.5 w-4.5" />
          </button>
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

          {/* Textarea */}
          <Textarea
            ref={textareaRef}
            placeholder="Écrire un message…"
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            rows={1}
            className="flex-1 resize-none text-sm min-h-9 max-h-36 rounded-2xl border-0 bg-[#F0F2F5] dark:bg-[#3A3B3C] focus-visible:ring-1 focus-visible:ring-primary/50 py-2 px-4 leading-relaxed"
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
            className="h-9 w-9 rounded-full shrink-0 bg-primary hover:bg-primary/90"
            disabled={!canSend}
            onClick={onSend}
          >
            <IconSend className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── MessageRow — isolated to reduce re-renders ─── */
function getBubbleRadius(
  isClient: boolean,
  prevSame: boolean,
  nextSame: boolean,
): string {
  if (isClient) {
    if (!prevSame && !nextSame) return "rounded-2xl rounded-bl-md";
    if (!prevSame && nextSame) return "rounded-2xl rounded-bl-sm";
    if (prevSame && nextSame) return "rounded-2xl rounded-l-sm";
    return "rounded-2xl rounded-tl-sm";
  } else {
    if (!prevSame && !nextSame) return "rounded-2xl rounded-br-md";
    if (!prevSame && nextSame) return "rounded-2xl rounded-br-sm";
    if (prevSame && nextSame) return "rounded-2xl rounded-r-sm";
    return "rounded-2xl rounded-tr-sm";
  }
}

interface MessageRowProps {
  msg: Msg;
  prevMsg?: Msg;
  nextMsg?: Msg;
  clientInitials: string;
}

function MessageRow({
  msg,
  prevMsg,
  nextMsg,
  clientInitials,
}: MessageRowProps) {
  const isClient = msg.sender === "client";
  const isAI = msg.sender === "ai";
  const prevSame = prevMsg?.sender === msg.sender;
  const nextSame = nextMsg?.sender === msg.sender;
  const br =
    msg.kind === "photos" ? "" : getBubbleRadius(isClient, prevSame, nextSame);

  return (
    <div
      className={`flex items-end gap-2 ${isClient ? "justify-start" : "justify-end"} ${prevSame ? "mt-0.5" : "mt-3"}`}
    >
      {/* Client avatar */}
      {isClient && !prevSame ? (
        <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold shrink-0 mb-1">
          {clientInitials}
        </div>
      ) : isClient ? (
        <div className="w-8 shrink-0" />
      ) : null}

      <div
        className={`flex flex-col ${isClient ? "items-start" : "items-end"} max-w-[75%]`}
      >
        {/* Sender label */}
        {!prevSame && !isClient && (
          <p className="text-[11px] text-muted-foreground mb-1 px-1">
            {isAI ? "VendeoAI 🤖" : "Vous 👤"}
          </p>
        )}

        {/* Text bubble */}
        {msg.kind === "text" && (
          <div
            className={`px-4 py-2.5 text-[14.5px] leading-relaxed ${br} ${
              isClient
                ? "bg-[#F0F2F5] dark:bg-[#3A3B3C] text-foreground"
                : isAI
                  ? "bg-primary text-primary-foreground"
                  : "bg-[#0084FF] text-white"
            }`}
          >
            {msg.content}
          </div>
        )}

        {/* Photos */}
        {msg.kind === "photos" && msg.photos && (
          <PhotoGrid photos={msg.photos} />
        )}

        {/* File */}
        {msg.kind === "file" && msg.file && (
          <FileBubble file={msg.file} isClient={isClient} />
        )}

        {/* Reactions */}
        {msg.reactions && msg.reactions.length > 0 && (
          <div className={`flex gap-0.5 -mt-1 ${isClient ? "ml-2" : "mr-2"}`}>
            <div className="flex items-center gap-0.5 bg-card border border-border/50 rounded-full px-1.5 py-0.5 shadow-sm">
              {msg.reactions.map((r, i) => (
                <span key={i} className="text-xs">
                  {r}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Timestamp + delivery status */}
        {!nextSame && (
          <div
            className={`flex items-center gap-1 mt-1 px-0.5 ${isClient ? "" : "flex-row-reverse"}`}
          >
            <span className="text-[11px] text-muted-foreground">
              {msg.time}
            </span>
            {!isClient &&
              (msg.pending ? (
                <IconCheck className="h-3 w-3 text-muted-foreground" />
              ) : (
                <IconChecks className="h-3.5 w-3.5 text-primary" />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
