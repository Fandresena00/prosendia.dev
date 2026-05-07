/**
 * @file features/inbox/controllers/temp-upload.controller.ts
 *
 * Endpoint: POST /inbox/uploads/temp
 *
 * Accepts a single file upload and returns a public URL Facebook can download.
 *
 * Multer is configured with MEMORY STORAGE intentionally:
 *   - The file buffer is passed to TempUploadService which writes it with a UUID name.
 *   - Multer never touches the disk with the original filename.
 *   - This is the only correct way to guarantee UUID filenames — configuring
 *     diskStorage with a cb() function inside the controller would still pass
 *     the original filename through multer's pipeline before renaming.
 *
 * File size limit is enforced at two layers:
 *   1. Multer limits  → rejects the upload at the HTTP layer (413 response)
 *   2. TempUploadService → rejects again as a defence-in-depth check
 *
 * Usage (frontend):
 *   const formData = new FormData();
 *   formData.append('file', file);          // 'file' matches FileInterceptor('file')
 *   const { url } = await apiClient('/inbox/uploads/temp', {
 *     method: 'POST',
 *     body: formData,
 *   });
 *   // url = "https://api.vendeoai.com/uploads/temp/550e8400-...jpg"
 *   // Pass this url to sendImagesMessage() or sendFileMessage()
 */

import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard.js';
import { TempUploadService } from '../services/temp-upload.service.js';

/** 10 MB — must match TempUploadService.MAX_FILE_SIZE_BYTES */
const MULTER_FILE_SIZE_LIMIT = 10 * 1024 * 1024;

@UseGuards(JwtAuthGuard)
@Controller('inbox')
export class TempUploadController {
  constructor(private readonly tempUploadService: TempUploadService) {}

  /**
   * POST /inbox/uploads/temp
   *
   * Accepts a single file (field name: "file").
   * Returns the public URL Facebook will use to download the file.
   *
   * Response: { url: string }
   */
  @Post('uploads/temp')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      // IMPORTANT: memory storage — disk is never touched with original filename
      storage: memoryStorage(),
      limits:  { fileSize: MULTER_FILE_SIZE_LIMIT },
    }),
  )
  async uploadTempFile(
    @UploadedFile() uploadedFile: Express.Multer.File,
  ): Promise<{ url: string }> {
    const result = await this.tempUploadService.saveTempFile(uploadedFile);
    return { url: result.publicUrl };
  }
}
