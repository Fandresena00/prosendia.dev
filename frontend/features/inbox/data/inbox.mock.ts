import type { Account, Conv, Msg, PhotoPreset } from "../types/inbox.types";

export const PHOTO_GRADS = [
  "from-blue-500/40 to-indigo-600/30",
  "from-violet-500/40 to-purple-600/30",
  "from-emerald-500/40 to-teal-600/30",
  "from-amber-500/40 to-orange-600/30",
  "from-rose-500/40 to-pink-600/30",
  "from-cyan-500/40 to-sky-600/30",
];

export const ACCOUNTS: Account[] = [
  {
    id: 1,
    name: "Ma Boutique Mode",
    initials: "MB",
    color: "bg-primary/15 text-primary",
    pageType: "Boutique en ligne",
    verified: true,
  },
  {
    id: 2,
    name: "Ventes Privées",
    initials: "VP",
    color: "bg-violet-500/15 text-violet-500",
    pageType: "Commerce",
    verified: false,
  },
];

export const CONVS: Record<number, Conv[]> = {
  1: [
    { id: 1, accountId: 1, client: "Marie Dupont",  initials: "MD", lastMessage: "Super ! Je commande le rouge 🙌", time: "14:32", mode: "ai",    unread: 2, online: true },
    { id: 2, accountId: 1, client: "Jean Martin",   initials: "JM", lastMessage: "Livraison gratuite dès 30 000 Ar",  time: "14:25", mode: "human", unread: 1, online: false },
    { id: 3, accountId: 1, client: "Sophie Leroy",  initials: "SL", lastMessage: "Merci pour les photos !",           time: "12:18", mode: "ai",    unread: 0, online: true },
    { id: 4, accountId: 1, client: "Pierre Durand", initials: "PD", lastMessage: "PDF reçu, merci",                  time: "Hier",  mode: "human", unread: 0, online: false },
  ],
  2: [
    { id: 6, accountId: 2, client: "Amira Koné",  initials: "AK", lastMessage: "Nous avons des tarifs de gros !", time: "11:46", mode: "ai",    unread: 3, online: true },
    { id: 7, accountId: 2, client: "Rakoto Marc", initials: "RM", lastMessage: "25 000 Ar/unité pour 10 pièces.", time: "10:35", mode: "human", unread: 0, online: false },
  ],
};

const mk = (g: number) => ({ id: crypto.randomUUID(), gradient: PHOTO_GRADS[g % PHOTO_GRADS.length] });

export const INITIAL_MSGS: Record<number, Msg[]> = {
  1: [
    { id: 1, sender: "client", kind: "text", content: "Bonjour ! Ce t-shirt est disponible en rouge ?", time: "14:20", date: "Aujourd'hui" },
    { id: 2, sender: "ai",     kind: "text", content: "Bonjour Marie ! 😊 Oui, disponible en rouge, bleu et noir. Livraison sous 48h.", time: "14:20", date: "Aujourd'hui" },
    { id: 3, sender: "ai",     kind: "photos", photos: [{ kind: "photo", name: "collection-rouge.jpg", gradient: PHOTO_GRADS[0] }, { kind: "photo", name: "collection-bleu.jpg", gradient: PHOTO_GRADS[4] }], time: "14:21", date: "Aujourd'hui" },
    { id: 4, sender: "client", kind: "text", content: "Parfait ! Super je commande le rouge 🙌", time: "14:32", date: "Aujourd'hui", reactions: ["❤️"] },
  ],
  2: [
    { id: 1, sender: "client", kind: "text", content: "Quel est le prix de livraison ?", time: "14:23", date: "Aujourd'hui" },
    { id: 2, sender: "human",  kind: "text", content: "La livraison est gratuite dès 30 000 Ar !", time: "14:25", date: "Aujourd'hui" },
  ],
  3: [
    { id: 1, sender: "client", kind: "text",   content: "Je voudrais commander 2 T-shirt taille M.", time: "12:10", date: "Aujourd'hui" },
    { id: 2, sender: "client", kind: "file",   file: { kind: "file", name: "bon-commande.pdf", size: "128 Ko" }, time: "12:14", date: "Aujourd'hui" },
    { id: 3, sender: "ai",     kind: "text",   content: "Merci Sophie ! Commande bien reçue. Je reviens sous 24h. 😊", time: "12:15", date: "Aujourd'hui" },
  ],
  4: [
    { id: 1, sender: "client", kind: "text", content: "Avez-vous des réductions ?", time: "16:00", date: "Hier" },
    { id: 2, sender: "human",  kind: "text", content: "-20% sur toute la collection été avec le code ETE24 🎉", time: "16:05", date: "Hier" },
    { id: 3, sender: "human",  kind: "file", file: { kind: "file", name: "catalogue-ete-2024.pdf", size: "1.2 Mo" }, time: "16:06", date: "Hier" },
  ],
  6: [
    { id: 1, sender: "client", kind: "text",   content: "Vous vendez en gros ?", time: "11:40", date: "Aujourd'hui" },
    { id: 2, sender: "ai",     kind: "text",   content: "Oui, tarifs de gros à partir de 10 unités !", time: "11:45", date: "Aujourd'hui" },
    { id: 3, sender: "ai",     kind: "photos", photos: [{ kind: "photo", name: "catalogue-gros.jpg", gradient: PHOTO_GRADS[2] }], time: "11:46", date: "Aujourd'hui" },
  ],
  7: [
    { id: 1, sender: "client", kind: "text", content: "Prix pour 10 unités ?", time: "10:30", date: "Aujourd'hui" },
    { id: 2, sender: "human",  kind: "text", content: "25 000 Ar l'unité pour 10 pièces minimum.", time: "10:35", date: "Aujourd'hui" },
  ],
};

export const INITIAL_PRESETS: PhotoPreset[] = [
  {
    id: 1,
    name: "Nouvelle collection",
    description: "Découvrez notre nouvelle collection ! Disponible en boutique et en ligne. Livraison rapide à Antananarivo.",
    photos: [mk(0)],
  },
  {
    id: 2,
    name: "Promotion du jour",
    description: "🔥 Promotion exceptionnelle aujourd'hui seulement ! Jusqu'à -30% sur une sélection d'articles.",
    photos: [mk(4)],
  },
  {
    id: 3,
    name: "Livraison gratuite",
    description: "📦 Livraison gratuite à Antananarivo pour toute commande dès 50 000 Ar !",
    photos: [mk(2)],
  },
];

/** Messages visible per page for lazy loading */
export const MSG_PAGE_SIZE = 30;
