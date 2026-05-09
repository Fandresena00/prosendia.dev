/**
 * @file features/facebook/services/token.service.ts
 *
 * CRITICAL FIX
 * ────────────
 * `isTokenUsable()` was making LIVE Facebook API calls inside the webhook hot path
 * when the token was last validated > 1 hour ago. This caused 1–5 seconds of
 * extra latency per inbound message for accounts with stale validation timestamps.
 * This is why some accounts appeared slow while others were instant:
 *   - Account validated < 1 hour ago → DB fast path → instant
 *   - Account validated > 1 hour ago → live API call → 1–5s delay
 *
 * Solution: add `isTokenUsableForWebhook()` which ONLY checks the DB status
 * and never calls the Facebook API. The webhook path must never make outbound
 * API calls — it needs to respond in milliseconds.
 *
 * Live validation is still performed:
 *   - By the scheduled `TokenValidateWorker` (background, non-blocking)
 *   - By the existing `isTokenUsable()` which is still used for non-critical paths
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import { FacebookConnection } from '../../../generated/prisma/client.js';
import { TokenStatus } from '../../../generated/prisma/enums.js';
import { FacebookGraphClient } from '../clients/facebook-graph.client.js';
import {
  FacebookTemporaryError,
  FacebookTokenError,
} from '../clients/facebook-graph.errors.js';
import { TokenEncryptionService } from '../security/token-encryption.service.js';

export interface TokenValidationResult {
  readonly connectionId:  string;
  readonly pageId:        string;
  readonly status:        TokenStatus;
  readonly expiresAt:     Date | null;
  readonly scopes:        string[];
  readonly networkError:  boolean;
}

export interface TokenValidationSummary {
  readonly total:   number;
  readonly valid:   number;
  readonly invalid: number;
  readonly skipped: number;
}

const EXPIRY_WARNING_DAYS      = 7;
const DEFAULT_BATCH_SIZE       = 10;

/** How long a VALID token status is trusted in the DB without re-checking. */
const TOKEN_CACHE_DURATION_MS  = 60 * 60 * 1_000; // 1 hour (for isTokenUsable)

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly prisma:      PrismaService,
    private readonly graphClient: FacebookGraphClient,
    private readonly encryption:  TokenEncryptionService,
  ) {}

  // ─── Webhook hot path check (NO live API call) ────────────────────────────

  /**
   * Fast token check for use in webhook processing.
   * NEVER makes a live Facebook API call — only reads the DB.
   *
   * When to use: any code path triggered by inbound webhooks from Facebook.
   * The webhook has already been authenticated by HMAC-SHA256 signature,
   * so we trust the DB status without re-validating.
   *
   * Accepts tokens as VALID unless explicitly marked INVALID in DB.
   * The background TokenValidateWorker keeps the status accurate.
   */
  async isTokenUsableForWebhook(pageId: string): Promise<boolean> {
    const connection = await this.prisma.facebookConnection.findUnique({
      where:  { pageId },
      select: { tokenStatus: true, isActive: true },
    });
    // Trust DB status — no API call
    return !!connection && connection.isActive && connection.tokenStatus !== 'INVALID';
  }

  // ─── Standard check (may make live API call) ──────────────────────────────

  /**
   * Full token check for use in non-critical paths (e.g. outbound API calls).
   * Uses cached DB status if validated within the last hour.
   * Falls back to a live Facebook API call only when the cache is stale.
   *
   * DO NOT use this in webhook handlers — use isTokenUsableForWebhook() instead.
   */
  async isTokenUsable(pageId: string): Promise<boolean> {
    const connection = await this.prisma.facebookConnection.findUnique({
      where: { pageId },
    });
    if (!connection || !connection.isActive) return false;
    if (connection.tokenStatus === 'INVALID') return false;

    const cacheExpiresAt = new Date(Date.now() - TOKEN_CACHE_DURATION_MS);
    const isCacheValid   =
      connection.tokenStatus === 'VALID' &&
      connection.tokenValidatedAt &&
      connection.tokenValidatedAt > cacheExpiresAt;

    if (isCacheValid) return true;

    try {
      const result = await this.validateToken(connection);
      return result.status === 'VALID' || result.networkError;
    } catch {
      return false;
    }
  }

  // ─── Single token validation ──────────────────────────────────────────────

  async validateToken(connection: FacebookConnection): Promise<TokenValidationResult> {
    let decryptedToken: string;
    try {
      decryptedToken = this.encryption.decrypt(connection.encryptedAccessToken);
    } catch {
      this.logger.error(
        `Cannot decrypt token for connection=${connection.id} — marking INVALID`,
      );
      await this.markInvalid(connection.id);
      return this.buildInvalidResult(connection, false);
    }

    try {
      const debugResult = await this.graphClient.debugToken(decryptedToken);

      if (debugResult === null) {
        // Network error — preserve current DB status, let caller decide
        return {
          connectionId:  connection.id,
          pageId:        connection.pageId,
          status:        connection.tokenStatus,
          expiresAt:     connection.tokenExpiresAt,
          scopes:        connection.grantedScopes as string[],
          networkError:  true,
        };
      }

      const newStatus: TokenStatus = debugResult.is_valid ? 'VALID' : 'INVALID';
      const expiresAt = debugResult.expires_at
        ? new Date(debugResult.expires_at * 1000)
        : null;

      await this.prisma.facebookConnection.update({
        where: { id: connection.id },
        data: {
          tokenStatus:      newStatus,
          tokenValidatedAt: new Date(),
          tokenExpiresAt:   expiresAt,
          grantedScopes:    debugResult.scopes ?? [],
        },
      });

      if (newStatus === 'VALID' && expiresAt) {
        this.warnIfExpiringSoon(connection.pageId, expiresAt);
      }
      if (newStatus === 'INVALID') {
        this.logger.warn(`Token INVALID for page=${connection.pageId}`);
      }

      return {
        connectionId:  connection.id,
        pageId:        connection.pageId,
        status:        newStatus,
        expiresAt,
        scopes:        debugResult.scopes ?? [],
        networkError:  false,
      };
    } catch (error) {
      if (error instanceof FacebookTemporaryError) {
        this.logger.warn(
          `Token validation skipped for page=${connection.pageId} (server error)`,
        );
        return {
          connectionId:  connection.id,
          pageId:        connection.pageId,
          status:        connection.tokenStatus,
          expiresAt:     connection.tokenExpiresAt,
          scopes:        connection.grantedScopes as string[],
          networkError:  true,
        };
      }
      if (error instanceof FacebookTokenError) {
        await this.markInvalid(connection.id);
        return this.buildInvalidResult(connection, false);
      }
      throw error;
    }
  }

  // ─── Bulk validation ──────────────────────────────────────────────────────

  async validateAllActiveTokens(
    batchSize = DEFAULT_BATCH_SIZE,
  ): Promise<TokenValidationSummary> {
    const connections = await this.prisma.facebookConnection.findMany({
      where: { isActive: true },
    });

    this.logger.log(
      `Bulk token validation starting — ${connections.length} connections, ` +
      `batch size ${batchSize}`,
    );

    const summary = { total: connections.length, valid: 0, invalid: 0, skipped: 0 };

    for (let i = 0; i < connections.length; i += batchSize) {
      const batch   = connections.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map((c) => this.validateToken(c)),
      );

      for (const result of results) {
        if (result.status === 'rejected') { summary.skipped++; continue; }
        if (result.value.networkError)    summary.skipped++;
        else if (result.value.status === 'VALID') summary.valid++;
        else summary.invalid++;
      }

      this.logger.debug(
        `Validated batch ${Math.floor(i / batchSize) + 1} — ` +
        `${Math.min(i + batchSize, connections.length)}/${connections.length} done`,
      );
    }

    this.logger.log(
      `Bulk validation complete — valid: ${summary.valid}, ` +
      `invalid: ${summary.invalid}, skipped: ${summary.skipped}`,
    );
    return summary;
  }

  // ─── Explicit invalidation ────────────────────────────────────────────────

  async invalidateToken(connectionId: string): Promise<void> {
    await this.markInvalid(connectionId);
    this.logger.warn(`Token explicitly invalidated for connection=${connectionId}`);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async markInvalid(connectionId: string): Promise<void> {
    await this.prisma.facebookConnection.update({
      where: { id: connectionId },
      data:  { tokenStatus: 'INVALID', tokenValidatedAt: new Date() },
    });
  }

  private buildInvalidResult(
    connection:   FacebookConnection,
    networkError: boolean,
  ): TokenValidationResult {
    return {
      connectionId: connection.id,
      pageId:       connection.pageId,
      status:       'INVALID',
      expiresAt:    null,
      scopes:       [],
      networkError,
    };
  }

  private warnIfExpiringSoon(pageId: string, expiresAt: Date): void {
    const daysUntilExpiry =
      (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysUntilExpiry <= EXPIRY_WARNING_DAYS) {
      this.logger.warn(
        `Token for page=${pageId} expires in ${Math.round(daysUntilExpiry)} days`,
      );
    }
  }
}
