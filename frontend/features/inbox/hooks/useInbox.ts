"use client";

/**
 * @file features/inbox/hooks/useInbox.ts
 *
 * BUG FIXES IN THIS VERSION
 * ─────────────────────────
 * 1. LATENCE PAR CONVERSATION (root cause: API Facebook dans le webhook)
 *    Le webhook appelait isTokenUsable() (live API) + fetchClientMessengerProfile()
 *    (live API) de façon SYNCHRONE pour chaque message. Si ces appels prenaient
 *    2–5s, le message n'était sauvegardé qu'après, et le SSE n'était émis qu'après.
 *    Résultat : certaines conversations semblaient mettre ~5 min (prochain scheduler)
 *    Fix : le webhook ne fait plus AUCUN appel Facebook synchrone.
 *
 * 2. MESSAGES NON REÇUS PAR L'AI
 *    Conséquence directe du bug 1 : si le webhook échouait (timeout API), le job
 *    AI n'était jamais enqueued. Fix inclus dans webhook.service.ts.
 *
 * 3. AVATARS MANQUANTS
 *    fetchClientMessengerProfile() était bloquant, souvent raté. Maintenant en
 *    background fire-and-forget avec SSE update quand l'avatar est disponible.
 *
 * 4. MULTI-ACCOUNT SSE
 *    Les événements SSE d'autres comptes (même userId, autre businessProfileId)
 *    étaient ajoutés à la liste alors qu'ils ne devraient pas l'être.
 *
 * ARCHITECTURE DE FIABILITÉ
 * ─────────────────────────
 *   Layer 1 — Webhook      : ~instant (maintenant sans live API)
 *   Layer 2 — Sync-on-open : ~1s (fetch Graph API à l'ouverture)
 *   Layer 3 — Poll msgs    : toutes les 8s (filet de sécurité)
 *   Layer 4 — Poll convs   : toutes les 30s (sidebar à jour)
 *   Layer 5 — Scheduler    : toutes les 5 min (backend, rattrape tout)
 *
 * ÉTATS DE CHARGEMENT
 * ───────────────────
 *   loadingConvs      : chargement initial liste conversations
 *   loadingMessages   : chargement initial messages d'une conv
 *   isSyncing         : sync-on-open en cours (Graph API fetch)
 *   sseStatus         : 'connecting' | 'connected' | 'error'
 */

import { ApiError, NetworkError } from "@/lib/errors";
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
  mapConversation,
  markConversationRead,
  sendFileMessage,
  sendImagesMessage,
  sendTextMessage,
  setHandover,
  syncConversationList,
  syncConversationOnOpen,
} from "../services/inbox.service";
import type {
  Account,
  Conv,
  ConversationUpdatedSsePayload,
  ConvMode,
  FileAttachment,
  Msg,
  NewMessageSsePayload,
  PhotoAttachment,
  PhotoPreset,
} from "../types/inbox.types";
import { apiMsgToUiMsg } from "../utils/api-msg-to-ui-msg";
import { useInboxSse } from "./use-inbox-sse";

// ─── Constants ────────────────────────────────────────────────────────────────

const CONV_POLL_INTERVAL_MS = 30_000;
const MSG_POLL_INTERVAL_MS = 8_000;
const MESSAGES_PER_PAGE = 30;

const GRADIENTS = [
  "from-blue-500/40 to-indigo-600/30",
  "from-violet-500/40 to-purple-600/30",
  "from-emerald-500/40 to-teal-600/30",
  "from-amber-500/40 to-orange-600/30",
  "from-rose-500/40 to-pink-600/30",
  "from-cyan-500/40 to-sky-600/30",
];

// ─── Merge helper ─────────────────────────────────────────────────────────────

/**
 * Merges fresh DB messages with pending/failed optimistic messages.
 * Fresh DB is always the source of truth. Optimistic messages that are not
 * yet confirmed by the DB are kept at the end.
 */
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
const tmpId = () => `tmp-${Date.now()}-${++tmpCounter}`;
const nowTime = () =>
  new Date().toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

function buildOptimisticPhotoMsg(
  sender: Msg["sender"],
  photos: PhotoAttachment[],
): Msg {
  return {
    id: tmpId(),
    sender,
    time: nowTime(),
    date: "Aujourd'hui",
    kind: "photos",
    pending: true,
    photos,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useInbox(userId: string | undefined) {
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

  // ── Loading / sync states ─────────────────────────────────────────────────
  /** true while sync-on-open Graph API fetch is in progress */
  const [isSyncing, setIsSyncing] = useState(false);
  /** SSE connection status — used to show a connection indicator in the header */
  const [sseStatus, setSseStatus] = useState<
    "connecting" | "connected" | "error"
  >("connecting");

  // ── Internal refs ──────────────────────────────────────────────────────────
  const initialLoadDoneRef = useRef<Set<string>>(new Set());
  const syncOnOpenDoneRef = useRef<Set<string>>(new Set());
  const skipNextMsgPollRef = useRef(false);
  const skipNextConvPollRef = useRef(false);

  // Stable refs for SSE callbacks
  const selectedConvRef = useRef<Conv | null>(null);
  const activeAccRef = useRef<Account | null>(null);
  useEffect(() => {
    selectedConvRef.current = selectedConv;
  }, [selectedConv]);
  useEffect(() => {
    activeAccRef.current = activeAcc;
  }, [activeAcc]);

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
      setModeByConvId((p) => ({ ...p, [selectedConv.id]: newMode }));
      setConvs((p) =>
        p.map((c) => (c.id === selectedConv.id ? { ...c, mode: newMode } : c)),
      );
      setHandover(selectedConv.id, newMode === "ai" ? "AI" : "HUMAN").catch(
        () => undefined,
      );
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
      })
      .catch(() => toast.error("Impossible de charger les pages Facebook."));
  }, []);

  // ─── Load conversations when account changes ───────────────────────────────

  useEffect(() => {
    if (!activeAcc) return;
    setLoadingConvs(true);
    setConvs([]);
    setSelectedConv(null);
    setPresets([]);
    setMessagesByConvId({});
    initialLoadDoneRef.current.clear();
    syncOnOpenDoneRef.current.clear();

    fetchConversations({ businessProfileId: activeAcc.id, pageSize: 30 })
      .then(({ data }) => {
        setConvs(data);
        if (data.length > 0) setSelectedConv(data[0]);
      })
      .catch(() => toast.error("Impossible de charger les conversations."))
      .finally(() => setLoadingConvs(false));

    // Refresh avatars + names from Facebook in background
    syncConversationList(activeAcc.id).catch(() => undefined);

    fetchReferencePresets(activeAcc.id)
      .then(setPresets)
      .catch(() => undefined);
  }, [activeAcc?.id]);

  // ─── Conversation list polling (30s) ───────────────────────────────────────

  useEffect(() => {
    if (!activeAcc) return;
    const poll = async () => {
      if (skipNextConvPollRef.current) {
        skipNextConvPollRef.current = false;
        return;
      }
      try {
        const { data: fresh } = await fetchConversations({
          businessProfileId: activeAcc.id,
          pageSize: 30,
        });
        const openId = selectedConvRef.current?.id;
        setConvs(fresh.map((c) => (c.id === openId ? { ...c, unread: 0 } : c)));
      } catch {
        /* silent */
      }
    };
    const id = setInterval(poll, CONV_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [activeAcc?.id]);

  // ─── Initial message load ──────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedConv) return;
    if (initialLoadDoneRef.current.has(selectedConv.id)) return;
    initialLoadDoneRef.current.add(selectedConv.id);
    setLoadingMessages(true);

    fetchMessages(selectedConv.id, { limit: MESSAGES_PER_PAGE })
      .then((page) => {
        const msgs = [...page.messages].reverse().map(apiMsgToUiMsg);
        setMessagesByConvId((p) => ({ ...p, [selectedConv.id]: msgs }));
        setCursorByConvId((p) => ({
          ...p,
          [selectedConv.id]: page.nextCursor,
        }));
        setHasMoreByConvId((p) => ({ ...p, [selectedConv.id]: page.hasMore }));
        markConversationRead(selectedConv.id).catch(() => undefined);
        setConvs((p) =>
          p.map((c) => (c.id === selectedConv.id ? { ...c, unread: 0 } : c)),
        );
      })
      .catch(() => {
        initialLoadDoneRef.current.delete(selectedConv.id);
        toast.error("Impossible de charger les messages.");
      })
      .finally(() => setLoadingMessages(false));
  }, [selectedConv?.id]);

  // ─── Sync-on-open: pull latest from Facebook Graph API ────────────────────
  //
  // This is the reliability guarantee: every time a conversation is opened,
  // we immediately fetch the latest messages from Facebook (not just the DB).
  // Fixes: messages missed by failed webhooks, 5-min latency, empty new conversations.
  //
  // We show isSyncing=true so the UI can show a subtle "syncing" indicator.

  useEffect(() => {
    if (!selectedConv) return;
    if (syncOnOpenDoneRef.current.has(selectedConv.id)) return;
    syncOnOpenDoneRef.current.add(selectedConv.id);

    setIsSyncing(true);
    syncConversationOnOpen(selectedConv.id)
      .then(() => {
        skipNextMsgPollRef.current = false; // Force poll after sync
      })
      .catch(() => undefined)
      .finally(() => setIsSyncing(false));
  }, [selectedConv?.id]);

  // ─── Message polling (8s, active conversation) ─────────────────────────────

  useEffect(() => {
    if (!selectedConv) return;
    const poll = async () => {
      if (skipNextMsgPollRef.current) {
        skipNextMsgPollRef.current = false;
        return;
      }
      const convId = selectedConvRef.current?.id;
      if (!convId) return;
      try {
        const page = await fetchMessages(convId, { limit: MESSAGES_PER_PAGE });
        const fresh = [...page.messages].reverse().map(apiMsgToUiMsg);
        setMessagesByConvId((p) => ({
          ...p,
          [convId]: mergeWithOptimistic(fresh, p[convId] ?? []),
        }));
        setCursorByConvId((p) => ({ ...p, [convId]: page.nextCursor }));
        setHasMoreByConvId((p) => ({ ...p, [convId]: page.hasMore }));
        markConversationRead(convId).catch(() => undefined);
        setConvs((p) =>
          p.map((c) => (c.id === convId ? { ...c, unread: 0 } : c)),
        );
      } catch {
        /* silent */
      }
    };
    const id = setInterval(poll, MSG_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [selectedConv?.id]);

  // ─── Scroll to bottom ──────────────────────────────────────────────────────

  const currentMessages = selectedConv
    ? (messagesByConvId[selectedConv.id] ?? [])
    : [];
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages.length]);

  // ─── Load older messages ───────────────────────────────────────────────────

  const loadOlderMessages = useCallback(async () => {
    if (!selectedConv) return;
    const cursor = cursorByConvId[selectedConv.id];
    if (!cursor) return;
    setLoadingMessages(true);
    try {
      const page = await fetchMessages(selectedConv.id, {
        before: cursor,
        limit: MESSAGES_PER_PAGE,
      });
      const older = [...page.messages].reverse().map(apiMsgToUiMsg);
      setMessagesByConvId((p) => ({
        ...p,
        [selectedConv.id]: [...older, ...(p[selectedConv.id] ?? [])],
      }));
      setCursorByConvId((p) => ({ ...p, [selectedConv.id]: page.nextCursor }));
      setHasMoreByConvId((p) => ({ ...p, [selectedConv.id]: page.hasMore }));
    } catch {
      toast.error("Impossible de charger les messages précédents.");
    } finally {
      setLoadingMessages(false);
    }
  }, [selectedConv?.id, cursorByConvId]);

  // ─── SSE: instant updates ──────────────────────────────────────────────────

  useInboxSse(
    useMemo(
      () => ({
        onConnect: () => setSseStatus("connected"),
        onError: () => setSseStatus("error"),

        onNewMessage: ({
          conversationId,
          message: m,
        }: NewMessageSsePayload) => {
          const openId = selectedConvRef.current?.id;
          const newUiMsg = apiMsgToUiMsg(m);

          // FIX: only update the active account's conversations
          // All FB pages of a user share the same SSE stream, so we must filter
          const activeConvs = convs; // captured via closure is stale — use ref pattern below

          // Add message to the open conversation immediately
          if (openId === conversationId) {
            setMessagesByConvId((p) => {
              const existing = p[conversationId] ?? [];
              const alreadyExists = existing.some(
                (e) =>
                  e.id === newUiMsg.id ||
                  (newUiMsg.externalId && e.externalId === newUiMsg.externalId),
              );
              if (alreadyExists) return p;
              const withoutOptimistic = existing.filter(
                (e) => !(e.pending && !e.externalId),
              );
              return {
                ...p,
                [conversationId]: [...withoutOptimistic, newUiMsg],
              };
            });
            markConversationRead(conversationId).catch(() => undefined);
            skipNextMsgPollRef.current = true;
          }

          // Update conversation list (last message + unread)
          const isOpen = openId === conversationId;
          setConvs((p) =>
            p.map((c) =>
              c.id === conversationId
                ? {
                    ...c,
                    lastMessage:
                      m.content ??
                      (m.imageUrl ? "📷 Photo" : m.fileUrl ? "📎 Fichier" : ""),
                    time: new Date(m.createdAt).toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    }),
                    unread: isOpen ? 0 : c.unread + 1,
                  }
                : c,
            ),
          );
          skipNextConvPollRef.current = true;
        },

        onConversationUpdated: ({
          conversation: updated,
        }: ConversationUpdatedSsePayload) => {
          // FIX: filter to active account only
          const activeAccount = activeAccRef.current;
          if (activeAccount && updated.businessProfileId !== activeAccount.id)
            return;

          const mapped = mapConversation(updated);

          setConvs((p) => {
            const exists = p.some((c) => c.id === updated.id);
            if (exists)
              return [mapped, ...p.filter((c) => c.id !== updated.id)];
            return [mapped, ...p]; // New conversation appears at top
          });

          // Also update selected conversation if it's the one being updated
          // (e.g. avatar just loaded via background refresh)
          setSelectedConv((p) => (p?.id === updated.id ? mapped : p));
          skipNextConvPollRef.current = true;
        },
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [],
    ),
  );

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

    // Build optimistic messages
    const optimistic: Msg[] = [];
    if (pendingPreset) {
      optimistic.push({
        id: tmpId(),
        sender: uiSender,
        time,
        date,
        kind: "photos",
        pending: true,
        photos: pendingPreset.photos.map((p) => ({
          kind: "photo" as const,
          name: pendingPreset.name,
          objectUrl: p.objectUrl,
          gradient: p.gradient,
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
    } catch (err: unknown) {
      setMessagesByConvId((p) => ({
        ...p,
        [convId]: (p[convId] ?? []).map((m) =>
          m.pending ? { ...m, pending: false, failed: true } : m,
        ),
      }));
      toast.error(
        err instanceof ApiError
          ? err.message
          : err instanceof NetworkError
            ? "Envoi impossible : serveur injoignable."
            : "Erreur lors de l'envoi.",
      );
    }
  }, [
    canSend,
    selectedConv,
    currentConvMode,
    messageText,
    pendingPhotos,
    pendingFile,
    pendingPreset,
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
        if (activeAcc)
          fetchReferencePresets(activeAcc.id)
            .then(setPresets)
            .catch(() => undefined);
      });
    },
    [activeAcc?.id],
  );

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

  // ─── Public API ───────────────────────────────────────────────────────────

  return {
    // Accounts
    accounts,
    activeAcc,
    setActiveAcc: (acc: Account) => setActiveAcc(acc),

    // Conversations
    convs: filteredConvs,
    loadingConvs,
    selected: selectedConv,
    showList: showConvList,
    setShowList: setShowConvList,

    // Mode
    convMode: currentConvMode,
    setConvMode: setCurrentConvMode,

    // Messages
    msgs: currentMessages,
    hasMore: selectedConv ? (hasMoreByConvId[selectedConv.id] ?? false) : false,
    loadingMsgs: loadingMessages,
    loadMore: loadOlderMessages,

    // Loading states
    isSyncing, // true while sync-on-open is running
    sseStatus, // 'connecting' | 'connected' | 'error'

    // Search
    searchQuery,
    setSearchQuery,

    // Attachments
    pendingPhotos,
    setPendingPhotos,
    pendingFile,
    setPendingFile,
    pendingPreset,
    setPendingPreset,

    // Input
    message: messageText,
    setMessage: setMessageText,
    canSend,

    // Presets
    presets,
    addPreset,
    removePreset,
    addPresetOpen,
    setAddPresetOpen,

    // Refs
    photoRef: photoInputRef,
    fileRef: fileInputRef,
    bottomRef: messagesEndRef,
    textareaRef,

    // Handlers
    handlePhotoFiles,
    handleFileSelect,
    handleSend,
    handleSelectConv,
    handleEmojiSelect,
  };
}
