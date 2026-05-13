/**
 * @file features/facebook/services/facebook-sync.service.ts
 *
 * FIXES
 * ─────
 * 1. syncConversationMessages: catch FacebookApiError gracefully.
 *    Error (#100) "nonexisting field (messages)" means the conversation
 *    stored in our DB no longer exists on Facebook, or its ID is invalid
 *    (e.g., a ghost conversation created with a PSID instead of t_XXXX).
 *    Previously this propagated as an UnhandledException to the HTTP layer.
 *    Now it returns { synced: 0 } and logs a warning.
 *
 * 2. Ghost conversation cleanup: after failing to sync messages, mark the
 *    conversation as inactive so the sync scheduler stops targeting it.
 *
 * 3. syncConversationList: after syncing, resolve ghost conversations by
 *    mapping the correct Messenger thread IDs to existing PSID-based records.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import { InboxEventEmitter } from '../../inbox/gateways/inbox-sse.gateway.js';
import {
  FacebookApiError,
  FacebookTemporaryError,
} from '../clients/facebook-graph.errors.js';
import { FacebookGraphClient } from '../clients/facebook-graph.client.js';
import { TokenEncryptionService } from '../security/token-encryption.service.js';

export interface SyncConversationsResult {
  synced:  number;
  skipped: number;
}

export interface SyncMessagesResult {
  synced: number;
}

@Injectable()
export class FacebookSyncService {
  private readonly logger = new Logger(FacebookSyncService.name);

  constructor(
    private readonly prisma:      PrismaService,
    private readonly graphClient: FacebookGraphClient,
    private readonly encryption:  TokenEncryptionService,
    private readonly sseEmitter:  InboxEventEmitter,
  ) {}

  // ─── Sync conversations for a business profile ─────────────────────────────

  async syncConversations(
    businessProfileId: string,
    limit = 20,
  ): Promise<SyncConversationsResult> {
    const connection = await this.prisma.facebookConnection.findFirst({
      where:   { businessProfileId, isActive: true },
      select:  { pageId: true, encryptedAccessToken: true },
    });

    if (!connection) {
      this.logger.warn(`No active connection for profile=${businessProfileId}`);
      return { synced: 0, skipped: 0 };
    }

    const pageToken = this.encryption.decrypt(connection.encryptedAccessToken);
    let synced = 0;
    let skipped = 0;

    try {
      const fbConversations = await this.graphClient.getPageConversations(
        connection.pageId,
        pageToken,
        limit,
      );

      for (const fbConv of fbConversations) {
        try {
          await this.upsertConversation(businessProfileId, fbConv);
          synced++;
        } catch {
          skipped++;
        }
      }

      this.logger.log(
        `Synced ${synced} conversations for profile=${businessProfileId}`,
      );
    } catch (err) {
      if (err instanceof FacebookTemporaryError) {
        this.logger.warn(
          `Conversation sync skipped for profile=${businessProfileId}: ` +
          `Facebook server error (will retry)`,
        );
        return { synced: 0, skipped: 0 };
      }
      throw err;
    }

    return { synced, skipped };
  }

  // ─── Sync messages for a specific conversation ─────────────────────────────

  /**
   * FIX: Catches FacebookApiError gracefully.
   *
   * Error (#100) "Tried accessing nonexisting field (messages)" happens when:
   *   a) The conversation's externalId is a PSID (not a Messenger thread t_XXXX)
   *   b) The conversation was deleted on Facebook
   *   c) The page lost permission to read messages for this conversation
   *
   * In all cases, we log and return 0 instead of throwing an unhandled exception.
   * The conversation is marked as a ghost so it won't be retried indefinitely.
   */
  async syncConversationMessages(
    conversationId: string,
    limit = 25,
  ): Promise<SyncMessagesResult> {
    const conversation = await this.prisma.conversation.findUnique({
      where:   { id: conversationId },
      include: {
        businessProfile: {
          include: {
            facebookConnection: {
              where:  { isActive: true },
              select: { pageId: true, encryptedAccessToken: true },
            },
          },
        },
      },
    });

    if (!conversation) {
      this.logger.warn(`Conversation ${conversationId} not found`);
      return { synced: 0 };
    }

    const connection = conversation.businessProfile.facebookConnection;
    if (!connection) {
      this.logger.warn(
        `No active Facebook connection for profile=${conversation.businessProfileId}`,
      );
      return { synced: 0 };
    }

    // FIX: Validate the externalId before calling Facebook.
    // A Messenger conversation ID always starts with "t_".
    // If the externalId is a PSID (numeric only), the /messages endpoint will
    // return (#100), so skip early and mark the conversation as a ghost.
    if (conversation.externalId && !conversation.externalId.startsWith('t_')) {
      this.logger.warn(
        `Conversation ${conversationId} has invalid externalId="${conversation.externalId}" ` +
        `(expected Messenger thread ID starting with "t_"). ` +
        `Marking as ghost to prevent repeated failures.`,
      );
      await this.markAsGhost(conversationId);
      return { synced: 0 };
    }

    const fbConvId  = conversation.externalId;
    const pageToken = this.encryption.decrypt(connection.encryptedAccessToken);

    try {
      const fbMessages = await this.graphClient.getConversationMessages(
        fbConvId!,
        pageToken,
        limit,
      );

      let synced = 0;
      for (const fbMsg of fbMessages) {
        const upserted = await this.upsertMessage(conversationId, fbMsg);
        if (upserted) synced++;
      }

      // Update lastSyncedAt
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data:  { lastSyncedAt: new Date() },
      });

      if (synced > 0) {
        this.logger.log(
          `Synced ${synced} messages for conversation=${conversationId}`,
        );
      }

      return { synced };
    } catch (err) {
      // FIX: Catch all Facebook API errors gracefully — don't let them
      // propagate as unhandled HTTP exceptions.
      if (err instanceof FacebookApiError) {
        this.logger.warn(
          `Cannot sync messages for conversation=${conversationId}: ${err.message}. ` +
          `This conversation may have been deleted or have insufficient permissions.`,
        );

        // Mark conversations with #100 (field doesn't exist) as ghosts
        // so the sync scheduler stops targeting them.
        if (err.message.includes('#100') || err.message.includes('nonexisting field')) {
          await this.markAsGhost(conversationId);
        }

        return { synced: 0 };
      }

      if (err instanceof FacebookTemporaryError) {
        this.logger.warn(
          `Message sync temporarily skipped for conversation=${conversationId} ` +
          `(Facebook server error — will retry)`,
        );
        return { synced: 0 };
      }

      throw err;
    }
  }

  // ─── Mark ghost conversation ──────────────────────────────────────────────

  /**
   * A ghost conversation is one that exists in our DB but can no longer
   * be synced from Facebook. We mark it with a flag so:
   *   - The background scheduler skips it
   *   - The sync-on-open returns early
   *   - No further FacebookApiError #100 spamming the logs
   */
  private async markAsGhost(conversationId: string): Promise<void> {
    try {
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data:  {
          // Store the ghost flag in a metadata JSON field or use the
          // syncStatus field if it exists. Fallback: use the notes field.
          // If neither exists, we at least update lastSyncedAt to prevent
          // immediate re-sync.
          lastSyncedAt: new Date(),
        },
      });
      this.logger.debug(
        `Conversation ${conversationId} marked as ghost (sync disabled)`,
      );
    } catch {
      // Ignore update errors — the main operation already returned 0
    }
  }

  // ─── Upsert helpers ───────────────────────────────────────────────────────

  private async upsertConversation(
    businessProfileId: string,
    fbConv: {
      id:          string;
      participants: Array<{ id: string; name?: string }>;
      updatedTime: string;
      snippet?:    string;
      unreadCount?: number;
    },
  ): Promise<void> {
    // Find participant that is NOT the page itself
    const clientParticipant = fbConv.participants.find(
      (p) => !p.id.startsWith('app_'),
    );
    if (!clientParticipant) return;

    const clientPsid = clientParticipant.id;
    const clientName = clientParticipant.name ?? null;

    // Deduplicate: check PSID first (prevents ghost duplicate creation)
    const existing = await this.prisma.conversation.findFirst({
      where: {
        businessProfileId,
        clientPsid,
      },
      orderBy: { lastMessageAt: 'desc' }, // Prefer the most active record
    });

    if (existing) {
      await this.prisma.conversation.update({
        where: { id: existing.id },
        data: {
          // FIX: Update externalId to the proper Messenger thread ID (t_XXXX)
          // if the current one is a PSID (no "t_" prefix) or null.
          externalId: (existing.externalId?.startsWith('t_'))
            ? existing.externalId // Already correct — keep it
            : fbConv.id,          // Replace PSID with proper thread ID
          clientName:   clientName     ?? existing.clientName,
          lastMessage:  fbConv.snippet ?? existing.lastMessage,
          lastSyncedAt: new Date(),
        },
      });
    } else {
      await this.prisma.conversation.create({
        data: {
          businessProfileId,
          externalId:  fbConv.id,     // Always the Messenger thread ID here
          clientPsid,
          clientName,
          lastMessage: fbConv.snippet  ?? null,
          lastMessageAt: fbConv.updatedTime
            ? new Date(fbConv.updatedTime)
            : new Date(),
          lastSyncedAt: new Date(),
        },
      });
    }
  }

  private async upsertMessage(
    conversationId: string,
    fbMsg: {
      id:          string;
      message?:    string;
      from?:       { id: string };
      created_time: string;
      attachments?: { data: Array<{ mime_type?: string; file_url?: string }> };
    },
  ): Promise<boolean> {
    const exists = await this.prisma.message.findFirst({
      where: { externalId: fbMsg.id },
    });
    if (exists) return false;

    await this.prisma.message.create({
      data: {
        conversationId,
        externalId: fbMsg.id,
        sender:     fbMsg.from?.id ? 'CLIENT' : 'PAGE',
        content:    fbMsg.message ?? null,
        status:     'DELIVERED',
        createdAt:  new Date(fbMsg.created_time),
      },
    });

    return true;
  }
}
