"use client";

/**
 * @file features/inbox/pages/inbox.page.tsx
 *
 * Root layout for the inbox feature.
 *
 * Layout:
 *   ┌─────────────────────────────────────────┐
 *   │  ConvList (320px fixed)  │  ChatView    │
 *   │  ← full width on mobile  │  flex-1      │
 *   └─────────────────────────────────────────┘
 *
 * Responsive:
 *   - Mobile: ConvList fills screen, ChatView hidden (and vice-versa)
 *   - Desktop: both panels visible side-by-side
 *
 * Real-time:
 *   - SSE stream established via useInboxSse inside useInbox
 *   - No polling required
 */

import { AddPresetDialog } from "../components/AddPresetDialog";
import { ChatView } from "../components/ChatView";
import { ConvList } from "../components/ConvList";
import { useInbox } from "../hooks/useInbox";
import type { PhotoPreset } from "../types/inbox.types";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

interface InboxPageProps {
  /** Current authenticated user ID — passed from the app auth context */
  userId?: string;
}

export function InboxPage({ userId }: InboxPageProps) {
  const inbox = useInbox(userId);

  if (!inbox.loadingConvs && inbox.accounts.length === 0) {
    return (
      <div className="flex h-[calc(100vh-20px)] items-center justify-center bg-background p-6">
        <Empty className="max-w-xl border">
          <EmptyHeader>
            <EmptyTitle>Aucune page Facebook connectee</EmptyTitle>
            <EmptyDescription>
              Connectez d&apos;abord une page Facebook pour charger vos conversations dans l&apos;Inbox.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href="/facebook-page">Connecter une page Facebook</Link>
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  // Guard: no selected conversation yet (loading or empty inbox)
  const showChat = !!inbox.selected;

  return (
    <div className="flex h-[calc(100vh-20px)] overflow-hidden bg-background">
      {/* ── Left panel ── */}
      <ConvList
        accounts={inbox.accounts}
        activeAcc={inbox.activeAcc}
        onChangeAcc={inbox.setActiveAcc}
        convs={inbox.convs}
        loading={inbox.loadingConvs}
        selected={inbox.selected}
        onSelect={inbox.handleSelectConv}
        searchQuery={inbox.searchQuery}
        onSearchChange={inbox.setSearchQuery}
        className={
          inbox.showList ? "w-full sm:w-[320px]" : "hidden sm:flex sm:w-[320px]"
        }
      />

      {/* ── Right panel ── */}
      {showChat && inbox.selected && (
        <ChatView
          selected={inbox.selected}
          onBack={() => inbox.setShowList(true)}
          isOnline={inbox.selected.online ?? false}
          convMode={inbox.convMode}
          onModeChange={inbox.setConvMode}
          msgs={inbox.msgs}
          hasMore={inbox.hasMore}
          loadingMsgs={inbox.loadingMsgs}
          onLoadMore={inbox.loadMore}
          pendingPhotos={inbox.pendingPhotos}
          pendingFile={inbox.pendingFile}
          pendingPreset={inbox.pendingPreset}
          onRemovePhoto={(i) =>
            inbox.setPendingPhotos((p) => p.filter((_, j) => j !== i))
          }
          onRemoveFile={() => inbox.setPendingFile(null)}
          onRemovePendingPreset={() => inbox.setPendingPreset(null)}
          presets={inbox.presets}
          onSelectPreset={(p) => {
            inbox.setPendingPreset(p);
            inbox.setMessage(p.description);
          }}
          onOpenAddPreset={() => inbox.setAddPresetOpen(true)}
          onRemovePreset={inbox.removePreset}
          message={inbox.message}
          onMessageChange={inbox.setMessage}
          canSend={inbox.canSend}
          onSend={inbox.handleSend}
          onEmojiSelect={inbox.handleEmojiSelect}
          photoRef={inbox.photoRef}
          fileRef={inbox.fileRef}
          bottomRef={inbox.bottomRef}
          textareaRef={inbox.textareaRef}
          onPhotoFiles={inbox.handlePhotoFiles}
          onFileSelect={inbox.handleFileSelect}
          className={!inbox.showList ? "flex" : "hidden sm:flex"}
        />
      )}

      {/* ── Add preset dialog ── */}
      <AddPresetDialog
        open={inbox.addPresetOpen}
        onClose={() => inbox.setAddPresetOpen(false)}
        onAdd={(p) =>
          inbox.addPreset(p as Omit<PhotoPreset, "id"> & { files: File[] })
        }
      />
    </div>
  );
}
