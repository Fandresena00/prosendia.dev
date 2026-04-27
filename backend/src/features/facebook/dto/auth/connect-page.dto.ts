import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export class ConnectPageDto {
  /**
   * Optional — when omitted, a default BusinessProfile is auto-created.
   * When provided, must be a valid UUID of a profile owned by the caller.
   */
  @IsOptional()
  @IsUUID(4, { message: 'businessProfileId must be a valid UUID v4' })
  businessProfileId?: string;

  /** Facebook Page ID (numeric string, e.g. "123456789"). */
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+$/, { message: 'pageId must be a numeric string' })
  pageId!: string;

  /** Short-lived or long-lived page access token. */
  @IsString()
  @IsNotEmpty()
  pageAccessToken!: string;

  @IsString()
  @IsNotEmpty()
  pageName!: string;

  /** Optional Instagram Business Account ID linked to this page. */
  @IsOptional()
  @IsString()
  instagramAccountId?: string;

  /**
   * Comma-separated list of granted OAuth scopes returned by Facebook.
   * Example: "pages_show_list,pages_messaging"
   */
  @IsOptional()
  @IsString()
  grantedScopes?: string;
}
