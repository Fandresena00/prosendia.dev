import type { Msg } from '../types/inbox.types';

/** Current time as HH:MM string */
export function nowTime(): string {
  return new Date().toLocaleTimeString('fr-FR', {
    hour:   '2-digit',
    minute: '2-digit',
  });
}

/** Group an array of messages by their date label */
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

/** Human-readable file size: "1.2 Mo" or "128 Ko" */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} Mo`;
  return `${Math.round(bytes / 1024)} Ko`;
}

/**
 * Computes the bubble border-radius based on message position in a run.
 * Mirrors a Messenger-style grouped-bubble style.
 */
export function getBubbleRadius(
  isClient: boolean,
  prevSame: boolean,
  nextSame: boolean,
): string {
  if (isClient) {
    if (!prevSame && !nextSame) return 'rounded-2xl rounded-bl-md';
    if (!prevSame && nextSame)  return 'rounded-2xl rounded-bl-sm';
    if (prevSame && nextSame)   return 'rounded-2xl rounded-l-sm';
    return 'rounded-2xl rounded-tl-sm';
  }
  if (!prevSame && !nextSame) return 'rounded-2xl rounded-br-md';
  if (!prevSame && nextSame)  return 'rounded-2xl rounded-br-sm';
  if (prevSame && nextSame)   return 'rounded-2xl rounded-r-sm';
  return 'rounded-2xl rounded-tr-sm';
}

/** Monotonically increasing local ID for optimistic messages */
let _localId = 1000;
export function nextLocalId(): string {
  return `local-${++_localId}`;
}
