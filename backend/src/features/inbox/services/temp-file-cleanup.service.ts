/**
 * @file features/inbox/services/temp-file-cleanup.service.ts
 *
 * Cleans up expired temporary upload files on a scheduled cron.
 *
 * Temporary files are created when a user sends an ad-hoc photo or file
 * in the inbox. The backend saves the file to uploads/temp/ and returns a
 * public URL so Facebook can download it. Once Facebook has consumed the
 * file, it is no longer needed and should be deleted to free disk space.
 *
 * Strategy:
 *   - Files older than TEMP_FILE_MAX_AGE_MS are considered expired.
 *   - The cron runs every 10 minutes — matching the max file age, so no
 *     temp file lives on disk for longer than ~20 minutes in the worst case.
 *   - On module init, the temp directory is created if it does not exist yet.
 *   - Errors during individual file deletion are logged but never re-thrown
 *     so one bad file cannot abort the entire cleanup pass.
 *
 * Directory layout:
 *   uploads/
 *     temp/          ← ad-hoc sends (this service cleans these)
 *     reference/     ← preset images (permanent, never cleaned here)
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as fsSync from 'fs';
import * as fs from 'fs/promises';
import { join } from 'path';

/** Files older than this are deleted on every cleanup pass. */
const TEMP_FILE_MAX_AGE_MS = 10 * 60 * 1_000; // 10 minutes

/** Absolute path to the temporary uploads directory. */
const TEMP_UPLOADS_DIR = join(process.cwd(), 'uploads', 'temp');

@Injectable()
export class TempFileCleanupService implements OnModuleInit {
  private readonly logger = new Logger(TempFileCleanupService.name);

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Ensure the temp directory exists at startup.
   * Creates it (and any missing parent dirs) if absent.
   */
  async onModuleInit(): Promise<void> {
    if (!fsSync.existsSync(TEMP_UPLOADS_DIR)) {
      await fs.mkdir(TEMP_UPLOADS_DIR, { recursive: true });
      this.logger.log(`Created temp uploads directory: ${TEMP_UPLOADS_DIR}`);
    } else {
      this.logger.log(`Temp uploads directory ready: ${TEMP_UPLOADS_DIR}`);
    }
  }

  // ─── Scheduled cleanup ─────────────────────────────────────────────────────

  /**
   * Runs every 10 minutes.
   * Deletes any file in uploads/temp/ whose last-modified time is older than
   * TEMP_FILE_MAX_AGE_MS. Subdirectories are skipped (only flat files cleaned).
   *
   * Survival across restarts: because cleanup is based on file mtime (not an
   * in-memory timer), files created before a server restart are still cleaned
   * correctly on the next cron tick after the restart.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async cleanUpExpiredTempFiles(): Promise<void> {
    let totalFiles      = 0;
    let deletedFiles    = 0;
    let skippedFiles    = 0;
    let errorCount      = 0;
    const nowMs         = Date.now();

    try {
      const directoryEntries = await fs.readdir(TEMP_UPLOADS_DIR, {
        withFileTypes: true,
      });

      for (const entry of directoryEntries) {
        // Only process flat files — skip subdirectories
        if (!entry.isFile()) continue;
        totalFiles++;

        const absoluteFilePath = join(TEMP_UPLOADS_DIR, entry.name);

        try {
          const fileStats     = await fs.stat(absoluteFilePath);
          const fileAgeMs     = nowMs - fileStats.mtimeMs;
          const isExpired     = fileAgeMs > TEMP_FILE_MAX_AGE_MS;

          if (isExpired) {
            await fs.unlink(absoluteFilePath);
            deletedFiles++;
            this.logger.debug(
              `Deleted expired temp file: ${entry.name} ` +
              `(age: ${Math.round(fileAgeMs / 1_000)}s)`,
            );
          } else {
            skippedFiles++;
          }
        } catch (fileErr: unknown) {
          // Log and continue — one bad file must not abort the full pass
          errorCount++;
          this.logger.warn(
            `Failed to process temp file "${entry.name}": ` +
            `${fileErr instanceof Error ? fileErr.message : String(fileErr)}`,
          );
        }
      }

      if (deletedFiles > 0 || errorCount > 0) {
        this.logger.log(
          `Temp cleanup complete — ` +
          `deleted: ${deletedFiles}, ` +
          `kept: ${skippedFiles}, ` +
          `errors: ${errorCount} ` +
          `(total scanned: ${totalFiles})`,
        );
      }
    } catch (dirErr: unknown) {
      // Directory might not exist yet on the very first run (race condition)
      this.logger.error(
        `Temp cleanup scan failed: ` +
        `${dirErr instanceof Error ? dirErr.message : String(dirErr)}`,
      );
    }
  }

  // ─── Manual trigger (for testing / admin endpoints) ───────────────────────

  /**
   * Run a cleanup pass immediately (outside the cron schedule).
   * Useful for admin endpoints or integration tests.
   */
  async runCleanupNow(): Promise<{ deleted: number; errors: number }> {
    this.logger.log('Manual temp cleanup triggered');
    let deleted = 0;
    let errors  = 0;
    const nowMs = Date.now();

    try {
      const directoryEntries = await fs.readdir(TEMP_UPLOADS_DIR, {
        withFileTypes: true,
      });
      for (const entry of directoryEntries) {
        if (!entry.isFile()) continue;
        const absoluteFilePath = join(TEMP_UPLOADS_DIR, entry.name);
        try {
          const { mtimeMs } = await fs.stat(absoluteFilePath);
          if (nowMs - mtimeMs > TEMP_FILE_MAX_AGE_MS) {
            await fs.unlink(absoluteFilePath);
            deleted++;
          }
        } catch {
          errors++;
        }
      }
    } catch {
      // Directory doesn't exist yet — nothing to clean
    }

    return { deleted, errors };
  }
}
