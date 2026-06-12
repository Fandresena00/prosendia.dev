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
 *   sseStatus        — 'connecting' | 'connected' | 'error'
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  createReferencePreset,
  deleteReferencePreset,
  fetchAccounts,
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
import { useInboxSse } from "./use-inbox-sse";

// ─── Constants ────────────────────────────────────────────────────────────────

const CONV_POLL_MS = 30_000;
const MSG_POLL_MS = 8_000;
const MESSAGES_PER_PAGE = 30;

const GRADIENTS = [
  "from-blue-500/40 to-indigo-600/30",
  "from-violet-500/40 to-purple-600/30",
  "from-emerald-500/40 to-teal-600/30",
  "from-amber-500/40 to-orange-600/30",
  "from-rose-500/40 to-pink-600/30",
  "from-cyan-500/40 to-sky-600/30",
];

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

  // ── Sync states ───────────────────────────────────────────────────────────
  const [isInitialSyncing, setIsInitialSyncing] = useState(false);
  const [initialSyncDone, setInitialSyncDone] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [sseStatus, setSseStatus] = useState<
    "connecting" | "connected" | "error"
  >("connecting");

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

  // ─── Load accounts ─────────────────────────────────────────────────────────

  useEffect(() => {
    fetchAccounts()
      .then((loaded) => {
        setAccounts(loaded);
        if (loaded.length > 0) setActiveAcc(loaded[0]);
        else setLoadingConvs(false);
      })
      .catch(() => {
        setLoadingConvs(false);
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
              setConvsAndSync(data);
              if (data.length > 0) setSelectedConv(data[0]);
              setInitialSyncDone(true);
            })
            .catch(() => {
              toast.error("La synchronisation initiale a échoué.");
              setInitialSyncDone(true);
            })
            .finally(() => {
              setIsInitialSyncing(false);
              setLoadingConvs(false);
            });
        } else {
          initialSyncDoneRef.current.add(activeAcc.id);

          fetchConversations({ businessProfileId: activeAcc.id, pageSize: 30 })
            .then(({ data }) => {
              setConvsAndSync(data);
              if (data.length > 0) setSelectedConv(data[0]);
              setInitialSyncDone(true);
            })
            .catch(() =>
              toast.error("Impossible de charger les conversations."),
            )
            .finally(() => setLoadingConvs(false));

          syncConversationList(activeAcc.id).catch(() => undefined);
        }
      })
      .catch(() => {
        setLoadingConvs(false);
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

  // ─── SSE ──────────────────────────────────────────────────────────────────
  // Passed as a plain object — useInboxSse stores callbacks in a ref internally
  // so passing a new object each render is safe and avoids exhaustive-deps issues.

  useInboxSse({
    onConnect: () => setSseStatus("connected"),
    onError: () => setSseStatus("error"),

    onNewMessage: ({ conversationId, message: m }) => {
      const openId = selectedConvRef.current?.id;
      const newUiMsg = apiMsgToUiMsg(m);

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
      const mapped = mapConversation(updated);
      setConvsAndSync((p) => {
        const exists = p.some((c) => c.id === updated.id);
        return exists
          ? [mapped, ...p.filter((c) => c.id !== updated.id)]
          : [mapped, ...p];
      });
      setSelectedConv((prev) => (prev?.id === updated.id ? mapped : prev));
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
  });

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
    messageText.trim() ||
    pendingPhotos.length ||
    pendingFile ||
    pendingPreset
  );

  const handleSend = useCallback(async () => {
    if (!canSend || !selectedConv) return;

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

  const handleSelectConv = useCallback((conv: Conv) => {
    setSelectedConv(conv);
    setShowConvList(false);
  }, []);

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
    sseStatus,
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
  };
}
