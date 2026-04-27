import type { Msg } from "../types/inbox.types";

export function nowTime(): string {
  return new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function groupByDate(msgs: Msg[]): { date: string; messages: Msg[] }[] {
  const groups: { date: string; messages: Msg[] }[] = [];
  let current: { date: string; messages: Msg[] } | null = null;
  for (const m of msgs) {
    if (!current || current.date !== m.date) {
      current = { date: m.date, messages: [] };
      groups.push(current);
    }
    current.messages.push(m);
  }
  return groups;
}

export function formatFileSize(bytes: number): string {
  if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  return `${Math.round(bytes / 1024)} Ko`;
}

let _id = 200;
export function nextId(): number { return ++_id; }
