/**
 * @file features/inbox/utils/api-msg-to-ui-msg.ts
 *
 * Converts a MessageApiResponse (from the backend) into a Msg (for the UI).
 *
 * Media type detection strategy:
 *   - imageUrl set           → kind: 'photos'
 *   - fileUrl with video ext → kind: 'video'
 *   - fileUrl with audio ext → kind: 'audio'
 *   - fileUrl with other ext → kind: 'file'
 *   - referenceImageUrls     → kind: 'photos' (multiple preset images)
 *   - text only              → kind: 'text'
 *
 * The extension is read from the stored URL (which uses UUID + extension from
 * the MIME type detected at download time). This is reliable because
 * MediaDownloadService always assigns a correct extension.
 */

import type { MessageApiResponse, Msg, PhotoAttachment } from '../types/inbox.types';

const GRADIENTS = [
  "from-blue-500/40 to-indigo-600/30",
  "from-violet-500/40 to-purple-600/30",
  "from-emerald-500/40 to-teal-600/30",
  "from-amber-500/40 to-orange-600/30",
  "from-rose-500/40 to-pink-600/30",
  "from-cyan-500/40 to-sky-600/30",
];

const VIDEO_EXTENSIONS  = new Set(['mp4', 'webm', 'mov', 'avi', 'm4v']);
const AUDIO_EXTENSIONS  = new Set(['mp3', 'm4a', 'aac', 'ogg', 'opus', 'wav']);

/** Extracts the lowercase file extension from a URL (without the dot). */
function getUrlExtension(url: string): string {
  try {
    // Remove query string before extracting extension
    const cleanPath = new URL(url).pathname;
    return cleanPath.split('.').pop()?.toLowerCase() ?? '';
  } catch {
    // If URL parsing fails, fall back to simple split
    return url.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  }
}

export function formatMessageTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString('fr-FR', {
    hour:   '2-digit',
    minute: '2-digit',
  });
}

export function formatMessageDate(isoDate: string): string {
  const d     = new Date(isoDate);
  const today = new Date();
  const diff  = Math.floor((today.getTime() - d.getTime()) / 86_400_000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Hier';
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day:     'numeric',
    month:   'long',
  });
}

export function apiMsgToUiMsg(m: MessageApiResponse): Msg {
  const sender =
    m.sender === 'CLIENT' ? 'client'
    : m.sender === 'AI'   ? 'ai'
    : m.sender === 'PAGE' ? 'page'
    : 'human';

  const time = formatMessageTime(m.createdAt);
  const date = formatMessageDate(m.createdAt);
  const base = { id: m.id, sender, time, date, externalId: m.externalId } as const;

  // ── Multiple reference images (preset send) ──────────────────────────────
  if (m.referenceImageUrls?.length > 0) {
    return {
      ...base,
      kind:   'photos',
      photos: m.referenceImageUrls.map((url, i): PhotoAttachment => ({
        kind:      'photo',
        name:      'image',
        objectUrl: url,
        gradient:  GRADIENTS[i % GRADIENTS.length],
      })),
    };
  }

  // ── Single image ──────────────────────────────────────────────────────────
  if (m.imageUrl) {
    return {
      ...base,
      kind:   'photos',
      photos: [{
        kind:      'photo',
        name:      'image',
        objectUrl: m.imageUrl,
        gradient:  GRADIENTS[0],
      }],
    };
  }

  // ── Video / audio / file (from fileUrl) ───────────────────────────────────
  if (m.fileUrl) {
    const ext = getUrlExtension(m.fileUrl);

    if (VIDEO_EXTENSIONS.has(ext)) {
      return {
        ...base,
        kind:  'video',
        video: { url: m.fileUrl },
      };
    }

    if (AUDIO_EXTENSIONS.has(ext)) {
      return {
        ...base,
        kind:  'audio',
        audio: { url: m.fileUrl },
      };
    }

    // Document / unknown binary
    return {
      ...base,
      kind: 'file',
      file: {
        kind:      'file',
        name:      m.content ?? extractFilenameFromUrl(m.fileUrl),
        objectUrl: m.fileUrl,
      },
    };
  }

  // ── Plain text ────────────────────────────────────────────────────────────
  return {
    ...base,
    kind:    'text',
    content: m.content ?? '',
  };
}

/** Extracts a human-readable filename from a UUID-based URL for display. */
function extractFilenameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.split('/');
    return segments[segments.length - 1] ?? 'Fichier';
  } catch {
    return 'Fichier';
  }
}
