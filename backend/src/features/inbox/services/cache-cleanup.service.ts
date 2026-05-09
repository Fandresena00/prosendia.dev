/**
 * @file features/inbox/services/cache-cleanup.service.ts
 *
 * Implements the intelligent cache policy for the inbox DB.
 *
 * PHILOSOPHY
 * ──────────
 * PostgreSQL is NOT a full mirror of Messenger — it is a smart cache.
 * We keep only the most recent and useful data for fast UI loading.
 * Facebook remains the source of truth for full history.
 *
 * CACHE POLICY
 * ────────────
 * Per businessProfile:
 *   - Keep the 50 most recently active conversations
 *   - Delete conversations inactive for > 30 days (beyond the top 50)
 *
 * Per conversation:
 *   - Keep the 50 most recent messages
 *   - Delete older messages (they are re-fetched from FB on scroll/sync)
 *
 * REHYDRATION
 * ───────────
 * When a cleaned conversation is re-opened:
 *   - sync-on-open fetches fresh messages from the Graph API
 *   - Lazy scroll fetches older history progressively
 *
 * CLEANUP SCHEDULE
 * ────────────────
 * Runs every 6 hours (off-peak, low impact).
 * Only deletes data that is genuinely stale or exceeds limits.
 * Never deletes anything from Facebook — only the local cache.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../database/prisma.service.js';

// ─── Cache limits ─────────────────────────────────────────────────────────────

/** Maximum conversations kept per business profile. */
const MAX_CONVERSATIONS_PER_PROFILE = 50;

/** Maximum messages kept per conversation. */
const MAX_MESSAGES_PER_CONVERSATION = 50;

/** Conversations inactive longer than this are eligible for removal (beyond top 50). */
const CONVERSATION_INACTIVE_THRESHOLD_DAYS = 30;

@Injectable()
export class CacheCleanupService {
  private readonly logger = new Logger(CacheCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Scheduled cleanup ───────────────────────────────────────────────────

  @Cron('0 */6 * * *') // Every 6 hours at :00
  async runScheduledCleanup(): Promise<void> {
    this.logger.log('Cache cleanup starting…');
    const start = Date.now();

    const [messagesDeleted, conversationsDeleted] = await Promise.all([
      this.cleanupOldMessages(),
      this.cleanupInactiveConversations(),
    ]);

    this.logger.log(
      `Cache cleanup complete in ${Date.now() - start}ms — ` +
      `messages deleted: ${messagesDeleted}, conversations deleted: ${conversationsDeleted}`,
    );
  }

  // ─── Message cache trimming ───────────────────────────────────────────────

  /**
   * For every conversation with more than MAX_MESSAGES_PER_CONVERSATION messages,
   * delete the oldest ones beyond the limit.
   *
   * Uses a cursor-based approach to avoid loading all message IDs into memory.
   */
  private async cleanupOldMessages(): Promise<number> {
    let totalDeleted = 0;

    // Find conversations that exceed the message limit
    const overflowConversations = await this.prisma.$queryRaw<
      Array<{ id: string; message_count: bigint }>
    >`
      SELECT c.id, COUNT(m.id) AS message_count
      FROM "Conversation" c
      JOIN "Message" m ON m."conversationId" = c.id
      GROUP BY c.id
      HAVING COUNT(m.id) > ${MAX_MESSAGES_PER_CONVERSATION}
    `;

    for (const conv of overflowConversations) {
      try {
        // Find the createdAt of the Nth most recent message (our cutoff boundary)
        const cutoffMessage = await this.prisma.message.findFirst({
          where:   { conversationId: conv.id },
          orderBy: { createdAt: 'desc' },
          skip:    MAX_MESSAGES_PER_CONVERSATION,
          select:  { createdAt: true },
        });

        if (!cutoffMessage) continue;

        const { count } = await this.prisma.message.deleteMany({
          where: {
            conversationId: conv.id,
            createdAt:      { lte: cutoffMessage.createdAt },
          },
        });

        totalDeleted += count;
        this.logger.debug(
          `Trimmed ${count} old messages from conversation=${conv.id}`,
        );
      } catch (err: unknown) {
        this.logger.warn(
          `Failed to trim messages for conversation=${conv.id}: ` +
          `${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return totalDeleted;
  }

  // ─── Conversation cache trimming ──────────────────────────────────────────

  /**
   * Per business profile:
   *   1. Keep the top MAX_CONVERSATIONS_PER_PROFILE most recently active.
   *   2. Among the rest, delete those inactive for > INACTIVE_THRESHOLD_DAYS.
   *   3. Delete all messages in the deleted conversations first (FK constraint).
   */
  private async cleanupInactiveConversations(): Promise<number> {
    let totalDeleted = 0;

    const businessProfiles = await this.prisma.businessProfile.findMany({
      select: { id: true },
    });

    for (const profile of businessProfiles) {
      try {
        deleted: {
          const totalConversations = await this.prisma.conversation.count({
            where: { businessProfileId: profile.id },
          });

          if (totalConversations <= MAX_CONVERSATIONS_PER_PROFILE) break deleted;

          // Find the cutoff: the lastMessageAt of the Nth most recent conversation
          const cutoffConversation = await this.prisma.conversation.findFirst({
            where:   { businessProfileId: profile.id },
            orderBy: { lastMessageAt: 'desc' },
            skip:    MAX_CONVERSATIONS_PER_PROFILE,
            select:  { lastMessageAt: true },
          });

          if (!cutoffConversation?.lastMessageAt) break deleted;

          const inactiveThreshold = new Date(
            Date.now() - CONVERSATION_INACTIVE_THRESHOLD_DAYS * 24 * 60 * 60 * 1_000,
          );

          // Only delete if the cutoff conversation is also beyond the inactive threshold
          // This prevents deleting recently active conversations even if they're beyond top 50
          if (cutoffConversation.lastMessageAt > inactiveThreshold) break deleted;

          // Find conversations to delete: beyond top 50 AND inactive > threshold
          const conversationsToDelete = await this.prisma.conversation.findMany({
            where: {
              businessProfileId: profile.id,
              lastMessageAt: {
                lte: cutoffConversation.lastMessageAt,
                lt:  inactiveThreshold,
              },
            },
            select: { id: true },
          });

          if (conversationsToDelete.length === 0) break deleted;

          const idsToDelete = conversationsToDelete.map((c) => c.id);

          // Delete messages first (FK constraint)
          await this.prisma.message.deleteMany({
            where: { conversationId: { in: idsToDelete } },
          });

          const { count } = await this.prisma.conversation.deleteMany({
            where: { id: { in: idsToDelete } },
          });

          totalDeleted += count;
          this.logger.debug(
            `Deleted ${count} inactive conversations for profile=${profile.id}`,
          );
        }
      } catch (err: unknown) {
        this.logger.warn(
          `Conversation cleanup failed for profile=${profile.id}: ` +
          `${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return totalDeleted;
  }

  // ─── Manual trigger ───────────────────────────────────────────────────────

  /** Run cleanup immediately (for admin endpoints or tests). */
  async runNow(): Promise<{ messagesDeleted: number; conversationsDeleted: number }> {
    const [messagesDeleted, conversationsDeleted] = await Promise.all([
      this.cleanupOldMessages(),
      this.cleanupInactiveConversations(),
    ]);
    return { messagesDeleted, conversationsDeleted };
  }
}
