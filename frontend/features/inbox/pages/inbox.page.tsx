"use client";

import { AddPresetDialog } from "../components/AddPresetDialog";
import { ChatView } from "../components/ChatView";
import { ConvList } from "../components/ConvList";
import { CONVS } from "../data/inbox.mock";
import { useInbox } from "../hooks/useInbox";

/**
 * InboxPage — root layout:
 *  h-screen overflow-hidden  →  page never taller than viewport
 *  ConvList  |  ChatView     →  flex, each internally scrollable
 */
export function InboxPage() {
  const inbox = useInbox();

  const isOnline =
    CONVS[inbox.activeAcc.id]?.find((c) => c.id === inbox.selected.id)
      ?.online ?? false;

  return (
    /* Screen height minus 10px */
    <div className="flex h-[calc(100vh-20px)] overflow-hidden bg-background">
      {/* ── Left panel — conversation list ── */}
      <ConvList
        activeAcc={inbox.activeAcc}
        onChangeAcc={(acc) => {
          inbox.setActiveAcc(acc);
          const firstConv = CONVS[acc.id]?.[0];
          if (firstConv) inbox.handleSelectConv(firstConv);
        }}
        convs={inbox.convs}
        selected={inbox.selected}
        onSelect={inbox.handleSelectConv}
        searchQuery={inbox.searchQuery}
        onSearchChange={inbox.setSearchQuery}
        className={
          inbox.showList ? "w-full sm:w-[320px]" : "hidden sm:flex sm:w-[320px]"
        }
      />

      {/* ── Right panel — chat view ── */}
      <ChatView
        selected={inbox.selected}
        onBack={() => inbox.setShowList(true)}
        isOnline={isOnline}
        convMode={inbox.convMode}
        onModeChange={inbox.setConvMode}
        visibleMsgs={inbox.visibleMsgs}
        hasMore={inbox.hasMore}
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
        onOpenAddPreset={() => {
          inbox.setAddPresetOpen(true);
        }}
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

      {/* ── Add preset dialog ── */}
      <AddPresetDialog
        open={inbox.addPresetOpen}
        onClose={() => inbox.setAddPresetOpen(false)}
        onAdd={inbox.addPreset}
      />
    </div>
  );
}
