"use client";

/**
 * @file features/inbox/hooks/useInbox.ts
 *
 * Central state manager for the inbox.
 * No userId parameter — authentication is handled server-side via cookies.
 *
 * Loading states:
 *   isInitialSyncing — full first sync running (40 conv × 200 msgs from Facebook)
 *   loadingConvs     — conversation list fetched from DB
 *   loadingMsgs      — messages loading on first open of a conversation
 *   isSyncing        — sync-on-open running per conversation
 *   wsStatus         — 'connecting' | 'connected' | 'error' (WebSocket, formerly SSE)
 *
 * CHANGES (realtime upgrade):
 *   - useInboxSse → useInboxWs (Socket.io). sseStatus renamed wsStatus.
 *   - aiTypingConvIds tracks which conversations currently show the
 *     "prosendia écrit…" bubble — set on ai_typing_start, cleared on
 *     ai_typing_stop, on the next new_message for that conversation, or
 *     after a 20s safety timeout (in case the AI worker never confirms).
 *   - newMessageIds tracks message ids that just arrived in realtime, for a
 *     one-shot entrance animation in MessageRow (cleared ~700ms later).
 *   - suggestion / requestSuggestion / acceptSuggestion / dismissSuggestion:
 *     drives the AI reply-suggestion button + SuggestionBar. Streamed chunks
 *     are matched against the active requestId so a stale response from a
 *     dismissed/superseded request can never overwrite a newer one.
 *   - canSend / handleSend now also require selectedConv.canSendFreeform —
 *     defensive guard in addition to ChatView swapping the composer for
 *     MessagingWindowClosedBanner once the Messenger 24h window is closed.
 */

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  createReferencePreset,
  deleteReferencePreset,
  fetchAccounts,
  fetchConversationById,
  fetchConversations,
  fetchMessages,
  fetchReferencePresets,
  getTempUploadUrl,
  loadUiPrefs,
  mapConversation,
  markConversationRead,
  performInitialSync,
  saveUiPrefs,
  sendFileMessage,
  sendImagesMessage,
  sendTextMessage,
  setHandover,
  syncConversationList,
  syncConversationOnOpen,
  type InboxUiPrefs,
} from "../services/inbox.service";
import { useInboxStore } from "../store/inbox.store";
import type {
  Account,
  Conv,
  ConvMode,
  FileAttachment,
  Msg,
  PhotoAttachment,
  PhotoPreset,
} from "../types/inbox.types";
import {
  apiMsgToUiMsg,
  formatMessageTime,
  messageApiToPreview,
  msgToPreview,
} from "../utils/api-msg-to-ui-msg";
import { useInboxWs } from "./use-inbox-ws";

// ─── Constants ────────────────────────────────────────────────────────────────

const CONV_POLL_MS = 30_000;
const MSG_POLL_MS = 8_000;
const MESSAGES_PER_PAGE = 30;

/** Safety net: auto-clear the "AI is typing" bubble if ai_typing_stop never arrives. */
const AI_TYPING_TIMEOUT_MS = 20_000;
/** How long a freshly-arrived message keeps its entrance animation flag. */
const NEW_MESSAGE_ANIMATION_MS = 700;

const GRADIENTS = [
  "from-blue-500/40 to-indigo-600/30",
  "from-violet-500/40 to-purple-600/30",
  "from-emerald-500/40 to-teal-600/30",
  "from-amber-500/40 to-orange-600/30",
  "from-rose-500/40 to-pink-600/30",
  "from-cyan-500/40 to-sky-600/30",
];

export type SuggestionStatus = "idle" | "loading" | "streaming" | "done" | "error";

interface SuggestionState {
  status:    SuggestionStatus;
  text:      string;
  error:     string | null;
  requestId: string | null;
}

const IDLE_SUGGESTION: SuggestionState = { status: "idle", text: "", error: null, requestId: null };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mergeWithOptimistic(fresh: Msg[], current: Msg[]): Msg[] {
  const freshIds = new Set(fresh.map((m) => m.id));
  const freshExtIds = new Set(fresh.map((m) => m.externalId).filter(Boolean));
  const stillPending = current.filter(
    (m) =>
      (m.pending || m.failed) &&
      !freshIds.has(m.id) &&
      !(m.externalId && freshExtIds.has(m.externalId)),
  );
  return [...fresh, ...stillPending];
}

let tmpCounter = 0;
const tmpId = (): string => `tmp-${Date.now()}-${++tmpCounter}`;
const nowTime = (): string =>
  new Date().toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useInbox() {
  // ── Store global (badge sidebar) ──────────────────────────────────────────
  const setInboxUnread = useInboxStore((s) => s.setUnreadCount);

  // ── Deep-link navigation (/inbox?conv=<id>) ──────────────────────────────
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Captured once on mount: the conv id the user landed on, if any.
  // Cleared as soon as it's been resolved (found & selected, or failed).
  // Using a ref (not state) so updating the URL ourselves never re-triggers
  // this deep-link resolution logic.
  const deepLinkConvIdRef = useRef<string | null>(searchParams.get("conv"));
  const deepLinkAttemptedRef = useRef<Set<string>>(new Set());
  const [resolvingDeepLink, setResolvingDeepLink] = useState(
    !!deepLinkConvIdRef.current,
  );

  // ── Accounts ──────────────────────────────────────────────────────────────
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAcc, setActiveAcc] = useState<Account | null>(null);

  // ── Conversations ─────────────────────────────────────────────────────────
  const [convs, setConvs] = useState<Conv[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conv | null>(null);
  const [showConvList, setShowConvList] = useState(true);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // ── Messages ──────────────────────────────────────────────────────────────
  const [messagesByConvId, setMessagesByConvId] = useState<
    Record<string, Msg[]>
  >({});
  const [cursorByConvId, setCursorByConvId] = useState<
    Record<string, string | null>
  >({});
  const [hasMoreByConvId, setHasMoreByConvId] = useState<
    Record<string, boolean>
  >({});
  const [loadingMessages, setLoadingMessages] = useState(false);
  /** Message ids that just arrived in realtime — drives MessageRow's entrance animation. */
  const [newMessageIds, setNewMessageIds] = useState<Set<string>>(new Set());

  // ── Sync states ───────────────────────────────────────────────────────────
  const [isInitialSyncing, setIsInitialSyncing] = useState(false);
  const [initialSyncDone, setInitialSyncDone] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [wsStatus, setWsStatus] = useState<
    "connecting" | "connected" | "error"
  >("connecting");

  // ── AI "typing…" bubble ──────────────────────────────────────────────────
  const [aiTypingConvIds, setAiTypingConvIds] = useState<Set<string>>(new Set());
  const aiTypingTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const clearAiTyping = useCallback((convId: string) => {
    setAiTypingConvIds((prev) => {
      if (!prev.has(convId)) return prev;
      const next = new Set(prev);
      next.delete(convId);
      return next;
    });
    const timeout = aiTypingTimeoutsRef.current[convId];
    if (timeout) {
      clearTimeout(timeout);
      delete aiTypingTimeoutsRef.current[convId];
    }
  }, []);

  const startAiTyping = useCallback((convId: string) => {
    setAiTypingConvIds((prev) => {
      if (prev.has(convId)) return prev;
      const next = new Set(prev);
      next.add(convId);
      return next;
    });
    const existing = aiTypingTimeoutsRef.current[convId];
    if (existing) clearTimeout(existing);
    aiTypingTimeoutsRef.current[convId] = setTimeout(
      () => clearAiTyping(convId),
      AI_TYPING_TIMEOUT_MS,
    );
  }, [clearAiTyping]);

  useEffect(() => {
    const timeouts = aiTypingTimeoutsRef.current;
    return () => {
      Object.values(timeouts).forEach(clearTimeout);
    };
  }, []);

  // ── AI reply suggestion ───────────────────────────────────────────────────
  const [suggestion, setSuggestion] = useState<SuggestionState>(IDLE_SUGGESTION);

  // ── Settings ──────────────────────────────────────────────────────────────
  const [uiPrefs, setUiPrefs] = useState<InboxUiPrefs>(() => loadUiPrefs());
  const [settingsOpen, setSettingsOpen] = useState(false);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const initialLoadDoneRef = useRef<Set<string>>(new Set());
  const syncOnOpenDoneRef = useRef<Set<string>>(new Set());
  const initialSyncDoneRef = useRef<Set<string>>(new Set());
  const skipNextMsgPollRef = useRef(false);
  const skipNextConvPollRef = useRef(false);
  const selectedConvRef = useRef<Conv | null>(null);
  const activeAccRef = useRef<Account | null>(null);

  useEffect(() => {
    selectedConvRef.current = selectedConv;
  }, [selectedConv]);
  useEffect(() => {
    activeAccRef.current = activeAcc;
  }, [activeAcc]);

  // Reset the suggestion panel whenever the open conversation changes —
  // a suggestion drafted for conversation A should never leak into B.
  useEffect(() => {
    setSuggestion(IDLE_SUGGESTION);
  }, [selectedConv?.id]);

  /**
   * Wrapper autour de setConvs qui met aussi à jour le badge global de la sidebar.
   * À utiliser partout où on remplace la liste complète des conversations.
   */
  const setConvsAndSync = useCallback(
    (updater: Conv[] | ((prev: Conv[]) => Conv[])) => {
      setConvs((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        // Somme des unread de toutes les convs sauf celle ouverte
        const openId = selectedConvRef.current?.id;
        const total = next.reduce(
          (sum, c) => sum + (c.id === openId ? 0 : c.unread),
          0,
        );
        setInboxUnread(total);
        return next;
      });
    },
    [setInboxUnread],
  );

  const patchConversation = useCallback(
    (convId: string, update: (conv: Conv) => Conv, moveToTop = false) => {
      setConvs((prev) => {
        let updatedConv: Conv | null = null;
        const next = prev.map((conv) => {
          if (conv.id !== convId) return conv;
          updatedConv = update(conv);
          return updatedConv;
        });
        const ordered =
          !moveToTop || !updatedConv
            ? next
            : [updatedConv, ...next.filter((conv) => conv.id !== convId)];

        // Sync badge — exclude the currently open conversation
        const openId = selectedConvRef.current?.id;
        const total = ordered.reduce(
          (sum, c) => sum + (c.id === openId ? 0 : c.unread),
          0,
        );
        setInboxUnread(total);
        return ordered;
      });

      setSelectedConv((prev) => (prev?.id === convId ? update(prev) : prev));
    },
    [setInboxUnread],
  );

  // ── Conversation mode ─────────────────────────────────────────────────────
  const [modeByConvId, setModeByConvId] = useState<Record<string, ConvMode>>(
    {},
  );

  const currentConvMode = selectedConv
    ? (modeByConvId[selectedConv.id] ?? selectedConv.mode)
    : "ai";

  const setCurrentConvMode = useCallback(
    (newMode: ConvMode) => {
      if (!selectedConv) return;
      const id = selectedConv.id;
      setModeByConvId((p) => ({ ...p, [id]: newMode }));
      setConvs((p) =>
        p.map((c) => (c.id === id ? { ...c, mode: newMode } : c)),
      );
      setHandover(id, newMode === "ai" ? "AI" : "HUMAN").catch(() => undefined);
    },
    [selectedConv],
  );

  // ── Attachments ───────────────────────────────────────────────────────────
  const [pendingPhotos, setPendingPhotos] = useState<PhotoAttachment[]>([]);
  const [pendingFile, setPendingFile] = useState<FileAttachment | null>(null);
  const [pendingPreset, setPendingPreset] = useState<PhotoPreset | null>(null);
  const [messageText, setMessageText] = useState("");

  // ── Presets ───────────────────────────────────────────────────────────────
  const [presets, setPresets] = useState<PhotoPreset[]>([]);
  const [addPresetOpen, setAddPresetOpen] = useState(false);

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const photoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const stagedPhotoFilesRef = useRef<File[]>([]);
  const stagedFileRef = useRef<File | null>(null);

  // ─── Resolved deep-linked conversation (fetched by ID, full detail) ────────
  // Populated by the "load accounts" effect below when a ?conv=<id> deep link
  // points at a conversation, so the "load when account changes" effect can
  // select it (or prepend it to the list) once its account's convs are loaded.
  const resolvedDeepLinkConvRef = useRef<Conv | null>(null);

  // ─── Load accounts ─────────────────────────────────────────────────────────
  // If the page was opened via a deep link (/inbox?conv=<id>), we resolve
  // that conversation's own details *before* picking the active account, so
  // we can switch straight to the page it belongs to instead of defaulting
  // to the first connected page.

  useEffect(() => {
    const deepLinkId = deepLinkConvIdRef.current;

    Promise.all([
      fetchAccounts(),
      deepLinkId
        ? fetchConversationById(deepLinkId).catch(() => null)
        : Promise.resolve(null),
    ])
      .then(([loaded, deepLinkConv]) => {
        setAccounts(loaded);

        if (loaded.length === 0) {
          setLoadingConvs(false);
          if (deepLinkId) {
            deepLinkConvIdRef.current = null;
            setResolvingDeepLink(false);
          }
          return;
        }

        if (deepLinkId && !deepLinkConv) {
          // Conversation doesn't exist or isn't accessible — give up on the
          // deep link and fall back to the default (first connected page).
          toast.error("Cette conversation est introuvable.");
          deepLinkConvIdRef.current = null;
          setResolvingDeepLink(false);
          setActiveAcc(loaded[0]);
          return;
        }

        if (deepLinkId && deepLinkConv) {
          const owningAccount = loaded.find(
            (a) => a.id === deepLinkConv.businessProfileId,
          );
          if (owningAccount) {
            resolvedDeepLinkConvRef.current = deepLinkConv;
            setActiveAcc(owningAccount);
            return;
          }
          // Conversation belongs to a page that isn't connected/active here.
          toast.error("Cette conversation appartient à une page non connectée.");
          deepLinkConvIdRef.current = null;
          setResolvingDeepLink(false);
        }

        setActiveAcc(loaded[0]);
      })
      .catch(() => {
        setLoadingConvs(false);
        if (deepLinkId) {
          deepLinkConvIdRef.current = null;
          setResolvingDeepLink(false);
        }
        toast.error("Impossible de charger les pages Facebook.");
      });
  }, []);

  // ─── Load when account changes ─────────────────────────────────────────────

  useEffect(() => {
    if (!activeAcc) return;

    setLoadingConvs(true);
    setConvs([]);
    setSelectedConv(null);
    setPresets([]);
    setMessagesByConvId({});
    setInitialSyncDone(false);
    initialLoadDoneRef.current.clear();
    syncOnOpenDoneRef.current.clear();

    fetchReferencePresets(activeAcc.id)
      .then(setPresets)
      .catch(() => undefined);

    // Resolves which conversation to auto-select once a page of conversations
    // has loaded for the active account — respecting a pending ?conv=<id>
    // deep link when present, and clearing it once resolved either way.
    const resolveSelection = (data: Conv[]): { list: Conv[]; toSelect: Conv | null } => {
      const deepLinkId = deepLinkConvIdRef.current;
      if (!deepLinkId) return { list: data, toSelect: data[0] ?? null };

      const match = data.find((c) => c.id === deepLinkId);
      if (match) {
        deepLinkConvIdRef.current = null;
        setResolvingDeepLink(false);
        setShowConvList(false);
        return { list: data, toSelect: match };
      }

      const resolved = resolvedDeepLinkConvRef.current;
      if (resolved?.id === deepLinkId && resolved.businessProfileId === activeAcc.id) {
        // Belongs to this account but fell outside the loaded page (older
        // conversation) — surface it at the top of the list.
        deepLinkConvIdRef.current = null;
        setResolvingDeepLink(false);
        setShowConvList(false);
        return { list: [resolved, ...data], toSelect: resolved };
      }

      // Shouldn't normally happen (resolved before switching account), but
      // fail safe rather than get stuck.
      deepLinkConvIdRef.current = null;
      setResolvingDeepLink(false);
      return { list: data, toSelect: data[0] ?? null };
    };

    fetchConversations({ businessProfileId: activeAcc.id, pageSize: 1 })
      .then(({ total }) => {
        const accId = activeAcc.id;
        const needInit = total === 0 && !initialSyncDoneRef.current.has(accId);

        if (needInit) {
          initialSyncDoneRef.current.add(accId);
          setIsInitialSyncing(true);

          performInitialSync(accId)
            .then(() =>
              fetchConversations({ businessProfileId: accId, pageSize: 30 }),
            )
            .then(({ data }) => {
              const { list, toSelect } = resolveSelection(data);
              setConvsAndSync(list);
              if (toSelect) setSelectedConv(toSelect);
              setInitialSyncDone(true);
            })
            .catch(() => {
              toast.error("La synchronisation initiale a échoué.");
              setInitialSyncDone(true);
              if (deepLinkConvIdRef.current) {
                deepLinkConvIdRef.current = null;
                setResolvingDeepLink(false);
              }
            })
            .finally(() => {
              setIsInitialSyncing(false);
              setLoadingConvs(false);
            });
        } else {
          initialSyncDoneRef.current.add(activeAcc.id);

          fetchConversations({ businessProfileId: activeAcc.id, pageSize: 30 })
            .then(({ data }) => {
              const { list, toSelect } = resolveSelection(data);
              setConvsAndSync(list);
              if (toSelect) setSelectedConv(toSelect);
              setInitialSyncDone(true);
            })
            .catch(() => {
              toast.error("Impossible de charger les conversations.");
              if (deepLinkConvIdRef.current) {
                deepLinkConvIdRef.current = null;
                setResolvingDeepLink(false);
              }
            })
            .finally(() => setLoadingConvs(false));

          syncConversationList(activeAcc.id).catch(() => undefined);
        }
      })
      .catch(() => {
        setLoadingConvs(false);
        if (deepLinkConvIdRef.current) {
          deepLinkConvIdRef.current = null;
          setResolvingDeepLink(false);
        }
        toast.error("Erreur lors du chargement.");
      });
  }, [activeAcc?.id]);

  // ─── Conversation list polling (30s) ───────────────────────────────────────

  useEffect(() => {
    if (!activeAcc) return;

    const accId = activeAcc.id;
    const id = setInterval(async () => {
      if (skipNextConvPollRef.current) {
        skipNextConvPollRef.current = false;
        return;
      }
      try {
        const { data: fresh } = await fetchConversations({
          businessProfileId: accId,
          pageSize: 30,
        });
        const openId = selectedConvRef.current?.id;
        setConvsAndSync(
          fresh.map((c) => (c.id === openId ? { ...c, unread: 0 } : c)),
        );
      } catch {
        /* silent background refresh */
      }
    }, CONV_POLL_MS);

    return () => clearInterval(id);
  }, [activeAcc?.id]);

  // ─── Initial message load ──────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedConv) return;
    const convId = selectedConv.id;
    if (initialLoadDoneRef.current.has(convId)) return;
    initialLoadDoneRef.current.add(convId);
    setLoadingMessages(true);

    fetchMessages(convId, { limit: MESSAGES_PER_PAGE })
      .then((page) => {
        const msgs = [...page.messages].reverse().map(apiMsgToUiMsg);
        const latest = page.messages[0];
        setMessagesByConvId((p) => ({ ...p, [convId]: msgs }));
        setCursorByConvId((p) => ({ ...p, [convId]: page.nextCursor }));
        setHasMoreByConvId((p) => ({ ...p, [convId]: page.hasMore }));
        markConversationRead(convId).catch(() => undefined);
        patchConversation(convId, (conv) => ({
          ...conv,
          lastMessage: latest ? messageApiToPreview(latest) : conv.lastMessage,
          time: latest ? formatMessageTime(latest.createdAt) : conv.time,
          unread: 0,
        }));
      })
      .catch(() => {
        initialLoadDoneRef.current.delete(convId);
        toast.error("Impossible de charger les messages.");
      })
      .finally(() => setLoadingMessages(false));
  }, [selectedConv?.id, patchConversation]);

  // ─── Sync-on-open ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedConv) return;
    const convId = selectedConv.id;
    if (syncOnOpenDoneRef.current.has(convId)) return;
    syncOnOpenDoneRef.current.add(convId);

    setIsSyncing(true);
    syncConversationOnOpen(convId)
      .catch(() => undefined)
      .finally(() => setIsSyncing(false));
  }, [selectedConv?.id]);

  // ─── Message polling (8s) ──────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedConv) return;

    const id = setInterval(async () => {
      if (skipNextMsgPollRef.current) {
        skipNextMsgPollRef.current = false;
        return;
      }
      const convId = selectedConvRef.current?.id;
      if (!convId) return;
      try {
        const page = await fetchMessages(convId, { limit: MESSAGES_PER_PAGE });
        const fresh = [...page.messages].reverse().map(apiMsgToUiMsg);
        const latest = page.messages[0];
        setMessagesByConvId((p) => ({
          ...p,
          [convId]: mergeWithOptimistic(fresh, p[convId] ?? []),
        }));
        setCursorByConvId((p) => ({ ...p, [convId]: page.nextCursor }));
        setHasMoreByConvId((p) => ({ ...p, [convId]: page.hasMore }));
        markConversationRead(convId).catch(() => undefined);
        patchConversation(convId, (conv) => ({
          ...conv,
          lastMessage: latest ? messageApiToPreview(latest) : conv.lastMessage,
          time: latest ? formatMessageTime(latest.createdAt) : conv.time,
          unread: 0,
        }));
      } catch {
        /* silent background refresh */
      }
    }, MSG_POLL_MS);

    return () => clearInterval(id);
  }, [selectedConv?.id, patchConversation]);

  // ─── Scroll to bottom ─────────────────────────────────────────────────────

  const currentMessages = selectedConv
    ? (messagesByConvId[selectedConv.id] ?? [])
    : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages.length]);

  // ─── Load older messages ──────────────────────────────────────────────────

  const loadOlderMessages = useCallback(async () => {
    if (!selectedConv) return;
    const convId = selectedConv.id;
    const cursor = cursorByConvId[convId];
    if (!cursor) return;

    setLoadingMessages(true);
    try {
      const page = await fetchMessages(convId, {
        before: cursor,
        limit: MESSAGES_PER_PAGE,
      });
      const older = [...page.messages].reverse().map(apiMsgToUiMsg);
      setMessagesByConvId((p) => ({
        ...p,
        [convId]: [...older, ...(p[convId] ?? [])],
      }));
      setCursorByConvId((p) => ({ ...p, [convId]: page.nextCursor }));
      setHasMoreByConvId((p) => ({ ...p, [convId]: page.hasMore }));
    } catch {
      toast.error("Impossible de charger les messages précédents.");
    } finally {
      setLoadingMessages(false);
    }
  }, [selectedConv?.id, cursorByConvId]);

  // ─── Realtime (WebSocket) ───────────────────────────────────────────────────
  // Passed as a plain object — useInboxWs stores callbacks in a ref internally
  // so passing a new object each render is safe and avoids exhaustive-deps issues.

  const { requestAiSuggestion } = useInboxWs({
    onConnect: () => setWsStatus("connected"),
    onError: () => setWsStatus("error"),

    onNewMessage: ({ conversationId, message: m }) => {
      const openId = selectedConvRef.current?.id;
      const newUiMsg = apiMsgToUiMsg(m);

      // Any new message closes the "AI is typing…" bubble for that conversation.
      clearAiTyping(conversationId);

      if (openId === conversationId) {
        setMessagesByConvId((p) => {
          const existing = p[conversationId] ?? [];
          const alreadyIn = existing.some(
            (e) =>
              e.id === newUiMsg.id ||
              (newUiMsg.externalId != null &&
                e.externalId === newUiMsg.externalId),
          );
          if (alreadyIn) return p;

          // Flag this message for the one-shot entrance animation, then
          // auto-clear the flag shortly after — history loads never pass
          // through this path so they never animate.
          setNewMessageIds((prevIds) => new Set(prevIds).add(newUiMsg.id));
          setTimeout(() => {
            setNewMessageIds((prevIds) => {
              if (!prevIds.has(newUiMsg.id)) return prevIds;
              const next = new Set(prevIds);
              next.delete(newUiMsg.id);
              return next;
            });
          }, NEW_MESSAGE_ANIMATION_MS);

          return {
            ...p,
            [conversationId]: [
              ...existing.filter((e) => !(e.pending && !e.externalId)),
              newUiMsg,
            ],
          };
        });
        markConversationRead(conversationId).catch(() => undefined);
        skipNextMsgPollRef.current = true;
      }

      const isOpen = openId === conversationId;
      patchConversation(
        conversationId,
        (conv) => ({
          ...conv,
          lastMessage: messageApiToPreview(m),
          time: formatMessageTime(m.createdAt),
          unread: isOpen ? 0 : conv.unread + 1,
        }),
        true,
      );
      skipNextConvPollRef.current = true;
    },

    onConversationUpdated: ({ conversation: updated }) => {
      const activeAccount = activeAccRef.current;
      if (activeAccount && updated.businessProfileId !== activeAccount.id)
        return;

      // `updated` may be a PARTIAL snapshot (see ConversationEventSnapshot on
      // the backend) — e.g. the webhook handler patching just unreadCount
      // doesn't necessarily recompute the 24h messaging window. A field
      // that's `undefined` here means "unchanged", never "reset to
      // default" — so these 4 fields are merged against whatever the
      // conversation already had in state, not blindly overwritten.
      const mergeWindowFields = (prev: Conv | undefined): Conv => {
        const mapped = mapConversation(updated);
        if (!prev) return mapped;
        return {
          ...mapped,
          lastClientMessageAt:
            updated.lastClientMessageAt !== undefined
              ? mapped.lastClientMessageAt
              : prev.lastClientMessageAt,
          messagingWindowExpiresAt:
            updated.messagingWindowExpiresAt !== undefined
              ? mapped.messagingWindowExpiresAt
              : prev.messagingWindowExpiresAt,
          canSendFreeform:
            updated.canSendFreeform !== undefined
              ? mapped.canSendFreeform
              : prev.canSendFreeform,
          messengerDeepLink:
            updated.messengerDeepLink !== undefined
              ? mapped.messengerDeepLink
              : prev.messengerDeepLink,
        };
      };

      setConvsAndSync((p) => {
        const existing = p.find((c) => c.id === updated.id);
        const merged = mergeWindowFields(existing);
        return existing
          ? [merged, ...p.filter((c) => c.id !== updated.id)]
          : [merged, ...p];
      });
      setSelectedConv((prev) =>
        prev?.id === updated.id ? mergeWindowFields(prev) : prev,
      );
      skipNextConvPollRef.current = true;
    },

    onSyncComplete: ({ businessProfileId }) => {
      const activeAccount = activeAccRef.current;
      if (!activeAccount || businessProfileId !== activeAccount.id) return;
      fetchConversations({ businessProfileId, pageSize: 30 })
        .then(({ data }) => {
          const openId = selectedConvRef.current?.id;
          setConvsAndSync(
            data.map((c) => (c.id === openId ? { ...c, unread: 0 } : c)),
          );
        })
        .catch(() => undefined);
    },

    onAiTypingStart: ({ conversationId }) => startAiTyping(conversationId),
    onAiTypingStop:  ({ conversationId }) => clearAiTyping(conversationId),

    onAiSuggestionChunk: ({ conversationId, requestId, textChunk }) => {
      if (conversationId !== selectedConvRef.current?.id) return;
      setSuggestion((prev) => {
        if (prev.requestId && prev.requestId !== requestId) return prev; // stale response
        return { status: "streaming", text: prev.text + textChunk, error: null, requestId };
      });
    },
    onAiSuggestionDone: ({ conversationId, requestId, fullText }) => {
      if (conversationId !== selectedConvRef.current?.id) return;
      setSuggestion((prev) => {
        if (prev.requestId && prev.requestId !== requestId) return prev;
        return { status: "done", text: fullText, error: null, requestId };
      });
    },
    onAiSuggestionError: ({ conversationId, requestId, message }) => {
      if (conversationId !== selectedConvRef.current?.id) return;
      setSuggestion((prev) => {
        if (prev.requestId && prev.requestId !== requestId) return prev;
        return { status: "error", text: prev.text, error: message, requestId };
      });
    },
  });

  // ─── AI reply suggestion controls ──────────────────────────────────────────

  const requestSuggestion = useCallback(() => {
    if (!selectedConv) return;
    setSuggestion({ status: "loading", text: "", error: null, requestId: null });
    requestAiSuggestion(selectedConv.id);
  }, [selectedConv?.id, requestAiSuggestion]);

  const acceptSuggestion = useCallback(() => {
    setSuggestion((current) => {
      if (current.text.trim()) {
        setMessageText(current.text.trim());
        requestAnimationFrame(() => textareaRef.current?.focus());
      }
      return IDLE_SUGGESTION;
    });
  }, []);

  const dismissSuggestion = useCallback(() => {
    setSuggestion(IDLE_SUGGESTION);
  }, []);

  // ─── File pickers ──────────────────────────────────────────────────────────

  const handlePhotoFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;
    const files = Array.from(fileList);
    stagedPhotoFilesRef.current = [...stagedPhotoFilesRef.current, ...files];
    setPendingPhotos((p) => [
      ...p,
      ...files.map((f, i) => ({
        kind: "photo" as const,
        name: f.name,
        objectUrl: URL.createObjectURL(f),
        gradient: GRADIENTS[(p.length + i) % GRADIENTS.length],
      })),
    ]);
  }, []);

  const handleFileSelect = useCallback((fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    stagedFileRef.current = file;
    setPendingFile({
      kind: "file",
      name: file.name,
      size:
        file.size > 1_048_576
          ? `${(file.size / 1_048_576).toFixed(1)} Mo`
          : `${Math.round(file.size / 1024)} Ko`,
      objectUrl: URL.createObjectURL(file),
    });
  }, []);

  // ─── Send ──────────────────────────────────────────────────────────────────

  const canSend = !!(
    selectedConv?.canSendFreeform !== false &&
    (messageText.trim() ||
      pendingPhotos.length ||
      pendingFile ||
      pendingPreset)
  );

  const handleSend = useCallback(async () => {
    if (!canSend || !selectedConv) return;
    if (selectedConv.canSendFreeform === false) {
      toast.error("La fenêtre de 24h est dépassée — répondez depuis Messenger.");
      return;
    }

    const convId = selectedConv.id;
    const uiSender =
      currentConvMode === "ai"
        ? "ai"
        : currentConvMode === "human"
          ? "human"
          : "page";
    const time = nowTime();
    const date = "Aujourd'hui";

    const optimistic: Msg[] = [];

    if (pendingPreset) {
      optimistic.push({
        id: tmpId(),
        sender: uiSender,
        time,
        date,
        kind: "photos",
        pending: true,
        photos: pendingPreset.photos.map((ph) => ({
          kind: "photo" as const,
          name: pendingPreset.name,
          objectUrl: ph.objectUrl,
          gradient: ph.gradient,
        })),
      });
    }
    if (pendingPhotos.length > 0) {
      optimistic.push({
        id: tmpId(),
        sender: uiSender,
        time,
        date,
        kind: "photos",
        pending: true,
        photos: [...pendingPhotos],
      });
    }
    if (pendingFile) {
      optimistic.push({
        id: tmpId(),
        sender: uiSender,
        time,
        date,
        kind: "file",
        pending: true,
        file: { ...pendingFile },
      });
    }
    if (messageText.trim()) {
      optimistic.push({
        id: tmpId(),
        sender: uiSender,
        time,
        date,
        kind: "text",
        pending: true,
        content: messageText.trim(),
      });
    }

    setMessagesByConvId((p) => ({
      ...p,
      [convId]: [...(p[convId] ?? []), ...optimistic],
    }));
    const latestOptimistic = optimistic[optimistic.length - 1];
    if (latestOptimistic) {
      patchConversation(
        convId,
        (conv) => ({
          ...conv,
          lastMessage: msgToPreview(latestOptimistic),
          time,
          unread: 0,
        }),
        true,
      );
    }

    const text = messageText.trim();
    const file = pendingFile;
    const preset = pendingPreset;
    const photoFiles = [...stagedPhotoFilesRef.current];
    const rawFile = stagedFileRef.current;

    setMessageText("");
    setPendingPhotos([]);
    setPendingFile(null);
    setPendingPreset(null);
    stagedPhotoFilesRef.current = [];
    stagedFileRef.current = null;

    try {
      if (preset?.referenceImageUrls?.length) {
        await sendImagesMessage(
          convId,
          preset.referenceImageUrls,
          text || undefined,
        );
      }
      if (photoFiles.length > 0) {
        const urls: string[] = [];
        for (const f of photoFiles) urls.push(await getTempUploadUrl(f));
        await sendImagesMessage(convId, urls);
      }
      if (rawFile && file) {
        const url = await getTempUploadUrl(rawFile);
        await sendFileMessage(convId, url, file.name);
      }
      if (text && !preset?.referenceImageUrls?.length) {
        await sendTextMessage(convId, text);
      }

      setMessagesByConvId((p) => ({
        ...p,
        [convId]: (p[convId] ?? []).map((m) =>
          m.pending ? { ...m, pending: false } : m,
        ),
      }));
    } catch {
      setMessagesByConvId((p) => ({
        ...p,
        [convId]: (p[convId] ?? []).map((m) =>
          m.pending ? { ...m, pending: false, failed: true } : m,
        ),
      }));
      toast.error("Erreur lors de l'envoi. Vérifiez votre connexion.");
    }
  }, [
    canSend,
    selectedConv,
    currentConvMode,
    messageText,
    pendingPhotos,
    pendingFile,
    pendingPreset,
    patchConversation,
  ]);

  // ─── Presets ───────────────────────────────────────────────────────────────

  const addPreset = useCallback(
    async (data: Omit<PhotoPreset, "id"> & { files?: File[] }) => {
      if (!activeAcc || !data.files?.length) return;
      const newPreset = await createReferencePreset({
        businessProfileId: activeAcc.id,
        name: data.name,
        description: data.description,
        files: data.files,
      });
      setPresets((p) => [newPreset, ...p]);
    },
    [activeAcc?.id],
  );

  const removePreset = useCallback(
    (presetId: string) => {
      setPresets((p) => p.filter((x) => x.id !== presetId));
      deleteReferencePreset(presetId).catch(() => {
        toast.error("Impossible de supprimer l'image de référence.");
        if (activeAcc) {
          fetchReferencePresets(activeAcc.id)
            .then(setPresets)
            .catch(() => undefined);
        }
      });
    },
    [activeAcc?.id],
  );

  // ─── UI prefs ──────────────────────────────────────────────────────────────

  const updateUiPrefs = useCallback((partial: Partial<InboxUiPrefs>) => {
    setUiPrefs((p) => {
      const updated = { ...p, ...partial };
      saveUiPrefs(updated);
      return updated;
    });
  }, []);

  // ─── Emoji ─────────────────────────────────────────────────────────────────

  const handleEmojiSelect = useCallback((emoji: { native: string }) => {
    setMessageText((p) => p + emoji.native);
    textareaRef.current?.focus();
  }, []);

  // ─── Conversation selection ────────────────────────────────────────────────

  const handleSelectConv = useCallback(
    (conv: Conv) => {
      setSelectedConv(conv);
      setShowConvList(false);

      // Keep the URL in sync so the conversation is directly linkable/shareable
      // and survives a refresh — mirrors the /inbox?conv=<id> pattern used by
      // notification deep-links.
      const params = new URLSearchParams(searchParams.toString());
      params.set("conv", conv.id);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  // ─── Search ────────────────────────────────────────────────────────────────

  const filteredConvs = useMemo(() => {
    if (!searchQuery.trim()) return convs;
    const q = searchQuery.toLowerCase();
    return convs.filter(
      (c) =>
        c.client.toLowerCase().includes(q) ||
        c.lastMessage.toLowerCase().includes(q),
    );
  }, [convs, searchQuery]);

  // ─── Public API ────────────────────────────────────────────────────────────

  return {
    accounts,
    activeAcc,
    setActiveAcc,
    convs: filteredConvs,
    loadingConvs,
    selected: selectedConv,
    showList: showConvList,
    setShowList: setShowConvList,
    convMode: currentConvMode,
    setConvMode: setCurrentConvMode,
    msgs: currentMessages,
    hasMore: selectedConv ? (hasMoreByConvId[selectedConv.id] ?? false) : false,
    loadingMsgs: loadingMessages,
    loadMore: loadOlderMessages,
    isInitialSyncing,
    initialSyncDone,
    isSyncing,
    resolvingDeepLink,
    wsStatus,
    isAiTyping: selectedConv ? aiTypingConvIds.has(selectedConv.id) : false,
    newMessageIds,
    searchQuery,
    setSearchQuery,
    pendingPhotos,
    setPendingPhotos,
    pendingFile,
    setPendingFile,
    pendingPreset,
    setPendingPreset,
    message: messageText,
    setMessage: setMessageText,
    canSend,
    presets,
    addPreset,
    removePreset,
    addPresetOpen,
    setAddPresetOpen,
    uiPrefs,
    updateUiPrefs,
    settingsOpen,
    setSettingsOpen,
    photoRef: photoInputRef,
    fileRef: fileInputRef,
    bottomRef: messagesEndRef,
    textareaRef,
    handlePhotoFiles,
    handleFileSelect,
    handleSend,
    handleSelectConv,
    handleEmojiSelect,
    suggestion,
    requestSuggestion,
    acceptSuggestion,
    dismissSuggestion,
  };
}
