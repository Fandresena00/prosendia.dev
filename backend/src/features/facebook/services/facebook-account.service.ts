import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import { FacebookConnection } from '../../../generated/prisma/client.js';
import { FacebookConnectionResponseDto } from '../dto/auth/facebook-connection-response.dto.js';
import {
  PaginatedResponseDto,
  PaginationQueryDto,
  buildPaginationMeta,
} from '../dto/shared/pagination.dto.js';
import { TokenEncryptionService } from '../security/token-encryption.service.js';

export type ConnectionWithToken = FacebookConnection & {
  readonly decryptedToken: string;
};

@Injectable()
export class FacebookAccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: TokenEncryptionService,
  ) {}

  // ─── Lookups ──────────────────────────────────────────────────────────────

  async getByPageId(pageId: string): Promise<ConnectionWithToken | null> {
    const conn = await this.prisma.facebookConnection.findUnique({
      where: { pageId },
    });
    if (!conn || !conn.isActive) return null;
    return this.attachToken(conn);
  }

  async getByProfileId(
    businessProfileId: string,
  ): Promise<ConnectionWithToken | null> {
    const conn = await this.prisma.facebookConnection.findUnique({
      where: { businessProfileId },
    });
    if (!conn || !conn.isActive) return null;
    return this.attachToken(conn);
  }

  /**
   * Like getByProfileId but throws if not found or the connection belongs to
   * a different user. Use in service methods that need a token to call the API.
   */
  async requireByProfileId(
    businessProfileId: string,
    userId: string,
  ): Promise<ConnectionWithToken> {
    const conn = await this.prisma.facebookConnection.findFirst({
      where: {
        businessProfileId,
        businessProfile: { userId },
        isActive: true,
      },
    });
    if (!conn) {
      throw new NotFoundException(
        `No active Facebook connection for business profile ${businessProfileId}.`,
      );
    }
    return this.attachToken(conn);
  }

  // ─── Listing ──────────────────────────────────────────────────────────────

  async listForUser(
    userId: string,
    { page = 1, pageSize = 20 }: PaginationQueryDto = {},
  ): Promise<PaginatedResponseDto<FacebookConnectionResponseDto>> {
    const skip = (page - 1) * pageSize;

    const [connections, total] = await Promise.all([
      this.prisma.facebookConnection.findMany({
        where: { businessProfile: { userId } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.facebookConnection.count({
        where: { businessProfile: { userId } },
      }),
    ]);

    return {
      data: connections.map((c) => this.toDto(c)),
      pagination: buildPaginationMeta(page, pageSize, total),
    };
  }

  /**
   * Returns the DTO for a single connection visible to the user.
   * Throws 404 if the connection does not exist or belongs to another user.
   */
  async getForUser(
    businessProfileId: string,
    userId: string,
  ): Promise<FacebookConnectionResponseDto> {
    const conn = await this.prisma.facebookConnection.findFirst({
      where: { businessProfileId, businessProfile: { userId } },
    });
    if (!conn) {
      throw new NotFoundException(
        `Facebook connection for business profile ${businessProfileId} not found.`,
      );
    }
    return this.toDto(conn);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private attachToken(conn: FacebookConnection): ConnectionWithToken {
    return {
      ...conn,
      decryptedToken: this.encryption.decrypt(conn.encryptedAccessToken),
    };
  }

  private toDto(conn: FacebookConnection): FacebookConnectionResponseDto {
    return {
      id: conn.id,
      businessProfileId: conn.businessProfileId,
      pageId: conn.pageId,
      pageName: conn.pageName,
      tokenStatus: conn.tokenStatus,
      tokenValidatedAt: conn.tokenValidatedAt,
      tokenExpiresAt: conn.tokenExpiresAt,
      webhookSubscribed: conn.webhookSubscribed,
      isActive: conn.isActive,
      grantedScopes: conn.grantedScopes as string[],
      instagramAccountId: conn.instagramAccountId,
      lastSyncedAt: conn.lastSyncedAt,
      createdAt: conn.createdAt,
    };
  }
}
