"use client";

/**
 * @file features/inbox/pages/inbox.page.tsx
 * Root layout for the inbox.
 *
 * NOTE: This component uses useSearchParams (via useInbox) which requires
 * a Suspense boundary in Next.js App Router. The default export wraps
 * InboxPage in <Suspense> so callers don't need to worry about it.
 *
 * CHANGES (realtime + mobile upgrade):
 *   - 100vh → 100dvh: on mobile browsers the address bar resizing the
 *     visual viewport used to make the page jump/clip; dvh tracks the real
 *     available height so the inbox always fits in exactly one screen.
 *   - Mobile navigation between the conversation list and the chat is now a
 *     real sliding transition (translate-x + transition-transform) instead
 *     of an instant hidden/flex swap — both panels stay mounted and slide
 *     past each other, which is both smoother and avoids remounting/losing
 *     scroll position when going back and forth.
 *   - sseStatus renamed wsStatus; ChatView now also receives isAiTyping,
 *     newMessageIds, and the suggestion state + handlers.
 *   - The "no conversation" empty placeholder now follows the same
 *     mobile show/hide rule as ChatView so it never doubles up with a
 *     full-width conversation list on small screens.
 */

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Loader2, MessageSquareDashed, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { AddPresetDialog } from "../components/AddPresetDialog";
import { ChatView } from "../components/ChatView";
import { ConvList } from "../components/ConvList";
import { InboxInfoPanel } from "../components/InboxInfoPanel";
import { InboxSettingsDrawer } from "../components/InboxSettingsDrawer";
import { useInbox } from "../hooks/useInbox";
import type { PhotoPreset } from "../types/inbox.types";

/** Full height on exactly one mobile screen, no matter the browser chrome. */
const PAGE_HEIGHT = "h-[calc(100dvh-20px)]";

export function InboxPage() {
  return (
    <Suspense fallback={null}>
      <InboxPageInner />
    </Suspense>
  );
}

function InboxPageInner() {
  const inbox = useInbox();

  // ── Empty state: no Facebook page connected ────────────────────────────────
  if (
    !inbox.loadingConvs &&
    !inbox.isInitialSyncing &&
    inbox.accounts.length === 0
  ) {
    return (
      <div className={`flex ${PAGE_HEIGHT} items-center justify-center bg-background p-6`}>
        <Empty className="max-w-xl border">
          <EmptyHeader>
            <EmptyTitle>Aucune page Facebook connectée</EmptyTitle>
            <EmptyDescription>
              Connectez d&apos;abord une page Facebook pour charger vos
              conversations.
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

  // ── Deep-link resolution screen ────────────────────────────────────────────
  // Shown briefly while /inbox?conv=<id> is being resolved — e.g. when the
  // linked conversation belongs to a different connected page than the one
  // shown by default, and we need to switch pages before opening the chat.
  if (inbox.resolvingDeepLink) {
    return (
      <div className={`flex ${PAGE_HEIGHT} items-center justify-center bg-background`}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 text-primary animate-spin" />
          <p className="text-xs text-muted-foreground">
            Ouverture de la conversation…
          </p>
        </div>
      </div>
    );
  }

  // ── Initial sync loading screen ────────────────────────────────────────────
  if (inbox.isInitialSyncing) {
    return (
      <div className={`flex ${PAGE_HEIGHT} items-center justify-center bg-background`}>
        <div className="flex flex-col items-center gap-5 max-w-xs text-center px-6">
          {/* Animated icon */}
          <div className="relative">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <MessageSquareDashed className="h-8 w-8 text-primary" />
            </div>
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-background border-2 border-background flex items-center justify-center">
              <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
            </span>
          </div>

          <div>
            <p className="text-sm font-semibold mb-1">
              Chargement de vos conversations
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Nous récupérons vos 40 dernières conversations et leurs messages
              depuis Facebook. Cela ne prend que quelques secondes.
            </p>
          </div>

          {/* Progress indicator dots */}
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-primary/40 animate-pulse"
                style={{ animationDelay: `${i * 200}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const showChat = !!inbox.selected;
  // On mobile exactly one of {list, chat} is visible, sliding in/out; on
  // sm+ both are always visible side by side and the transforms are neutralised.
  const listSlideClass = inbox.showList
    ? "translate-x-0"
    : "-translate-x-full sm:translate-x-0";
  const chatSlideClass = inbox.showList
    ? "translate-x-full sm:translate-x-0"
    : "translate-x-0";
  const slideBase =
    "absolute inset-0 sm:relative sm:inset-auto transition-transform duration-300 ease-out will-change-transform";

  return (
    <div className={`flex ${PAGE_HEIGHT} overflow-hidden bg-background relative`}>
      {/* ── Left panel: conversation list ── */}
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
        wsStatus={inbox.wsStatus}
        onOpenSettings={() => inbox.setSettingsOpen(true)}
        compactMode={inbox.uiPrefs.compactMode}
        className={`${slideBase} ${listSlideClass} w-full sm:w-85 sm:max-w-85 sm:basis-85 xl:w-90 xl:max-w-90 xl:basis-90`}
      />

      {/* ── Right panel: chat ── */}
      {showChat && inbox.selected ? (
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
          isSyncing={inbox.isSyncing}
          wsStatus={inbox.wsStatus}
          isAiTyping={inbox.isAiTyping}
          newMessageIds={inbox.newMessageIds}
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
          suggestion={inbox.suggestion}
          onRequestSuggestion={inbox.requestSuggestion}
          onAcceptSuggestion={inbox.acceptSuggestion}
          onDismissSuggestion={inbox.dismissSuggestion}
          infoPanel={<InboxInfoPanel wsStatus={inbox.wsStatus} />}
          className={`${slideBase} ${chatSlideClass} flex flex-col`}
        />
      ) : /* No conversation selected — placeholder */
      !inbox.loadingConvs &&
        inbox.initialSyncDone &&
        inbox.convs.length === 0 ? (
        <div
          className={`${slideBase} ${chatSlideClass} sm:flex-1 flex items-center justify-center`}
        >
          <div className="flex flex-col items-center gap-3 text-center px-8">
            <div className="h-12 w-12 rounded-2xl bg-secondary flex items-center justify-center">
              <MessageSquareDashed className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold">Aucune conversation</p>
              <p className="text-xs text-muted-foreground mt-1">
                Les conversations arriveront ici lorsque des clients vous
                écriront.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs mt-1"
              onClick={() => {
                if (inbox.activeAcc) inbox.setActiveAcc(inbox.activeAcc);
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Actualiser
            </Button>
          </div>
        </div>
      ) : null}

      {/* ── Dialogs ── */}
      <AddPresetDialog
        open={inbox.addPresetOpen}
        onClose={() => inbox.setAddPresetOpen(false)}
        onAdd={(p) =>
          inbox.addPreset(p as Omit<PhotoPreset, "id"> & { files: File[] })
        }
      />

      <InboxSettingsDrawer
        open={inbox.settingsOpen}
        onClose={() => inbox.setSettingsOpen(false)}
        uiPrefs={inbox.uiPrefs}
        onUpdateUiPrefs={inbox.updateUiPrefs}
      />
    </div>
  );
}
