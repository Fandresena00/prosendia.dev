/**
 * @file features/inbox/services/temp-upload.service.ts
 *
 * Handles ad-hoc temporary file uploads (photos, files sent in the inbox).
 *
 * Security rules enforced here:
 *   1. Filename is ALWAYS a UUID — the original filename is NEVER used.
 *      Prevents: path traversal, collisions, predictable names.
 *   2. Only the file extension is extracted from the original name,
 *      and only after stripping to [a-z0-9] characters.
 *      Prevents: double extensions (.php.jpg), null bytes, unicode tricks.
 *   3. Extension is validated against an allowlist of safe MIME types.
 *      Prevents: uploading executables disguised as images.
 *   4. File size is checked against a hard ceiling before writing to disk.
 *      Prevents: disk exhaustion.
 *   5. File is written to uploads/temp/ only — never to any caller-supplied path.
 *      Prevents: directory traversal even if upstream validation is bypassed.
 *
 * Output URL format:
 *   {BACKEND_URL}/uploads/temp/550e8400-e29b-41d4-a716-446655440000.jpg
 *
 * The URL is returned to the frontend, which passes it to the Facebook Graph API.
 * Facebook fetches the file directly from this public URL.
 * TempFileCleanupService deletes it automatically after 10 minutes.
 */

import {
  BadRequestException,
  Injectable,
  Logger,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as fsSync from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';

// ─── Configuration ────────────────────────────────────────────────────────────

/** Maximum file size accepted for temporary uploads (10 MB). */
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** Absolute path to the temp directory. Must match TempFileCleanupService. */
const TEMP_UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'temp');

/**
 * Allowlist of accepted MIME types mapped to their safe file extensions.
 * Any file whose MIME type is not in this map is rejected.
 */
const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg':    '.jpg',
  'image/png':     '.png',
  'image/gif':     '.gif',
  'image/webp':    '.webp',
  'application/pdf':               '.pdf',
  'application/msword':            '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel':      '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'video/mp4':     '.mp4',
  'audio/mpeg':    '.mp3',
};

// ─── Service ──────────────────────────────────────────────────────────────────

export interface TempUploadResult {
  /** Fully-qualified public URL Facebook can GET to download the file. */
  publicUrl:     string;
  /** UUID filename stored on disk (without path). */
  uuidFilename:  string;
  /** Safe extension derived from MIME type (never from original filename). */
  extension:     string;
}

@Injectable()
export class TempUploadService {
  private readonly logger = new Logger(TempUploadService.name);
  private readonly backendPublicUrl: string;

  constructor(private readonly config: ConfigService) {
    this.backendPublicUrl = config.getOrThrow<string>('backendUrl');
    this.ensureTempDirExists();
  }

  // ─── Main entry point ─────────────────────────────────────────────────────

  /**
   * Validates the uploaded file, writes it to disk with a UUID filename,
   * and returns the public URL Facebook must use to download it.
   *
   * @param multerFile  The file object provided by Multer (memory storage).
   *                    `originalname` is used ONLY to derive the MIME hint —
   *                    it is never written to disk or used in any path.
   */
  async saveTempFile(multerFile: Express.Multer.File): Promise<TempUploadResult> {
    // ── 1. Size check ─────────────────────────────────────────────────────
    if (multerFile.size > MAX_FILE_SIZE_BYTES) {
      throw new PayloadTooLargeException(
        `File too large: ${(multerFile.size / 1_048_576).toFixed(1)} MB. ` +
        `Maximum allowed: ${MAX_FILE_SIZE_BYTES / 1_048_576} MB.`,
      );
    }

    // ── 2. MIME type validation ────────────────────────────────────────────
    // Use the MIME type reported by Multer (derived from magic bytes via
    // the 'fileTypeFromBuffer' check if configured, or from Content-Type).
    // Fall back to the extension in the original filename only as a hint.
    const mimeType           = multerFile.mimetype.toLowerCase().trim();
    const allowedExtension   = ALLOWED_MIME_TYPES[mimeType];

    if (!allowedExtension) {
      throw new BadRequestException(
        `File type "${mimeType}" is not allowed. ` +
        `Accepted types: ${Object.keys(ALLOWED_MIME_TYPES).join(', ')}.`,
      );
    }

    // ── 3. Build UUID filename — NEVER use original name ──────────────────
    // UUID v4 + safe extension derived from MIME type (not from originalname).
    // This is the ONLY way the filename is determined.
    const uuidFilename   = `${randomUUID()}${allowedExtension}`;
    const absolutePath   = path.join(TEMP_UPLOADS_DIR, uuidFilename);

    // Sanity check: ensure the resolved path stays inside TEMP_UPLOADS_DIR.
    // This is a defence-in-depth guard — UUID filenames cannot contain path
    // separators, but we verify anyway.
    if (!absolutePath.startsWith(TEMP_UPLOADS_DIR + path.sep) &&
        absolutePath !== TEMP_UPLOADS_DIR) {
      this.logger.error(
        `Path traversal attempt blocked: resolved path "${absolutePath}" ` +
        `is outside "${TEMP_UPLOADS_DIR}"`,
      );
      throw new BadRequestException('Invalid file path.');
    }

    // ── 4. Write file to disk ─────────────────────────────────────────────
    await fs.writeFile(absolutePath, multerFile.buffer);

    this.logger.debug(
      `Temp file saved: ${uuidFilename} ` +
      `(mime: ${mimeType}, size: ${(multerFile.size / 1024).toFixed(1)} KB)`,
    );

    // ── 5. Build and return the public URL ─────────────────────────────────
    const publicUrl = `${this.backendPublicUrl}/uploads/temp/${uuidFilename}`;

    return { publicUrl, uuidFilename, extension: allowedExtension };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private ensureTempDirExists(): void {
    if (!fsSync.existsSync(TEMP_UPLOADS_DIR)) {
      fsSync.mkdirSync(TEMP_UPLOADS_DIR, { recursive: true });
      this.logger.log(`Created temp uploads directory: ${TEMP_UPLOADS_DIR}`);
    }
  }
}
