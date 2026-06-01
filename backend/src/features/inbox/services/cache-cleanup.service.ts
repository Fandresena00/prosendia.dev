/**
 * @file features/inbox/services/cache-cleanup.service.ts
 *
 * Manages the size of the local DB cache so it doesn't grow unbounded.
 *
 * Cache policy:
 *   - Keep the 40 most recently active conversations per business profile.
 *   - Keep the 50 most recent messages per conversation.
 *   - Conversations inactive for more than 30 days (beyond the top 40) are removed.
 *
 * Schedules:
 *   - Incremental trim — every 6 hours: prune conversations and messages
 *     that exceed the per-profile / per-conversation limits.
 *   - Full weekly reset — every Sunday at 03:00: enforces hard limits so
 *     the DB never drifts above the 40/50 ceilings over time.
 *
 * Re-hydration: trimmed data is re-fetched from Facebook on the next
 * initial-sync call or when the user scrolls to older history.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../database/prisma.service.js';

const MAX_CONVERSATIONS_PER_PROFILE = 40;
const MAX_MESSAGES_PER_CONVERSATION = 50;
const INACTIVE_THRESHOLD_DAYS       = 30;

@Injectable()
export class CacheCleanupService {
  private readonly logger = new Logger(CacheCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Incremental trim — every 6 hours ─────────────────────────────────────

  @Cron('0 */6 * * *')
  async runScheduledCleanup(): Promise<void> {
    this.logger.log('Cache cleanup starting…');
    const start = Date.now();

    const [msgs, convs] = await Promise.all([
      this.trimOldMessages(),
      this.trimInactiveConversations(),
    ]);

    this.logger.log(
      `Cache cleanup done in ${Date.now() - start}ms — messages: ${msgs}, conversations: ${convs}`,
    );
  }

  // ─── Full weekly reset — every Sunday at 03:00 ────────────────────────────

  /**
   * Hard-resets every profile to the 40/50 ceilings.
   * Runs weekly to catch any drift missed by the incremental trim.
   */
  @Cron('0 3 * * 0')
  async runWeeklyReset(): Promise<void> {
    this.logger.log('Weekly cache reset starting…');
    const start = Date.now();

    const [msgs, convs] = await Promise.all([
      this.hardTrimMessages(),
      this.hardTrimConversations(),
    ]);

    this.logger.log(
      `Weekly reset done in ${Date.now() - start}ms — messages: ${msgs}, conversations: ${convs}`,
    );
  }

  // ─── Incremental: trim over-limit messages ─────────────────────────────────

  private async trimOldMessages(): Promise<number> {
    let total = 0;

    const overLimit = await this.prisma.$queryRaw<Array<{ id: string; cnt: bigint }>>`
      SELECT c.id, COUNT(m.id) AS cnt
      FROM "Conversation" c
      JOIN "Message" m ON m."conversationId" = c.id
      GROUP BY c.id
      HAVING COUNT(m.id) > ${MAX_MESSAGES_PER_CONVERSATION}
    `;

    for (const row of overLimit) {
      try {
        const cutoff = await this.prisma.message.findFirst({
          where:   { conversationId: row.id },
          orderBy: { createdAt: 'desc' },
          skip:    MAX_MESSAGES_PER_CONVERSATION,
          select:  { createdAt: true },
        });
        if (!cutoff) continue;

        const { count } = await this.prisma.message.deleteMany({
          where: { conversationId: row.id, createdAt: { lte: cutoff.createdAt } },
        });
        total += count;
      } catch (err: unknown) {
        this.logger.warn(
          `Message trim failed for conv=${row.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return total;
  }

  // ─── Incremental: trim inactive conversations ──────────────────────────────

  private async trimInactiveConversations(): Promise<number> {
    let total = 0;
    const profiles = await this.prisma.businessProfile.findMany({ select: { id: true } });

    for (const { id } of profiles) {
      try {
        const count = await this.prisma.conversation.count({ where: { businessProfileId: id } });
        if (count <= MAX_CONVERSATIONS_PER_PROFILE) continue;

        const cutoffConv = await this.prisma.conversation.findFirst({
          where:   { businessProfileId: id },
          orderBy: { lastMessageAt: 'desc' },
          skip:    MAX_CONVERSATIONS_PER_PROFILE,
          select:  { lastMessageAt: true },
        });
        if (!cutoffConv?.lastMessageAt) continue;

        const inactiveThreshold = new Date(
          Date.now() - INACTIVE_THRESHOLD_DAYS * 86_400_000,
        );

        // Only remove conversations that are BOTH beyond the top-40 AND inactive.
        if (cutoffConv.lastMessageAt > inactiveThreshold) continue;

        const toDelete = await this.prisma.conversation.findMany({
          where: {
            businessProfileId: id,
            lastMessageAt: { lte: cutoffConv.lastMessageAt, lt: inactiveThreshold },
          },
          select: { id: true },
        });
        if (toDelete.length === 0) continue;

        const ids = toDelete.map((c) => c.id);
        await this.prisma.message.deleteMany({ where: { conversationId: { in: ids } } });
        const { count: deleted } = await this.prisma.conversation.deleteMany({
          where: { id: { in: ids } },
        });
        total += deleted;
      } catch (err: unknown) {
        this.logger.warn(
          `Conversation trim failed for profile=${id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return total;
  }

  // ─── Hard trim: enforce MAX_MESSAGES ceiling per conversation ─────────────

  private async hardTrimMessages(): Promise<number> {
    let total = 0;
    const conversations = await this.prisma.conversation.findMany({ select: { id: true } });

    for (const { id } of conversations) {
      try {
        const cutoff = await this.prisma.message.findFirst({
          where:   { conversationId: id },
          orderBy: { createdAt: 'desc' },
          skip:    MAX_MESSAGES_PER_CONVERSATION,
          select:  { createdAt: true },
        });
        if (!cutoff) continue;

        const { count } = await this.prisma.message.deleteMany({
          where: { conversationId: id, createdAt: { lte: cutoff.createdAt } },
        });
        total += count;
      } catch (err: unknown) {
        this.logger.warn(
          `Hard message trim failed for conv=${id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return total;
  }

  // ─── Hard trim: enforce MAX_CONVERSATIONS ceiling per profile ──────────────

  private async hardTrimConversations(): Promise<number> {
    let total = 0;
    const profiles = await this.prisma.businessProfile.findMany({ select: { id: true } });

    for (const { id } of profiles) {
      try {
        const cutoff = await this.prisma.conversation.findFirst({
          where:   { businessProfileId: id },
          orderBy: { lastMessageAt: 'desc' },
          skip:    MAX_CONVERSATIONS_PER_PROFILE,
          select:  { id: true },
        });
        if (!cutoff) continue;

        const toDelete = await this.prisma.conversation.findMany({
          where:   { businessProfileId: id },
          orderBy: { lastMessageAt: 'asc' },
          take:    9999,
          select:  { id: true },
        });

        // Exclude the top-MAX conversations (already ranked desc above).
        const topIds = await this.prisma.conversation.findMany({
          where:   { businessProfileId: id },
          orderBy: { lastMessageAt: 'desc' },
          take:    MAX_CONVERSATIONS_PER_PROFILE,
          select:  { id: true },
        });
        const keepSet = new Set(topIds.map((c) => c.id));
        const removeIds = toDelete.filter((c) => !keepSet.has(c.id)).map((c) => c.id);

        if (removeIds.length === 0) continue;

        await this.prisma.message.deleteMany({ where: { conversationId: { in: removeIds } } });
        const { count } = await this.prisma.conversation.deleteMany({
          where: { id: { in: removeIds } },
        });
        total += count;
      } catch (err: unknown) {
        this.logger.warn(
          `Hard conversation trim failed for profile=${id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return total;
  }

  // ─── Manual trigger ────────────────────────────────────────────────────────

  async runNow(): Promise<{ messagesDeleted: number; conversationsDeleted: number }> {
    const [messagesDeleted, conversationsDeleted] = await Promise.all([
      this.trimOldMessages(),
      this.trimInactiveConversations(),
    ]);
    return { messagesDeleted, conversationsDeleted };
  }
}
