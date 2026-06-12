/**
 * @file features/inbox/store/inbox.store.ts
 *
 * Léger store Zustand pour le compteur de messages non lus de l'inbox.
 * Découplé de useInbox pour être lisible depuis n'importe quel composant
 * (sidebar, notifications, etc.) sans monter tout le hook inbox.
 *
 * Alimentation :
 *   - useInbox met à jour ce store via setInboxUnreadCount()
 *     à chaque nouveau message SSE et à chaque polling de conversations.
 *
 * Lecture :
 *   - SidebarNav lit useInboxUnreadCount() pour afficher le badge dynamique.
 */

import { create } from "zustand";

interface InboxStore {
  unreadCount: number;
  setUnreadCount: (count: number) => void;
  incrementUnread: () => void;
  clearUnread: () => void;
}

export const useInboxStore = create<InboxStore>((set) => ({
  unreadCount: 0,

  setUnreadCount: (count) => set({ unreadCount: count }),

  incrementUnread: () => set((s) => ({ unreadCount: s.unreadCount + 1 })),

  clearUnread: () => set({ unreadCount: 0 }),
}));

/** Selector: just the count — avoids re-renders on action changes */
export const useInboxUnreadCount = () => useInboxStore((s) => s.unreadCount);
