"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ACCOUNTS, CONVS, INITIAL_MSGS, INITIAL_PRESETS, MSG_PAGE_SIZE, PHOTO_GRADS } from "../data/inbox.mock";
import type { Account, Conv, ConvMode, FileAttachment, Msg, PhotoAttachment, PhotoPreset } from "../types/inbox.types";
import { formatFileSize, nextId, nowTime } from "../utils/inbox.utils";

export function useInbox() {
  /* ── Account / conversation selection ── */
  const [activeAcc, setActiveAcc] = useState<Account>(ACCOUNTS[0]);
  const [selected, setSelected]   = useState<Conv>(CONVS[1][0]);
  const [showList, setShowList]   = useState(true);

  /* ── Conversation mode per-conversation ── */
  const [modeMap, setModeMap] = useState<Record<number, ConvMode>>({});
  const convMode = modeMap[selected.id] ?? selected.mode;
  const setConvMode = useCallback((mode: ConvMode) => {
    setModeMap((p) => ({ ...p, [selected.id]: mode }));
  }, [selected.id]);

  /* ── Messages ── */
  const [allMsgs, setAllMsgs] = useState<Record<number, Msg[]>>(INITIAL_MSGS);

  /* ── Lazy loading — how many messages are visible from the bottom ── */
  const [visibleCount, setVisibleCount] = useState(MSG_PAGE_SIZE);
  const msgs     = allMsgs[selected.id] ?? [];
  const visibleMsgs = useMemo(
    () => msgs.slice(Math.max(0, msgs.length - visibleCount)),
    [msgs, visibleCount],
  );
  const hasMore  = visibleCount < msgs.length;
  const loadMore = useCallback(() => setVisibleCount((v) => v + MSG_PAGE_SIZE), []);

  // Reset visible count when switching conversations
  useEffect(() => { setVisibleCount(MSG_PAGE_SIZE); }, [selected.id]);

  /* ── Search query ── */
  const [searchQuery, setSearchQuery] = useState("");
  const convs = useMemo(() => {
    const list = CONVS[activeAcc.id] ?? [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (c) =>
        c.client.toLowerCase().includes(q) ||
        c.lastMessage.toLowerCase().includes(q),
    );
  }, [activeAcc.id, searchQuery]);

  /* ── Pending attachments ── */
  const [pendingPhotos, setPendingPhotos] = useState<PhotoAttachment[]>([]);
  const [pendingFile, setPendingFile]     = useState<FileAttachment | null>(null);
  const [pendingPreset, setPendingPreset] = useState<PhotoPreset | null>(null);

  /* ── Message input ── */
  const [message, setMessage] = useState("");

  /* ── Presets ── */
  const [presets, setPresets]         = useState<PhotoPreset[]>(INITIAL_PRESETS);
  const [addPresetOpen, setAddPresetOpen] = useState(false);
  const addPreset = useCallback((p: Omit<PhotoPreset, "id">) => {
    setPresets((prev) => [...prev, { ...p, id: Date.now() }]);
  }, []);
  const removePreset = useCallback((id: number) => {
    setPresets((prev) => prev.filter((p) => p.id !== id));
  }, []);

  /* ── Refs ── */
  const photoRef    = useRef<HTMLInputElement>(null);
  const fileRef     = useRef<HTMLInputElement>(null);
  const bottomRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* ── Scroll to bottom on new messages ── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  /* ── Derived ── */
  const hasPending = pendingPhotos.length > 0 || !!pendingFile || !!pendingPreset;
  const canSend    = !!(message.trim() || hasPending);

  /* ── File pickers ── */
  const handlePhotoFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files);
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
    setPendingFile({ kind: "file", name: f.name, size: formatFileSize(f.size) });
  }, []);

  /* ── Send ── */
  const handleSend = useCallback(() => {
    if (!canSend) return;
    const t = nowTime();
    const toAdd: Msg[] = [];

    // Collect all photos (preset photos + camera picks)
    const allPhotos: PhotoAttachment[] = [];
    if (pendingPreset) {
      for (const ph of pendingPreset.photos) {
        allPhotos.push({ kind: "photo", name: pendingPreset.name, objectUrl: ph.objectUrl, gradient: ph.gradient });
      }
    }
    allPhotos.push(...pendingPhotos);

    if (allPhotos.length > 0)
      toAdd.push({ id: nextId(), sender: convMode === "ai" ? "ai" : "human", kind: "photos", photos: allPhotos, time: t, date: "Aujourd'hui", pending: true });
    if (pendingFile)
      toAdd.push({ id: nextId(), sender: convMode === "ai" ? "ai" : "human", kind: "file", file: { ...pendingFile }, time: t, date: "Aujourd'hui", pending: true });
    if (message.trim())
      toAdd.push({ id: nextId(), sender: convMode === "ai" ? "ai" : "human", kind: "text", content: message.trim(), time: t, date: "Aujourd'hui", pending: true });

    setAllMsgs((p) => ({ ...p, [selected.id]: [...(p[selected.id] ?? []), ...toAdd] }));
    setMessage("");
    setPendingPhotos([]);
    setPendingFile(null);
    setPendingPreset(null);

    // Simulate delivery confirmation
    setTimeout(() => {
      setAllMsgs((p) => ({
        ...p,
        [selected.id]: (p[selected.id] ?? []).map((m) =>
          toAdd.find((t) => t.id === m.id) ? { ...m, pending: false } : m,
        ),
      }));
    }, 1000);
  }, [canSend, convMode, message, pendingFile, pendingPhotos, pendingPreset, selected.id]);

  const handleSelectConv = useCallback((c: Conv) => {
    setSelected(c);
    setShowList(false);
  }, []);

  const handleEmojiSelect = useCallback((emoji: { native: string }) => {
    setMessage((m) => m + emoji.native);
    textareaRef.current?.focus();
  }, []);

  return {
    /* state */
    activeAcc, setActiveAcc,
    selected,
    showList, setShowList,
    convMode, setConvMode,
    visibleMsgs, hasMore, loadMore,
    searchQuery, setSearchQuery,
    convs,
    pendingPhotos, setPendingPhotos,
    pendingFile, setPendingFile,
    pendingPreset, setPendingPreset,
    message, setMessage,
    presets, addPreset, removePreset,
    addPresetOpen, setAddPresetOpen,
    hasPending, canSend,
    /* refs */
    photoRef, fileRef, bottomRef, textareaRef,
    /* handlers */
    handlePhotoFiles,
    handleFileSelect,
    handleSend,
    handleSelectConv,
    handleEmojiSelect,
  };
}
