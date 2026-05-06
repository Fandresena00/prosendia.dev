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
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaService } from '../../../database/prisma.service.js';
import type { ReferencePresetDto, UploadReferenceImagesResponseDto } from '../dto/inbox.dto.js';

const UPLOADS_DIR    = path.join(process.cwd(), 'uploads', 'inbox', 'references');
const TEMP_UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'inbox', 'temp');
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB per image
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

  constructor(private readonly prisma: PrismaService) {}

  /** Ensure upload directory exists on service init */
  async onModuleInit(): Promise<void> {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    await fs.mkdir(TEMP_UPLOADS_DIR, { recursive: true });
    this.logger.log(`Reference image upload dir: ${UPLOADS_DIR}`);
    this.logger.log(`Temp upload dir: ${TEMP_UPLOADS_DIR}`);
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

  async listReferencePresets(
    businessProfileId: string,
    userId: string,
  ): Promise<ReferencePresetDto[]> {
    await this.ensureProfileOwner(businessProfileId, userId);
    const resources = await this.prisma.chatResource.findMany({
      where: { businessProfileId, isActive: true },
      include: { images: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    return resources.map((resource) => ({
      id: resource.id,
      businessProfileId: resource.businessProfileId,
      name: resource.name,
      description: resource.description,
      images: resource.images.map((image) => ({
        id: image.id,
        url: image.url,
        description: image.description,
        sortOrder: image.sortOrder,
      })),
      createdAt: resource.createdAt,
      updatedAt: resource.updatedAt,
    }));
  }

  async createReferencePreset(
    data: {
      businessProfileId: string;
      userId: string;
      name: string;
      description: string;
      files: MulterFile[];
      baseUrl: string;
    },
  ): Promise<ReferencePresetDto> {
    await this.ensureProfileOwner(data.businessProfileId, data.userId);
    const saved = await this.saveReferenceImages(data.files, data.baseUrl);
    const resource = await this.prisma.chatResource.create({
      data: {
        businessProfileId: data.businessProfileId,
        name: data.name.trim(),
        description: data.description.trim(),
        images: {
          create: saved.urls.map((url, index) => ({
            url,
            description: data.description.trim(),
            sortOrder: index,
          })),
        },
      },
      include: { images: { orderBy: { sortOrder: 'asc' } } },
    });

    return {
      id: resource.id,
      businessProfileId: resource.businessProfileId,
      name: resource.name,
      description: resource.description,
      images: resource.images.map((image) => ({
        id: image.id,
        url: image.url,
        description: image.description,
        sortOrder: image.sortOrder,
      })),
      createdAt: resource.createdAt,
      updatedAt: resource.updatedAt,
    };
  }

  async deleteReferencePreset(id: string, userId: string): Promise<void> {
    const resource = await this.prisma.chatResource.findFirst({
      where: { id, businessProfile: { userId } },
      include: { images: true },
    });
    if (!resource) throw new NotFoundException(`Reference preset ${id} not found.`);

    await this.prisma.chatResource.delete({ where: { id } });
    await Promise.all(resource.images.map((image) => this.deleteReferenceImage(image.url)));
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
   * Store a temporary upload (ad-hoc photo/file) so Facebook can download it by URL.
   * Returned URL is publicly reachable under `/uploads/inbox/temp/*` via main.ts static assets.
   */
  async saveTempUpload(
    file: MulterFile,
    baseUrl: string,
  ): Promise<{ url: string }> {
    if (!file) throw new BadRequestException('No file provided.');
    if (file.size > MAX_SIZE_BYTES) {
      throw new BadRequestException(`${file.originalname}: exceeds 5 MB limit`);
    }

    const ext = path.extname(file.originalname) || '.bin';
    const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`;
    const dest = path.join(TEMP_UPLOADS_DIR, filename);

    await fs.writeFile(dest, file.buffer);
    return { url: `${baseUrl}/uploads/inbox/temp/${filename}` };
  }

  private async ensureProfileOwner(businessProfileId: string, userId: string): Promise<void> {
    const profile = await this.prisma.businessProfile.findFirst({
      where: { id: businessProfileId, userId },
      select: { id: true },
    });
    if (!profile) throw new ForbiddenException('Business profile is not available for this user.');
  }
}
