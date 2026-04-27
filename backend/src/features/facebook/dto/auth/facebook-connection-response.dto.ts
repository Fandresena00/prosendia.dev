import { TokenStatus } from '../../../../generated/prisma/enums.js';

export class FacebookConnectionResponseDto {
  id!: string;
  businessProfileId!: string;
  pageId!: string;
  pageName!: string;

  /** Strongly typed — use the Prisma-generated enum. */
  tokenStatus!: TokenStatus;

  tokenValidatedAt!: Date | null;
  tokenExpiresAt!: Date | null;
  webhookSubscribed!: boolean;
  isActive!: boolean;
  grantedScopes!: string[];
  instagramAccountId!: string | null;
  lastSyncedAt!: Date | null;
  createdAt!: Date;
}
