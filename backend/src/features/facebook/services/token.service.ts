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
  readonly connectionId: string;
  readonly pageId: string;
  readonly status: TokenStatus;
  readonly expiresAt: Date | null;
  readonly scopes: string[];
  readonly networkError: boolean;
}

export interface TokenValidationSummary {
  readonly total: number;
  readonly valid: number;
  readonly invalid: number;
  readonly skipped: number;
}

const EXPIRY_WARNING_DAYS = 7;

/** Number of connections validated concurrently. Increase for faster bulk runs. */
const DEFAULT_BATCH_SIZE = 10;

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly graphClient: FacebookGraphClient,
    private readonly encryption: TokenEncryptionService,
  ) {}

  // ─── Single token ─────────────────────────────────────────────────────────

  async validateToken(connection: FacebookConnection): Promise<TokenValidationResult> {
    // Decrypt first — a bad encryption key is a config error, not a Facebook error
    let decryptedToken: string;
    try {
      decryptedToken = this.encryption.decrypt(connection.encryptedAccessToken);
    } catch {
      this.logger.error(
        `Cannot decrypt token for connection ${connection.id} — marking INVALID`,
      );
      await this.markInvalid(connection.id);
      return this.invalidResult(connection, false);
    }

    try {
      const debug = await this.graphClient.debugToken(decryptedToken);

      // null → network error; preserve current status, let caller decide
      if (debug === null) {
        return {
          connectionId: connection.id,
          pageId: connection.pageId,
          status: connection.tokenStatus,
          expiresAt: connection.tokenExpiresAt,
          scopes: connection.grantedScopes as string[],
          networkError: true,
        };
      }

      const newStatus: TokenStatus = debug.is_valid ? 'VALID' : 'INVALID';
      const expiresAt = debug.expires_at ? new Date(debug.expires_at * 1000) : null;

      await this.prisma.facebookConnection.update({
        where: { id: connection.id },
        data: {
          tokenStatus: newStatus,
          tokenValidatedAt: new Date(),
          tokenExpiresAt: expiresAt,
          grantedScopes: debug.scopes ?? [],
        },
      });

      if (newStatus === 'VALID' && expiresAt) {
        this.warnIfExpiringSoon(connection.pageId, expiresAt);
      }
      if (newStatus === 'INVALID') {
        this.logger.warn(`Token INVALID for page ${connection.pageId}`);
      }

      return {
        connectionId: connection.id,
        pageId: connection.pageId,
        status: newStatus,
        expiresAt,
        scopes: debug.scopes ?? [],
        networkError: false,
      };
    } catch (error) {
      if (error instanceof FacebookTemporaryError) {
        this.logger.warn(`Token validation skipped for page ${connection.pageId} (server error)`);
        return {
          connectionId: connection.id,
          pageId: connection.pageId,
          status: connection.tokenStatus,
          expiresAt: connection.tokenExpiresAt,
          scopes: connection.grantedScopes as string[],
          networkError: true,
        };
      }
      if (error instanceof FacebookTokenError) {
        await this.markInvalid(connection.id);
        return this.invalidResult(connection, false);
      }
      throw error;
    }
  }

  // ─── Bulk validation ──────────────────────────────────────────────────────

  /**
   * Validates all active connections in batches to avoid exhausting the event
   * loop or hitting Facebook's rate limits with a single giant Promise.allSettled.
   *
   * @param batchSize Concurrent calls per batch (default: 10)
   */
  async validateAllActiveTokens(
    batchSize = DEFAULT_BATCH_SIZE,
  ): Promise<TokenValidationSummary> {
    const connections = await this.prisma.facebookConnection.findMany({
      where: { isActive: true },
    });

    this.logger.log(
      `Starting bulk token validation — ${connections.length} connections, batch size ${batchSize}`,
    );

    const summary: { total: number; valid: number; invalid: number; skipped: number } = {
      total: connections.length,
      valid: 0,
      invalid: 0,
      skipped: 0,
    };

    for (let i = 0; i < connections.length; i += batchSize) {
      const batch = connections.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map((c) => this.validateToken(c)),
      );

      for (const result of results) {
        if (result.status === 'rejected') {
          summary.skipped++;
          continue;
        }
        if (result.value.networkError) summary.skipped++;
        else if (result.value.status === 'VALID') summary.valid++;
        else summary.invalid++;
      }

      this.logger.debug(
        `Validated batch ${Math.floor(i / batchSize) + 1} — ` +
          `${Math.min(i + batchSize, connections.length)}/${connections.length} done`,
      );
    }

    this.logger.log(
      `Bulk validation complete — valid: ${summary.valid}, invalid: ${summary.invalid}, skipped: ${summary.skipped}`,
    );
    return summary;
  }

  // ─── Usability check ──────────────────────────────────────────────────────

  /**
   * Fast check — uses cached status if validated within the last hour.
   * Falls back to a live API call only when status is unknown or stale.
   */
  async isTokenUsable(pageId: string): Promise<boolean> {
    const conn = await this.prisma.facebookConnection.findUnique({
      where: { pageId },
    });
    if (!conn || !conn.isActive) return false;
    if (conn.tokenStatus === 'INVALID') return false;

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (conn.tokenStatus === 'VALID' && conn.tokenValidatedAt && conn.tokenValidatedAt > oneHourAgo) {
      return true;
    }

    try {
      const result = await this.validateToken(conn);
      return result.status === 'VALID' || result.networkError;
    } catch {
      return false;
    }
  }

  /** Explicitly mark a token as invalid (e.g. after receiving a 190 webhook). */
  async invalidateToken(connectionId: string): Promise<void> {
    await this.markInvalid(connectionId);
    this.logger.warn(`Token explicitly invalidated for connection ${connectionId}`);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async markInvalid(connectionId: string): Promise<void> {
    await this.prisma.facebookConnection.update({
      where: { id: connectionId },
      data: { tokenStatus: 'INVALID', tokenValidatedAt: new Date() },
    });
  }

  private invalidResult(
    connection: FacebookConnection,
    networkError: boolean,
  ): TokenValidationResult {
    return {
      connectionId: connection.id,
      pageId: connection.pageId,
      status: 'INVALID',
      expiresAt: null,
      scopes: [],
      networkError,
    };
  }

  private warnIfExpiringSoon(pageId: string, expiresAt: Date): void {
    const daysUntilExpiry = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysUntilExpiry <= EXPIRY_WARNING_DAYS) {
      this.logger.warn(
        `Token for page ${pageId} expires in ${Math.round(daysUntilExpiry)} days`,
      );
    }
  }
}
