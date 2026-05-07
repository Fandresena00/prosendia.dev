"use client";

/**
 * @file features/inbox/hooks/useInbox.ts
 *
 * Central state hook for the inbox page.
 *
 * CHANGES:
 *   - SSE onNewMessage / onConversationUpdated: filter events by activeAcc.id
 *     to prevent conversations from other connected pages polluting the list.
 *   - apiMsgToUiMsg: handles referenceImageUrls (multiple preset images)
 *     in addition to single imageUrl, so preset sends display all photos.
 *   - Message loading: replaced msgMap in effect deps with a loadedConvIds ref
 *     to prevent the effect from firing on every message update.
 *   - setActiveAcc: removed the stale-convs lookup; the existing useEffect
 *     on activeAcc correctly handles loading the new account's conversations.
 *   - All variable names made more explicit.
 */

import { ApiError, AuthenticationError, NetworkError } from "@/lib/errors";
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
} from "../services/inbox.service";
import type {
  Account,
  Conv,
  ConversationUpdatedSsePayload,
  ConvMode,
  FileAttachment,
  MessageApiResponse,
  Msg,
  NewMessageSsePayload,
  PhotoAttachment,
  PhotoPreset,
} from "../types/inbox.types";
import { useInboxSse } from "./use-inbox-sse";

// ─── Constants ────────────────────────────────────────────────────────────────

const MESSAGES_PER_PAGE = 30;

const PHOTO_GRADIENT_PALETTE = [
  "from-blue-500/40 to-indigo-600/30",
  "from-violet-500/40 to-purple-600/30",
  "from-emerald-500/40 to-teal-600/30",
  "from-amber-500/40 to-orange-600/30",
  "from-rose-500/40 to-pink-600/30",
  "from-cyan-500/40 to-sky-600/30",
];

// ─── API message → UI Msg mapper ──────────────────────────────────────────────

function formatMessageTime(isoDateString: string): string {
  return new Date(isoDateString).toLocaleTimeString("fr-FR", {
    hour:   "2-digit",
    minute: "2-digit",
  });
}

function formatMessageDate(isoDateString: string): string {
  const messageDate = new Date(isoDateString);
  const today       = new Date();
  const diffDays    = Math.floor(
    (today.getTime() - messageDate.getTime()) / 86_400_000,
  );
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return "Hier";
  return messageDate.toLocaleDateString("fr-FR", {
    weekday: "long",
    day:     "numeric",
    month:   "long",
  });
}

function apiMsgToUiMsg(apiMessage: MessageApiResponse): Msg {
  const uiSender =
    apiMessage.sender === "CLIENT" ? "client"
    : apiMessage.sender === "AI"   ? "ai"
    : apiMessage.sender === "PAGE" ? "page"
    : "human";

  const messageTime = formatMessageTime(apiMessage.createdAt);
  const messageDate = formatMessageDate(apiMessage.createdAt);

  // FIX: Handle multiple reference image URLs (preset sends with > 1 photo)
  if (apiMessage.referenceImageUrls?.length > 0) {
    return {
      id:         apiMessage.id,
      sender:     uiSender,
      time:       messageTime,
      date:       messageDate,
      kind:       "photos",
      externalId: apiMessage.externalId,
      photos:     apiMessage.referenceImageUrls.map((url, index) => ({
        kind:      "photo" as const,
        name:      "image",
        objectUrl: url,
        gradient:  PHOTO_GRADIENT_PALETTE[index % PHOTO_GRADIENT_PALETTE.length],
      })),
    };
  }

  if (apiMessage.imageUrl) {
    return {
      id:         apiMessage.id,
      sender:     uiSender,
      time:       messageTime,
      date:       messageDate,
      kind:       "photos",
      externalId: apiMessage.externalId,
      photos: [
        {
          kind:      "photo" as const,
          name:      "image",
          objectUrl: apiMessage.imageUrl,
          gradient:  PHOTO_GRADIENT_PALETTE[0],
        },
      ],
    };
  }

  if (apiMessage.fileUrl) {
    return {
      id:         apiMessage.id,
      sender:     uiSender,
      time:       messageTime,
      date:       messageDate,
      kind:       "file",
      externalId: apiMessage.externalId,
      file: {
        kind:      "file",
        name:      apiMessage.content ?? "Fichier",
        objectUrl: apiMessage.fileUrl,
      },
    };
  }

  return {
    id:         apiMessage.id,
    sender:     uiSender,
    time:       messageTime,
    date:       messageDate,
    kind:       "text",
    content:    apiMessage.content ?? "",
    externalId: apiMessage.externalId,
  };
}

function nowTimeString(): string {
  return new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

let temporaryIdCounter = 0;
function generateTemporaryId(): string {
  return `tmp-${++temporaryIdCounter}`;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useInbox() {
  // ── Accounts & conversations ─────────────────────────────────────────────
  const [accounts,     setAccounts]     = useState<Account[]>([]);
  const [activeAcc,    setActiveAcc]    = useState<Account | null>(null);
  const [convs,        setConvs]        = useState<Conv[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conv | null>(null);
  const [showConvList, setShowConvList] = useState(true);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [searchQuery,  setSearchQuery]  = useState("");
  const [uiError,      setUiError]      = useState<string | null>(null);

  // ── Messages ─────────────────────────────────────────────────────────────
  const [messagesByConvId, setMessagesByConvId] = useState<Record<string, Msg[]>>({});
  const [cursorByConvId,   setCursorByConvId]   = useState<Record<string, string | null>>({});
  const [hasMoreByConvId,  setHasMoreByConvId]  = useState<Record<string, boolean>>({});
  const [loadingMessages,  setLoadingMessages]  = useState(false);

  // FIX: Track which conversations have already been loaded to avoid
  //      re-fetching on every messagesByConvId state update
  const loadedConvIdsRef = useRef<Set<string>>(new Set());

  // ── Conversation mode (AI / Human) ───────────────────────────────────────
  const [modeByConvId, setModeByConvId] = useState<Record<string, ConvMode>>({});
  const currentConvMode = selectedConv
    ? (modeByConvId[selectedConv.id] ?? selectedConv.mode)
    : "ai";

  const setCurrentConvMode = useCallback(
    (newMode: ConvMode) => {
      if (!selectedConv) return;
      setModeByConvId((prev) => ({ ...prev, [selectedConv.id]: newMode }));
      setHandover(selectedConv.id, newMode === "ai" ? "AI" : "HUMAN").catch(
        () => undefined,
      );
    },
    [selectedConv],
  );

  // ── Attachments ──────────────────────────────────────────────────────────
  const [pendingPhotos,   setPendingPhotos]  = useState<PhotoAttachment[]>([]);
  const [pendingFile,     setPendingFile]    = useState<FileAttachment | null>(null);
  const [pendingPreset,   setPendingPreset]  = useState<PhotoPreset | null>(null);
  const [messageText,     setMessageText]    = useState("");

  // ── Reference image presets ───────────────────────────────────────────────
  const [presets,        setPresets]        = useState<PhotoPreset[]>([]);
  const [addPresetOpen,  setAddPresetOpen]  = useState(false);

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const photoInputRef    = useRef<HTMLInputElement>(null);
  const fileInputRef     = useRef<HTMLInputElement>(null);
  const messagesEndRef   = useRef<HTMLDivElement>(null);
  const textareaRef      = useRef<HTMLTextAreaElement>(null);
  const selectedConvRef  = useRef<Conv | null>(null);
  const activeAccRef     = useRef<Account | null>(null);

  // File staging refs (keep the actual File objects alongside UI state)
  const stagedPhotoFilesRef = useRef<File[]>([]);
  const stagedFileRef       = useRef<File | null>(null);

  useEffect(() => { selectedConvRef.current = selectedConv; }, [selectedConv]);
  useEffect(() => { activeAccRef.current    = activeAcc;    }, [activeAcc]);

  // ─── Load accounts on mount ───────────────────────────────────────────────
  useEffect(() => {
    fetchAccounts()
      .then((loadedAccounts) => {
        setAccounts(loadedAccounts);
        if (loadedAccounts.length > 0) setActiveAcc(loadedAccounts[0]);
      })
      .catch((err: unknown) => {
        const errorMessage =
          err instanceof AuthenticationError
            ? "Session expirée. Veuillez vous reconnecter."
            : err instanceof NetworkError
              ? "Impossible de contacter le serveur."
              : err instanceof ApiError
                ? err.message
                : "Erreur lors du chargement des pages Facebook.";
        setUiError(errorMessage);
        toast.error(errorMessage);
      });
  }, []);

  // ─── Load conversations when active account changes ───────────────────────
  useEffect(() => {
    if (!activeAcc) return;

    setLoadingConvs(true);
    setConvs([]);
    setSelectedConv(null);
    setPresets([]);
    loadedConvIdsRef.current.clear();

    fetchConversations({ businessProfileId: activeAcc.id, pageSize: 30 })
      .then(({ data: loadedConvs }) => {
        setConvs(loadedConvs);
        if (loadedConvs.length > 0) setSelectedConv(loadedConvs[0]);
      })
      .catch((err: unknown) => {
        const errorMessage =
          err instanceof NetworkError
            ? "Impossible de charger les conversations."
            : err instanceof ApiError
              ? err.message
              : "Erreur lors du chargement des conversations.";
        setUiError(errorMessage);
        toast.error(errorMessage);
      })
      .finally(() => setLoadingConvs(false));
  }, [activeAcc?.id]);

  // ─── Load reference presets when active account changes ───────────────────
  useEffect(() => {
    if (!activeAcc) return;
    fetchReferencePresets(activeAcc.id)
      .then(setPresets)
      .catch(() => {
        toast.error("Impossible de charger les images de référence.");
      });
  }, [activeAcc?.id]);

  // ─── Filtered conversations (search) ─────────────────────────────────────
  const filteredConvs = useMemo(() => {
    if (!searchQuery.trim()) return convs;
    const lowercaseQuery = searchQuery.toLowerCase();
    return convs.filter(
      (conv) =>
        conv.client.toLowerCase().includes(lowercaseQuery) ||
        conv.lastMessage.toLowerCase().includes(lowercaseQuery),
    );
  }, [convs, searchQuery]);

  // ─── Load messages for the selected conversation ──────────────────────────
  // FIX: Depends only on selectedConv.id — not the full messagesByConvId map.
  //      This prevents re-fetching every time a new message arrives.
  useEffect(() => {
    if (!selectedConv) return;
    if (loadedConvIdsRef.current.has(selectedConv.id)) return;

    loadedConvIdsRef.current.add(selectedConv.id);
    setLoadingMessages(true);

    fetchMessages(selectedConv.id, { limit: MESSAGES_PER_PAGE })
      .then((page) => {
        // Backend returns newest-first — reverse for chronological display
        const chronologicalMessages = [...page.messages]
          .reverse()
          .map(apiMsgToUiMsg);

        setMessagesByConvId((prev) => ({
          ...prev,
          [selectedConv.id]: chronologicalMessages,
        }));
        setCursorByConvId((prev) => ({
          ...prev,
          [selectedConv.id]: page.nextCursor,
        }));
        setHasMoreByConvId((prev) => ({
          ...prev,
          [selectedConv.id]: page.hasMore,
        }));

        markConversationRead(selectedConv.id).catch(() => undefined);
        setConvs((prev) =>
          prev.map((c) =>
            c.id === selectedConv.id ? { ...c, unread: 0 } : c,
          ),
        );
      })
      .catch((err: unknown) => {
        // Remove from loaded set so it can be retried
        loadedConvIdsRef.current.delete(selectedConv.id);
        const errorMessage =
          err instanceof NetworkError
            ? "Impossible de charger les messages."
            : err instanceof ApiError
              ? err.message
              : "Erreur lors du chargement des messages.";
        setUiError(errorMessage);
        toast.error(errorMessage);
      })
      .finally(() => setLoadingMessages(false));
  }, [selectedConv?.id]);

  // ─── Scroll to latest message ─────────────────────────────────────────────
  const currentMessages = selectedConv
    ? (messagesByConvId[selectedConv.id] ?? [])
    : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages.length]);

  // ─── Load older messages (cursor pagination) ──────────────────────────────
  const loadOlderMessages = useCallback(async () => {
    if (!selectedConv) return;
    const paginationCursor = cursorByConvId[selectedConv.id];
    if (!paginationCursor) return;

    setLoadingMessages(true);
    try {
      const page = await fetchMessages(selectedConv.id, {
        before: paginationCursor,
        limit:  MESSAGES_PER_PAGE,
      });
      const olderMessages = [...page.messages].reverse().map(apiMsgToUiMsg);

      setMessagesByConvId((prev) => ({
        ...prev,
        [selectedConv.id]: [...olderMessages, ...(prev[selectedConv.id] ?? [])],
      }));
      setCursorByConvId((prev) => ({
        ...prev,
        [selectedConv.id]: page.nextCursor,
      }));
      setHasMoreByConvId((prev) => ({
        ...prev,
        [selectedConv.id]: page.hasMore,
      }));
    } catch (err: unknown) {
      const errorMessage =
        err instanceof NetworkError
          ? "Impossible de charger plus de messages."
          : err instanceof ApiError
            ? err.message
            : "Erreur lors du chargement des messages.";
      setUiError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoadingMessages(false);
    }
  }, [selectedConv?.id, cursorByConvId]);

  // ─── SSE real-time updates ────────────────────────────────────────────────
  useInboxSse({
    onNewMessage: useCallback(
      ({ conversationId, message: incomingApiMessage }: NewMessageSsePayload) => {
        // FIX: Ignore SSE messages for conversations outside the active account
        const activeAccount = activeAccRef.current;

        const incomingUiMessage = apiMsgToUiMsg(incomingApiMessage);

        setMessagesByConvId((prev) => {
          const existingMessages = prev[conversationId] ?? [];
          // Skip if message already in state (optimistic update or duplicate)
          if (
            existingMessages.some(
              (msg) =>
                msg.id === incomingUiMessage.id ||
                (incomingUiMessage.externalId &&
                  msg.externalId === incomingUiMessage.externalId),
            )
          ) {
            return prev;
          }
          // Remove any matching optimistic (pending) message with no externalId
          const withoutMatchingOptimistic = existingMessages.filter(
            (msg) => !(msg.pending && !msg.externalId),
          );
          return {
            ...prev,
            [conversationId]: [...withoutMatchingOptimistic, incomingUiMessage],
          };
        });

        const isActiveConversation = selectedConvRef.current?.id === conversationId;
        const shouldIncrementUnread =
          incomingApiMessage.sender === "CLIENT" && !isActiveConversation;

        setConvs((prev) =>
          prev.map((conv) =>
            conv.id === conversationId
              ? {
                  ...conv,
                  lastMessage: incomingApiMessage.content ?? "📷",
                  time:        new Date(incomingApiMessage.createdAt).toLocaleTimeString("fr-FR", {
                    hour: "2-digit", minute: "2-digit",
                  }),
                  unread: shouldIncrementUnread
                    ? conv.unread + 1
                    : conv.unread,
                }
              : conv,
          ),
        );

        if (isActiveConversation) {
          markConversationRead(conversationId).catch(() => undefined);
          setConvs((prev) =>
            prev.map((conv) =>
              conv.id === conversationId ? { ...conv, unread: 0 } : conv,
            ),
          );
        }
      },
      [],
    ),

    onConversationUpdated: useCallback(
      ({ conversation: updatedApiConv }: ConversationUpdatedSsePayload) => {
        // FIX: Only process updates for the active account
        const activeAccount = activeAccRef.current;
        if (
          activeAccount &&
          updatedApiConv.businessProfileId !== activeAccount.id
        ) {
          return;
        }

        const mappedConv = mapConversation(updatedApiConv);

        setConvs((prev) => {
          const existingIndex = prev.findIndex((c) => c.id === updatedApiConv.id);
          if (existingIndex >= 0) {
            // Update existing and move to top
            const updated = prev.map((c) =>
              c.id === updatedApiConv.id ? mappedConv : c,
            );
            return [
              mappedConv,
              ...updated.filter((c) => c.id !== updatedApiConv.id),
            ];
          }
          // New conversation — prepend
          return [mappedConv, ...prev];
        });

        setSelectedConv((prev) =>
          prev?.id === updatedApiConv.id ? mappedConv : prev,
        );
      },
      [],
    ),
  });

  // ─── File picker handlers ─────────────────────────────────────────────────
  const handlePhotoFilePick = useCallback((fileList: FileList | null) => {
    if (!fileList) return;
    const newFiles = Array.from(fileList);
    stagedPhotoFilesRef.current = [...stagedPhotoFilesRef.current, ...newFiles];
    setPendingPhotos((prev) => [
      ...prev,
      ...newFiles.map((file, index) => ({
        kind:      "photo" as const,
        name:      file.name,
        objectUrl: URL.createObjectURL(file),
        gradient:
          PHOTO_GRADIENT_PALETTE[(prev.length + index) % PHOTO_GRADIENT_PALETTE.length],
      })),
    ]);
  }, []);

  const handleSingleFilePick = useCallback((fileList: FileList | null) => {
    const pickedFile = fileList?.[0];
    if (!pickedFile) return;
    stagedFileRef.current = pickedFile;
    setPendingFile({
      kind: "file",
      name: pickedFile.name,
      size:
        pickedFile.size > 1_048_576
          ? `${(pickedFile.size / 1_048_576).toFixed(1)} Mo`
          : `${Math.round(pickedFile.size / 1024)} Ko`,
      objectUrl: URL.createObjectURL(pickedFile),
    });
  }, []);

  // ─── Send handler ─────────────────────────────────────────────────────────
  const canSend = !!(
    messageText.trim() ||
    pendingPhotos.length ||
    pendingFile ||
    pendingPreset
  );

  const handleSend = useCallback(async () => {
    if (!canSend || !selectedConv) return;

    const conversationId = selectedConv.id;
    const sendTimestamp  = nowTimeString();
    const sendDate       = "Aujourd'hui";
    const messageSender  =
      currentConvMode === "ai" ? "ai"
      : currentConvMode === "human" ? "human"
      : "page";

    // ── 1. Build optimistic UI messages ────────────────────────────────────
    const optimisticMessages: Msg[] = [];

    if (pendingPreset) {
      optimisticMessages.push({
        id:      generateTemporaryId(),
        sender:  messageSender,
        time:    sendTimestamp,
        date:    sendDate,
        kind:    "photos",
        pending: true,
        photos:  pendingPreset.photos.map((photo) => ({
          kind:      "photo" as const,
          name:      pendingPreset.name,
          objectUrl: photo.objectUrl,
          gradient:  photo.gradient,
        })),
      });
    }
    if (pendingPhotos.length > 0) {
      optimisticMessages.push({
        id:      generateTemporaryId(),
        sender:  messageSender,
        time:    sendTimestamp,
        date:    sendDate,
        kind:    "photos",
        pending: true,
        photos:  [...pendingPhotos],
      });
    }
    if (pendingFile) {
      optimisticMessages.push({
        id:      generateTemporaryId(),
        sender:  messageSender,
        time:    sendTimestamp,
        date:    sendDate,
        kind:    "file",
        pending: true,
        file:    { ...pendingFile },
      });
    }
    if (messageText.trim()) {
      optimisticMessages.push({
        id:      generateTemporaryId(),
        sender:  messageSender,
        time:    sendTimestamp,
        date:    sendDate,
        kind:    "text",
        pending: true,
        content: messageText.trim(),
      });
    }

    setMessagesByConvId((prev) => ({
      ...prev,
      [conversationId]: [...(prev[conversationId] ?? []), ...optimisticMessages],
    }));

    // Snapshot and clear inputs immediately for snappy UX
    const textToSend           = messageText.trim();
    const fileAttachmentToSend = pendingFile;
    const presetToSend         = pendingPreset;
    const photoFilesToUpload   = [...stagedPhotoFilesRef.current];
    const fileToUpload         = stagedFileRef.current;

    setMessageText("");
    setPendingPhotos([]);
    setPendingFile(null);
    setPendingPreset(null);
    stagedPhotoFilesRef.current = [];
    stagedFileRef.current       = null;

    // ── 2. Send to backend ────────────────────────────────────────────────
    try {
      // Preset reference images (already stored as permanent backend URLs)
      if (presetToSend?.referenceImageUrls?.length) {
        await sendImagesMessage(
          conversationId,
          presetToSend.referenceImageUrls,
          textToSend || undefined,
        );
      }

      // Ad-hoc photo files — upload to get temp public URLs, then send to Facebook
      if (photoFilesToUpload.length > 0) {
        const publicImageUrls: string[] = [];
        for (const photoFile of photoFilesToUpload) {
          const publicUrl = await getTempUploadUrl(photoFile);
          publicImageUrls.push(publicUrl);
        }
        await sendImagesMessage(conversationId, publicImageUrls);
      }

      // File attachment — upload to get temp public URL, then send to Facebook
      if (fileToUpload && fileAttachmentToSend) {
        const publicFileUrl = await getTempUploadUrl(fileToUpload);
        await sendFileMessage(conversationId, publicFileUrl, fileAttachmentToSend.name);
      }

      // Text message (sent last so it appears after images in the conversation)
      // Skip if already sent as caption with a preset
      if (textToSend && !presetToSend?.referenceImageUrls?.length) {
        await sendTextMessage(conversationId, textToSend);
      }

      // Confirm optimistic messages (remove pending state)
      setMessagesByConvId((prev) => ({
        ...prev,
        [conversationId]: (prev[conversationId] ?? []).map((msg) =>
          msg.pending ? { ...msg, pending: false } : msg,
        ),
      }));
    } catch (err: unknown) {
      // Mark optimistic messages as failed
      setMessagesByConvId((prev) => ({
        ...prev,
        [conversationId]: (prev[conversationId] ?? []).map((msg) =>
          msg.pending ? { ...msg, pending: false, failed: true } : msg,
        ),
      }));

      const errorMessage =
        err instanceof ApiError
          ? err.message
          : err instanceof NetworkError
            ? "Envoi impossible : serveur injoignable."
            : "Erreur lors de l'envoi du message.";
      setUiError(errorMessage);
      toast.error(errorMessage);
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

  // ─── Preset management ────────────────────────────────────────────────────
  const addPreset = useCallback(
    async (presetData: Omit<PhotoPreset, "id"> & { files?: File[] }) => {
      if (!activeAcc || !presetData.files?.length) return;
      const newPreset = await createReferencePreset({
        businessProfileId: activeAcc.id,
        name:              presetData.name,
        description:       presetData.description,
        files:             presetData.files,
      });
      setPresets((prev) => [newPreset, ...prev]);
    },
    [activeAcc?.id],
  );

  const removePreset = useCallback(
    (presetId: string) => {
      setPresets((prev) => prev.filter((p) => p.id !== presetId));
      deleteReferencePreset(presetId).catch(() => {
        toast.error("Impossible de supprimer cette image de référence.");
        // Re-fetch to restore the list if the delete failed
        if (activeAcc) {
          fetchReferencePresets(activeAcc.id)
            .then(setPresets)
            .catch(() => undefined);
        }
      });
    },
    [activeAcc?.id],
  );

  // ─── Emoji ────────────────────────────────────────────────────────────────
  const handleEmojiSelect = useCallback((emoji: { native: string }) => {
    setMessageText((prev) => prev + emoji.native);
    textareaRef.current?.focus();
  }, []);

  // ─── Conversation selection ───────────────────────────────────────────────
  const handleSelectConv = useCallback((conv: Conv) => {
    setSelectedConv(conv);
    setShowConvList(false);
  }, []);

  return {
    // Accounts
    accounts,
    activeAcc,
    // FIX: setActiveAcc only switches the account — the useEffect on activeAcc.id
    //      handles loading the new account's conversations automatically.
    setActiveAcc: (account: Account) => setActiveAcc(account),

    // Conversations
    convs:        filteredConvs,
    loadingConvs,
    selected:     selectedConv,
    showList:     showConvList,
    setShowList:  setShowConvList,

    // Conversation mode
    convMode:    currentConvMode,
    setConvMode: setCurrentConvMode,

    // Messages
    msgs:        currentMessages,
    hasMore:     selectedConv ? (hasMoreByConvId[selectedConv.id] ?? false) : false,
    loadingMsgs: loadingMessages,
    loadMore:    loadOlderMessages,

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
    message:          messageText,
    setMessage:       setMessageText,
    canSend,

    // Presets
    presets,
    addPreset,
    removePreset,
    addPresetOpen,
    setAddPresetOpen,

    // DOM refs
    photoRef:     photoInputRef,
    fileRef:      fileInputRef,
    bottomRef:    messagesEndRef,
    textareaRef,

    // Handlers
    handlePhotoFiles:  handlePhotoFilePick,
    handleFileSelect:  handleSingleFilePick,
    handleSend,
    handleSelectConv,
    handleEmojiSelect,

    uiError,
  };
}
