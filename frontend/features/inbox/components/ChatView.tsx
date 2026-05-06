"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  IconCamera,
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
import { MessageRow } from "./MessageRow";
import { ModeToggle } from "./ModeToggle";
import { PhotoPresetSheet } from "./PhotoPresetSheet";

interface ChatViewProps {
  selected: Conv;
  onBack: () => void;
  isOnline: boolean;
  convMode: ConvMode;
  onModeChange: (mode: ConvMode) => void;

  // Messages
  msgs: Msg[];
  hasMore: boolean;
  loadingMsgs: boolean;
  onLoadMore: () => void;

  // Attachments
  pendingPhotos: PhotoAttachment[];
  pendingFile: FileAttachment | null;
  pendingPreset: PhotoPreset | null;
  onRemovePhoto: (i: number) => void;
  onRemoveFile: () => void;
  onRemovePendingPreset: () => void;

  // Presets
  presets: PhotoPreset[];
  onSelectPreset: (p: PhotoPreset) => void;
  onOpenAddPreset: () => void;
  onRemovePreset: (id: string) => void;

  // Input
  message: string;
  onMessageChange: (v: string) => void;
  canSend: boolean;
  onSend: () => void;
  onEmojiSelect: (e: { native: string }) => void;

  // Refs
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
  msgs,
  hasMore,
  loadingMsgs,
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
  const grouped = groupByDate(msgs);

  return (
    <div
      className={`flex flex-col flex-1 min-w-0 overflow-hidden ${className}`}
    >
      {/* ── Header ── */}
      <ChatHeader
        conv={selected}
        isOnline={isOnline}
        convMode={convMode}
        onModeChange={onModeChange}
        onBack={onBack}
        presets={presets}
        onSelectPreset={(p) => {
          onSelectPreset(p);
          textareaRef.current?.focus();
        }}
        onOpenAddPreset={onOpenAddPreset}
        onRemovePreset={onRemovePreset}
      />

      {/* ── Messages ── */}
      <ScrollArea className="flex-1 min-h-0 bg-background">
        <div className="px-4 py-4 max-w-full">
          {/* Load-older button */}
          {hasMore && (
            <div className="flex justify-center mb-4">
              <button
                onClick={onLoadMore}
                className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 rounded-full px-4 py-2 transition-colors"
              >
                <Loader2 className="h-3.5 w-3.5" />
                Charger les messages précédents
              </button>
            </div>
          )}

          {/* Loading skeleton when fetching messages */}
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
                />
              ))}
            </div>
          ))}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* ── Input bar ── */}
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
          <IconButton
            label="Photo"
            onClick={() => photoRef.current?.click()}
            icon={<IconCamera className="h-4.5 w-4.5" />}
          />
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
          <IconButton
            label="Fichier"
            onClick={() => fileRef.current?.click()}
            icon={<IconFile className="h-4.5 w-4.5" />}
          />
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

          {/* Text input */}
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

// ─── Sub-components ────────────────────────────────────────────────────────────

interface ChatHeaderProps {
  conv: Conv;
  isOnline: boolean;
  convMode: ConvMode;
  onModeChange: (mode: ConvMode) => void;
  onBack: () => void;
  presets: PhotoPreset[];
  onSelectPreset: (p: PhotoPreset) => void;
  onOpenAddPreset: () => void;
  onRemovePreset: (id: string) => void;
}

function ChatHeader({
  conv,
  isOnline,
  convMode,
  onModeChange,
  onBack,
  presets,
  onSelectPreset,
  onOpenAddPreset,
  onRemovePreset,
}: ChatHeaderProps) {
  return (
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
            <AvatarImage src={conv.avatarUrl ?? undefined} alt={conv.client} />
            <AvatarFallback className="text-sm font-bold">
              {conv.initials}
            </AvatarFallback>
          </Avatar>
          {isOnline && (
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-background" />
          )}
        </div>

        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{conv.client}</p>
          <p className="text-[11px] text-muted-foreground">
            {isOnline ? "En ligne" : "Vu récemment"}
          </p>
        </div>
      </div>

      {/* Right: mode toggle + presets + info */}
      <div className="flex items-center gap-1.5 shrink-0">
        <ModeToggle mode={convMode} onChange={onModeChange} />

        <PhotoPresetSheet
          presets={presets}
          onSelectPreset={onSelectPreset}
          onOpenAdd={onOpenAddPreset}
          onRemovePreset={onRemovePreset}
        />

        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
          <IconInfoCircle className="h-4.5 w-4.5" />
        </Button>
      </div>
    </div>
  );
}

function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center my-4">
      <span className="text-xs text-muted-foreground font-medium bg-background px-3 py-1 rounded-full border border-border/30">
        {label}
      </span>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-primary hover:bg-primary/8 transition-colors"
    >
      {icon}
    </button>
  );
}

function MessagesSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className={`flex items-end gap-2 ${i % 2 === 0 ? "justify-start" : "justify-end"}`}
        >
          {i % 2 === 0 && (
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          )}
          <Skeleton
            className={`h-10 rounded-2xl ${i % 2 === 0 ? "w-48" : "w-40"}`}
          />
        </div>
      ))}
    </div>
  );
}
