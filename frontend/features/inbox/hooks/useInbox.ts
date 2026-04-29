"use client";

/**
 * @file features/inbox/hooks/useInbox.ts
 *
 * Central state hook for the inbox page.
 * Replaces all mock data with real backend calls.
 *
 * Key behaviours:
 *  - Loads Facebook connections as Accounts on mount
 *  - Loads conversations for the active account on account switch
 *  - Loads messages with cursor pagination (load-older on scroll-to-top)
 *  - SSE-driven real-time updates (new messages, conversation updates)
 *  - Optimistic message send: message appears immediately, confirmed by SSE/response
 *  - Reference image uploads go to backend; all other attachments go direct to FB
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchAccounts,
  fetchConversations,
  fetchMessages,
  mapConversation,
  markConversationRead,
  sendFileMessage,
  sendImagesMessage,
  sendTextMessage,
  setHandover,
  triggerSync,
  uploadReferenceImages,
} from "../services/inbox.service";
import type {
  Account,
  Conv,
  ConvMode,
  ConversationUpdatedSsePayload,
  FileAttachment,
  MessageApiResponse,
  Msg,
  NewMessageSsePayload,
  PhotoAttachment,
  PhotoPreset,
} from "../types/inbox.types";
import { useInboxSse } from "./use-inbox-sse";

// ─── Constants ────────────────────────────────────────────────────────────────

const MSG_PAGE_SIZE = 30;
const PHOTO_GRADS = [
  "from-blue-500/40 to-indigo-600/30",
  "from-violet-500/40 to-purple-600/30",
  "from-emerald-500/40 to-teal-600/30",
  "from-amber-500/40 to-orange-600/30",
  "from-rose-500/40 to-pink-600/30",
  "from-cyan-500/40 to-sky-600/30",
];

// ─── Mapper: API message → UI Msg ─────────────────────────────────────────────

function formatMsgTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMsgDate(isoDate: string): string {
  const d = new Date(isoDate);
  const today = new Date();
  const diffDays = Math.floor((today.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return "Hier";
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function apiMsgToUiMsg(m: MessageApiResponse): Msg {
  const sender =
    m.sender === "CLIENT"
      ? "client"
      : m.sender === "AI"
        ? "ai"
        : m.sender === "PAGE"
          ? "page"
          : "human";

  const time = formatMsgTime(m.createdAt);
  const date = formatMsgDate(m.createdAt);

  if (m.imageUrl) {
    return {
      id: m.id,
      sender,
      time,
      date,
      kind: "photos",
      externalId: m.externalId,
      photos: [
        {
          kind: "photo",
          name: "image",
          objectUrl: m.imageUrl,
          gradient: PHOTO_GRADS[0],
        },
      ],
    };
  }
  if (m.fileUrl) {
    return {
      id: m.id,
      sender,
      time,
      date,
      kind: "file",
      externalId: m.externalId,
      file: {
        kind: "file",
        name: m.content ?? "Fichier",
        objectUrl: m.fileUrl,
      },
    };
  }
  return {
    id: m.id,
    sender,
    time,
    date,
    kind: "text",
    content: m.content ?? "",
    externalId: m.externalId,
  };
}

function nowTime(): string {
  return new Date().toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
let _tmpId = 0;
function tempId(): string {
  return `tmp-${++_tmpId}`;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useInbox() {
  // ── Accounts & conversations ────────────────────────────────────────────
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAcc, setActiveAcc] = useState<Account | null>(null);
  const [convs, setConvs] = useState<Conv[]>([]);
  const [selected, setSelected] = useState<Conv | null>(null);
  const [showList, setShowList] = useState(true);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // ── Messages ────────────────────────────────────────────────────────────
  const [msgMap, setMsgMap] = useState<Record<string, Msg[]>>({});
  const [cursorMap, setCursorMap] = useState<Record<string, string | null>>({});
  const [hasMoreMap, setHasMoreMap] = useState<Record<string, boolean>>({});
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  // ── Conversation mode ────────────────────────────────────────────────────
  const [modeMap, setModeMap] = useState<Record<string, ConvMode>>({});
  const convMode = selected ? (modeMap[selected.id] ?? selected.mode) : "ai";
  const setConvMode = useCallback(
    (mode: ConvMode) => {
      if (!selected) return;
      setModeMap((p) => ({ ...p, [selected.id]: mode }));
      // Persist handover status to backend
      setHandover(selected.id, mode === "ai" ? "AI" : "HUMAN").catch(
        () => undefined,
      );
    },
    [selected],
  );

  // ── Attachments ──────────────────────────────────────────────────────────
  const [pendingPhotos, setPendingPhotos] = useState<PhotoAttachment[]>([]);
  const [pendingFile, setPendingFile] = useState<FileAttachment | null>(null);
  const [pendingPreset, setPendingPreset] = useState<PhotoPreset | null>(null);
  const [message, setMessage] = useState("");

  // ── Presets ──────────────────────────────────────────────────────────────
  const [presets, setPresets] = useState<PhotoPreset[]>([]);
  const [addPresetOpen, setAddPresetOpen] = useState(false);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const photoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Pending file refs for send ────────────────────────────────────────────
  const pendingPhotoFilesRef = useRef<File[]>([]);
  const pendingFileRef = useRef<File | null>(null);

  // ─── Load accounts on mount ──────────────────────────────────────────────
  useEffect(() => {
    let ignore = false;

    fetchAccounts()
      .then((accs) => {
        if (ignore) return;
        setAccounts(accs);
        if (accs.length > 0) {
          setActiveAcc(accs[0]);
        } else {
          setLoadingConvs(false);
        }
      })
      .catch(() => {
        if (ignore) return;
        setAccounts([]);
        setActiveAcc(null);
        setLoadingConvs(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  // ─── Load conversations when active account changes ──────────────────────
  useEffect(() => {
    if (!activeAcc) return;
    let ignore = false;

    setLoadingConvs(true);
    setConvs([]);
    setSelected(null);

    fetchConversations({ businessProfileId: activeAcc.id, pageSize: 30 })
      .then(({ data }) => {
        if (ignore) return;
        setConvs(data);
        if (data.length > 0) setSelected(data[0]);
      })
      .catch(() => {
        if (ignore) return;
        setConvs([]);
        setSelected(null);
      })
      .finally(() => {
        if (!ignore) setLoadingConvs(false);
      });

    triggerSync(activeAcc.id)
      .then(() =>
        fetchConversations({ businessProfileId: activeAcc.id, pageSize: 30 }),
      )
      .then(({ data }) => {
        if (ignore) return;
        setConvs(data);
        setSelected((current) => current ?? data[0] ?? null);
      })
      .catch(() => undefined);

    return () => {
      ignore = true;
    };
  }, [activeAcc]);

  // ─── Filtered conversations ──────────────────────────────────────────────
  const filteredConvs = useMemo(() => {
    if (!searchQuery.trim()) return convs;
    const q = searchQuery.toLowerCase();
    return convs.filter(
      (c) =>
        c.client.toLowerCase().includes(q) ||
        c.lastMessage.toLowerCase().includes(q),
    );
  }, [convs, searchQuery]);

  // ─── Load messages for selected conversation ─────────────────────────────
  useEffect(() => {
    if (!selected) return;
    if (msgMap[selected.id]) return; // Already loaded
    let ignore = false;

    setLoadingMsgs(true);
    fetchMessages(selected.id, { limit: MSG_PAGE_SIZE })
      .then((page) => {
        if (ignore) return;
        // Backend returns newest-first; reverse for chronological display
        const ordered = [...page.messages].reverse().map(apiMsgToUiMsg);
        setMsgMap((p) => ({ ...p, [selected.id]: ordered }));
        setCursorMap((p) => ({ ...p, [selected.id]: page.nextCursor }));
        setHasMoreMap((p) => ({ ...p, [selected.id]: page.hasMore }));
        markConversationRead(selected.id).catch(() => undefined);
      })
      .catch(() => {
        if (ignore) return;
        setMsgMap((p) => ({ ...p, [selected.id]: [] }));
        setCursorMap((p) => ({ ...p, [selected.id]: null }));
        setHasMoreMap((p) => ({ ...p, [selected.id]: false }));
      })
      .finally(() => {
        if (!ignore) setLoadingMsgs(false);
      });

    return () => {
      ignore = true;
    };
  }, [selected, msgMap]);

  // ─── Scroll to bottom on new messages ────────────────────────────────────
  const msgs = selected ? (msgMap[selected.id] ?? []) : [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  // ─── Load older messages (cursor pagination) ─────────────────────────────
  const loadMore = useCallback(async () => {
    if (!selected) return;
    const cursor = cursorMap[selected.id];
    if (!cursor) return;

    setLoadingMsgs(true);
    try {
      const page = await fetchMessages(selected.id, {
        before: cursor,
        limit: MSG_PAGE_SIZE,
      });
      const older = [...page.messages].reverse().map(apiMsgToUiMsg);
      setMsgMap((p) => ({
        ...p,
        [selected.id]: [...older, ...(p[selected.id] ?? [])],
      }));
      setCursorMap((p) => ({ ...p, [selected.id]: page.nextCursor }));
      setHasMoreMap((p) => ({ ...p, [selected.id]: page.hasMore }));
    } catch {
      setHasMoreMap((p) => ({ ...p, [selected.id]: false }));
    } finally {
      setLoadingMsgs(false);
    }
  }, [selected, cursorMap]);

  // ─── SSE real-time updates ────────────────────────────────────────────────
  useInboxSse({
    onNewMessage: useCallback(
      ({ conversationId, message: apiMsg }: NewMessageSsePayload) => {
        const uiMsg = apiMsgToUiMsg(apiMsg);
        setMsgMap((p) => {
          const existing = p[conversationId] ?? [];
          // Remove optimistic duplicate if present
          const withoutOptimistic = existing.filter(
            (m) => !(m.pending && m.externalId == null),
          );
          return { ...p, [conversationId]: [...withoutOptimistic, uiMsg] };
        });
        // Update conversation last message
        setConvs((prev) =>
          prev.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  lastMessage: apiMsg.content ?? "📷",
                  unread: c.unread + 1,
                }
              : c,
          ),
        );
      },
      [],
    ),

    onConversationUpdated: useCallback(
      ({ conversation }: ConversationUpdatedSsePayload) => {
        setConvs((prev) =>
          prev.some((c) => c.id === conversation.id)
            ? prev.map((c) =>
                c.id === conversation.id ? mapConversation(conversation) : c,
              )
            : [mapConversation(conversation), ...prev],
        );
      },
      [],
    ),
  });

  // ─── File pickers ─────────────────────────────────────────────────────────
  const handlePhotoFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files);
    pendingPhotoFilesRef.current = [...pendingPhotoFilesRef.current, ...arr];
    setPendingPhotos((p) => [
      ...p,
      ...arr.map((f, i) => ({
        kind: "photo" as const,
        name: f.name,
        objectUrl: URL.createObjectURL(f),
        gradient: PHOTO_GRADS[(p.length + i) % PHOTO_GRADS.length],
      })),
    ]);
  }, []);

  const handleFileSelect = useCallback((files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    pendingFileRef.current = f;
    setPendingFile({
      kind: "file",
      name: f.name,
      size:
        f.size > 1_048_576
          ? `${(f.size / 1_048_576).toFixed(1)} Mo`
          : `${Math.round(f.size / 1024)} Ko`,
      objectUrl: URL.createObjectURL(f),
    });
  }, []);

  // ─── Send ─────────────────────────────────────────────────────────────────
  const canSend = !!(
    message.trim() ||
    pendingPhotos.length ||
    pendingFile ||
    pendingPreset
  );

  const handleSend = useCallback(async () => {
    if (!canSend || !selected) return;

    const convId = selected.id;
    const t = nowTime();
    const date = "Aujourd'hui";
    const sender =
      convMode === "ai" ? "ai" : convMode === "human" ? "human" : "page";

    // ── 1. Optimistic UI update ──────────────────────────────────────────
    const optimisticMsgs: Msg[] = [];

    if (pendingPreset) {
      optimisticMsgs.push({
        id: tempId(),
        sender,
        time: t,
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
      optimisticMsgs.push({
        id: tempId(),
        sender,
        time: t,
        date,
        kind: "photos",
        pending: true,
        photos: [...pendingPhotos],
      });
    }
    if (pendingFile) {
      optimisticMsgs.push({
        id: tempId(),
        sender,
        time: t,
        date,
        kind: "file",
        pending: true,
        file: { ...pendingFile },
      });
    }
    if (message.trim()) {
      optimisticMsgs.push({
        id: tempId(),
        sender,
        time: t,
        date,
        kind: "text",
        pending: true,
        content: message.trim(),
      });
    }

    setMsgMap((p) => ({
      ...p,
      [convId]: [...(p[convId] ?? []), ...optimisticMsgs],
    }));

    // Clear inputs immediately
    const msgToSend = message.trim();
    const fileToSend = pendingFile;
    const presetToSend = pendingPreset;
    const photoFilesToSend = [...pendingPhotoFilesRef.current];
    const fileToUpload = pendingFileRef.current;

    setMessage("");
    setPendingPhotos([]);
    setPendingFile(null);
    setPendingPreset(null);
    pendingPhotoFilesRef.current = [];
    pendingFileRef.current = null;

    // ── 2. Send to backend / Facebook ────────────────────────────────────
    try {
      // Preset reference images (already stored in backend)
      if (presetToSend?.referenceImageUrls?.length) {
        await sendImagesMessage(
          convId,
          presetToSend.referenceImageUrls,
          msgToSend || undefined,
        );
      }

      // Ad-hoc photo files — upload to get a temp URL, then send to FB
      if (photoFilesToSend.length > 0) {
        // We upload one by one via the temp endpoint and collect URLs
        const { getTempUploadUrl } = await import("../services/inbox.service");
        const imageUrls: string[] = [];
        for (const f of photoFilesToSend) {
          const url = await getTempUploadUrl(f);
          imageUrls.push(url);
        }
        await sendImagesMessage(convId, imageUrls);
      }

      // File attachment
      if (fileToUpload && fileToSend) {
        const { getTempUploadUrl } = await import("../services/inbox.service");
        const fileUrl = await getTempUploadUrl(fileToUpload);
        await sendFileMessage(convId, fileUrl, fileToSend.name);
      }

      // Text (sent after images/files so it appears last in FB)
      if (msgToSend && !presetToSend?.referenceImageUrls?.length) {
        await sendTextMessage(convId, msgToSend);
      }

      // Confirm optimistic messages (remove pending flag)
      setMsgMap((p) => ({
        ...p,
        [convId]: (p[convId] ?? []).map((m) =>
          m.pending ? { ...m, pending: false } : m,
        ),
      }));
    } catch {
      // Mark optimistic messages as failed
      setMsgMap((p) => ({
        ...p,
        [convId]: (p[convId] ?? []).map((m) =>
          m.pending ? { ...m, pending: false, failed: true } : m,
        ),
      }));
    }
  }, [
    canSend,
    selected,
    convMode,
    message,
    pendingPhotos,
    pendingFile,
    pendingPreset,
  ]);

  // ─── Presets ──────────────────────────────────────────────────────────────
  const addPreset = useCallback(
    async (p: Omit<PhotoPreset, "id"> & { files?: File[] }) => {
      // Upload reference images to backend if files are provided
      let referenceImageUrls: string[] = [];
      if (p.files?.length) {
        referenceImageUrls = await uploadReferenceImages(p.files);
      }
      setPresets((prev) => [
        ...prev,
        {
          ...p,
          id: Date.now(),
          referenceImageUrls,
          // Update photos with backend URLs
          photos: p.photos.map((ph, i) => ({
            ...ph,
            objectUrl: referenceImageUrls[i] ?? ph.objectUrl,
          })),
        },
      ]);
    },
    [],
  );

  const removePreset = useCallback((id: number) => {
    setPresets((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // ─── Emoji ────────────────────────────────────────────────────────────────
  const handleEmojiSelect = useCallback((emoji: { native: string }) => {
    setMessage((m) => m + emoji.native);
    textareaRef.current?.focus();
  }, []);

  // ─── Select conversation ──────────────────────────────────────────────────
  const handleSelectConv = useCallback((c: Conv) => {
    setSelected(c);
    setShowList(false);
  }, []);

  return {
    accounts,
    activeAcc,
    setActiveAcc: (acc: Account) => {
      setActiveAcc(acc);
      const firstConv = convs.find((c) => c.businessProfileId === acc.id);
      if (firstConv) handleSelectConv(firstConv);
    },
    convs: filteredConvs,
    loadingConvs,
    selected,
    showList,
    setShowList,
    convMode,
    setConvMode,
    msgs,
    hasMore: selected ? (hasMoreMap[selected.id] ?? false) : false,
    loadingMsgs,
    loadMore,
    searchQuery,
    setSearchQuery,
    pendingPhotos,
    setPendingPhotos,
    pendingFile,
    setPendingFile,
    pendingPreset,
    setPendingPreset,
    message,
    setMessage,
    presets,
    addPreset,
    removePreset,
    addPresetOpen,
    setAddPresetOpen,
    canSend,
    photoRef,
    fileRef,
    bottomRef,
    textareaRef,
    handlePhotoFiles,
    handleFileSelect,
    handleSend,
    handleSelectConv,
    handleEmojiSelect,
    // expose for ConvList
    PHOTO_GRADS,
  };
}
