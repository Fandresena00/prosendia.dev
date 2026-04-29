/**
 * @file features/inbox/services/upload.service.ts
 *
 * Handles file storage for the inbox feature.
 *
 * Storage policy (per spec):
 *   ✅ Reference images (preset photos)    → stored in backend uploads/
 *   ❌ Message photos / files              → sent DIRECTLY to Facebook, never stored
 *
 * Reference images are stored in `uploads/inbox/references/` and served via
 * the `/inbox/uploads/*` static route configured in the NestJS app bootstrap.
 */

import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { UploadReferenceImagesResponseDto } from '../dto/inbox.dto.js';

const UPLOADS_DIR    = path.join(process.cwd(), 'uploads', 'inbox', 'references');
const TEMP_UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'inbox', 'temp');
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB per image
const TEMP_MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB for Messenger attachments
const ALLOWED_TYPES  = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/** Express Multer file shape (subset) */
export interface MulterFile {
  originalname: string;
  mimetype:     string;
  size:         number;
  buffer:       Buffer;
}

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  /** Ensure upload directory exists on service init */
  async onModuleInit(): Promise<void> {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    await fs.mkdir(TEMP_UPLOADS_DIR, { recursive: true });
    this.logger.log(`Reference image upload dir: ${UPLOADS_DIR}`);
  }

  /**
   * Persists reference images to disk and returns their permanent backend URLs.
   * Called when creating or updating a photo preset.
   *
   * @param files  Array of Multer file objects from the multipart upload
   * @param baseUrl Server base URL used to build permanent URLs (e.g. https://api.vendeoai.com)
   */
  async saveReferenceImages(
    files: MulterFile[],
    baseUrl: string,
  ): Promise<UploadReferenceImagesResponseDto> {
    if (!files.length) throw new BadRequestException('No files provided.');

    for (const f of files) {
      if (!ALLOWED_TYPES.includes(f.mimetype)) {
        throw new BadRequestException(`${f.originalname}: unsupported type ${f.mimetype}`);
      }
      if (f.size > MAX_SIZE_BYTES) {
        throw new BadRequestException(`${f.originalname}: exceeds 5 MB limit`);
      }
    }

    const urls: string[] = [];

    for (const f of files) {
      const ext      = path.extname(f.originalname) || '.jpg';
      const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`;
      const dest     = path.join(UPLOADS_DIR, filename);

      await fs.writeFile(dest, f.buffer);
      urls.push(`${baseUrl}/inbox/uploads/${filename}`);
      this.logger.log(`Reference image saved: ${filename}`);
    }

    return { urls };
  }

  /**
   * Delete a reference image from disk.
   * Filename is extracted from the URL path.
   */
  async deleteReferenceImage(imageUrl: string): Promise<void> {
    const filename = path.basename(imageUrl);
    const filePath = path.join(UPLOADS_DIR, filename);
    try {
      await fs.unlink(filePath);
      this.logger.log(`Reference image deleted: ${filename}`);
    } catch {
      // Non-fatal — file may have already been removed
      this.logger.warn(`Could not delete reference image: ${filename}`);
    }
  }

  /**
   * Stores an ad-hoc message attachment long enough for Facebook to fetch it.
   * In production, baseUrl must be publicly reachable by Facebook.
   */
  async saveTempFile(
    file: MulterFile | undefined,
    baseUrl: string,
  ): Promise<{ url: string }> {
    if (!file) throw new BadRequestException('No file provided.');
    if (file.size > TEMP_MAX_SIZE_BYTES) {
      throw new BadRequestException(`${file.originalname}: exceeds 25 MB limit`);
    }

    const ext = path.extname(file.originalname) || '';
    const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`;
    const dest = path.join(TEMP_UPLOADS_DIR, filename);

    await fs.writeFile(dest, file.buffer);
    this.logger.log(`Temporary inbox upload saved: ${filename}`);
    return { url: `${baseUrl}/uploads/inbox/temp/${filename}` };
  }
}
