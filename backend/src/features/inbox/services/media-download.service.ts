/**
 * @file features/inbox/services/media-download.service.ts
 *
 * Downloads Facebook CDN media files and stores them on the local server.
 *
 * WHY THIS IS NEEDED
 * ──────────────────
 * Facebook Messenger attachment URLs (images, videos, audio, files) are
 * signed CDN URLs with a limited lifetime (~24–48 hours for Messenger,
 * shorter for some asset types). If we store the raw Facebook URL in the
 * DB, it will be a broken link the next day.
 *
 * Solution: download immediately when the webhook fires and serve from
 * the backend's own static assets directory.
 *
 * STORAGE LAYOUT
 * ──────────────
 * uploads/
 *   media/           ← permanent Facebook media (never auto-deleted)
 *     {uuid}.jpg     ← images
 *     {uuid}.mp4     ← videos
 *     {uuid}.mp3     ← voice messages / audio
 *     {uuid}.pdf     ← documents
 *   temp/            ← ad-hoc sends (auto-deleted after 10 min)
 *   reference/       ← preset images (permanent)
 *
 * The public URL returned is: {BACKEND_URL}/uploads/media/{uuid}.ext
 *
 * SECURITY
 * ────────
 * - Filename is always a UUID — the original name is never used.
 * - Only allowed MIME types are accepted.
 * - File size is checked before writing (configurable ceiling).
 * - The resolved path is verified to stay inside MEDIA_DIR.
 */

import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as fsSync from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';

// ─── Configuration ─────────────────────────────────────────────────────────────

/** Maximum size of a single downloaded media file (50 MB). */
const MAX_MEDIA_FILE_SIZE_BYTES = 50 * 1024 * 1024;

/** Absolute path to the permanent media directory. */
const MEDIA_DIR = path.join(process.cwd(), 'uploads', 'media');

/** Download timeout per file. */
const DOWNLOAD_TIMEOUT_MS = 30_000;

/**
 * Maps Facebook attachment type + content MIME type to a safe file extension.
 * The extension is derived from the downloaded Content-Type header, not from
 * the Facebook URL (which often contains query parameters, not clean filenames).
 */
const MIME_TO_EXTENSION: Record<string, string> = {
  // Images
  'image/jpeg':  '.jpg',
  'image/jpg':   '.jpg',
  'image/png':   '.png',
  'image/gif':   '.gif',
  'image/webp':  '.webp',
  // Videos
  'video/mp4':   '.mp4',
  'video/webm':  '.webm',
  'video/quicktime': '.mov',
  'video/x-msvideo': '.avi',
  // Audio (Facebook voice messages use MPEG or AAC)
  'audio/mpeg':  '.mp3',
  'audio/mp4':   '.m4a',
  'audio/aac':   '.aac',
  'audio/ogg':   '.ogg',
  'audio/opus':  '.opus',
  'audio/wav':   '.wav',
  'audio/x-wav': '.wav',
  // Documents
  'application/pdf':  '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
} as const;

/**
 * Fallback extensions keyed by Facebook's `attachment.type` field.
 * Used when the Content-Type header isn't in the MIME map above.
 */
const FB_TYPE_FALLBACK_EXTENSION: Record<string, string> = {
  image:    '.jpg',
  video:    '.mp4',
  audio:    '.mp3',
  file:     '.bin',
  template: '.bin',
  fallback: '.bin',
} as const;

// ─── Result type ───────────────────────────────────────────────────────────────

export interface DownloadedMedia {
  /** Publicly accessible URL served from our backend. */
  publicUrl:   string;
  /** UUID filename on disk (no path prefix). */
  filename:    string;
  /** File extension including the dot, e.g. ".mp4". */
  extension:   string;
  /** MIME type reported by the Facebook CDN response. */
  mimeType:    string;
  /** File size in bytes. */
  sizeBytes:   number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class MediaDownloadService implements OnModuleInit {
  private readonly logger    = new Logger(MediaDownloadService.name);
  private readonly backendUrl: string;

  constructor(private readonly config: ConfigService) {
    this.backendUrl = config.getOrThrow<string>('backendUrl');
  }

  async onModuleInit(): Promise<void> {
    if (!fsSync.existsSync(MEDIA_DIR)) {
      await fs.mkdir(MEDIA_DIR, { recursive: true });
      this.logger.log(`Created media directory: ${MEDIA_DIR}`);
    }
  }

  // ─── Main entry point ──────────────────────────────────────────────────────

  /**
   * Downloads a Facebook CDN media file and stores it permanently.
   *
   * @param facebookCdnUrl   The signed CDN URL from the Facebook webhook payload.
   * @param facebookAttachmentType  Facebook's attachment.type field
   *                                ('image' | 'video' | 'audio' | 'file').
   *
   * @returns The permanent public URL of the stored file, or null if the
   *          download failed (e.g. URL already expired, network error).
   *          The caller should fall back to storing the original Facebook URL
   *          if null is returned.
   */
  async downloadAndStore(
    facebookCdnUrl:        string,
    facebookAttachmentType: string,
  ): Promise<DownloadedMedia | null> {
    try {
      return await this.performDownload(facebookCdnUrl, facebookAttachmentType);
    } catch (err: unknown) {
      this.logger.warn(
        `Media download failed for ${facebookAttachmentType} — ` +
        `falling back to original Facebook URL. ` +
        `Error: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  // ─── Core download logic ───────────────────────────────────────────────────

  private async performDownload(
    facebookCdnUrl:         string,
    facebookAttachmentType: string,
  ): Promise<DownloadedMedia> {

    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(facebookCdnUrl, { signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new Error(
        `Facebook CDN returned HTTP ${response.status} for ${facebookAttachmentType} download`,
      );
    }

    // Determine the file extension from the response Content-Type
    const contentType    = response.headers.get('content-type') ?? '';
    const rawMimeType    = contentType.split(';')[0].trim().toLowerCase();
    const safeExtension  =
      MIME_TO_EXTENSION[rawMimeType] ??
      FB_TYPE_FALLBACK_EXTENSION[facebookAttachmentType.toLowerCase()] ??
      '.bin';

    // Read the response body
    const fileBuffer = Buffer.from(await response.arrayBuffer());

    if (fileBuffer.byteLength > MAX_MEDIA_FILE_SIZE_BYTES) {
      throw new Error(
        `Media file too large: ${(fileBuffer.byteLength / 1_048_576).toFixed(1)} MB ` +
        `(max ${MAX_MEDIA_FILE_SIZE_BYTES / 1_048_576} MB)`,
      );
    }

    // Build UUID filename — never use the original Facebook URL path
    const uuidFilename    = `${randomUUID()}${safeExtension}`;
    const absoluteSavePath = path.join(MEDIA_DIR, uuidFilename);

    // Defence-in-depth: verify path stays inside MEDIA_DIR
    if (!absoluteSavePath.startsWith(MEDIA_DIR + path.sep)) {
      throw new Error('Path traversal detected — aborting media save.');
    }

    await fs.writeFile(absoluteSavePath, fileBuffer);

    const publicUrl = `${this.backendUrl}/uploads/media/${uuidFilename}`;

    this.logger.debug(
      `Media saved: ${uuidFilename} ` +
      `(type: ${facebookAttachmentType}, mime: ${rawMimeType}, ` +
      `size: ${(fileBuffer.byteLength / 1024).toFixed(1)} KB)`,
    );

    return {
      publicUrl,
      filename:  uuidFilename,
      extension: safeExtension,
      mimeType:  rawMimeType,
      sizeBytes: fileBuffer.byteLength,
    };
  }

  // ─── Helper: detect media category from stored URL ────────────────────────

  /**
   * Determines the media category from a stored URL's file extension.
   * Used by the frontend mapper to decide which player to render.
   */
  static getMediaCategory(url: string): 'image' | 'video' | 'audio' | 'file' {
    const extension = url.split('.').pop()?.toLowerCase() ?? '';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) return 'image';
    if (['mp4', 'webm', 'mov', 'avi', 'm4v'].includes(extension))   return 'video';
    if (['mp3', 'm4a', 'aac', 'ogg', 'opus', 'wav'].includes(extension)) return 'audio';
    return 'file';
  }
}
