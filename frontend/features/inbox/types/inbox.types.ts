/* ─────────────────────────────────────────────
   Inbox Feature — Type Definitions
───────────────────────────────────────────── */

export type MsgSender = "client" | "ai" | "human";
export type ConvMode  = "ai" | "human";
export type MsgKind   = "text" | "photos" | "file";

/* ── Attachments ── */
export interface PhotoAttachment {
  kind: "photo";
  name: string;
  /** blob: or remote URL — use <img> tag, never next/image, for blob: URLs */
  objectUrl?: string;
  gradient: string;
}
export interface FileAttachment {
  kind: "file";
  name: string;
  size?: string;
}

/* ── Photo Preset — supports multiple photos ── */
export interface PresetPhoto {
  id: string;           // local uuid
  objectUrl?: string;   // blob URL from file picker
  gradient: string;
}
export interface PhotoPreset {
  id: number;
  name: string;
  /** Description auto-inserted into message input */
  description: string;
  /** One or more product photos */
  photos: PresetPhoto[];
}

/* ── Message ── */
export interface Msg {
  id: number;
  sender: MsgSender;
  time: string;
  date: string;
  kind: MsgKind;
  content?: string;
  photos?: PhotoAttachment[];
  file?: FileAttachment;
  pending?: boolean;
  failed?: boolean;
  reactions?: string[];
}

/* ── Conversation ── */
export interface Conv {
  id: number;
  accountId: number;
  client: string;
  initials: string;
  lastMessage: string;
  time: string;
  mode: ConvMode;
  unread: number;
  online?: boolean;
}

/* ── Account ── */
export interface Account {
  id: number;
  name: string;
  initials: string;
  color: string;
  pageType: string;
  verified: boolean;
}
