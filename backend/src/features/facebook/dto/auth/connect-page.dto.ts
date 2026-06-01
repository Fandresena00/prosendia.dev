/**
 * @file features/facebook/dto/auth/connect-page.dto.ts
 *
 * DTO for POST /facebook/connect.
 *
 * businessProfileId is intentionally NOT validated as UUID because:
 *   - The OAuth state parameter may be 'default', 'null', or any string
 *     set by the frontend before the user has a profile.
 *   - Validation of whether it is a real profile happens in the service.
 *   - The service handles non-UUID values by finding or creating a profile.
 */

import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class ConnectPageDto {
  /**
   * Optional business profile ID.
   * May be a valid UUID v4 OR a non-UUID placeholder (e.g. 'default').
   * The service resolves the correct profile regardless of this value.
   */
  @IsOptional()
  @IsString()
  businessProfileId?: string;

  @IsString()
  @IsNotEmpty()
  pageId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  pageName!: string;

  @IsString()
  @IsNotEmpty()
  pageAccessToken!: string;

  @IsOptional()
  @IsString()
  instagramAccountId?: string;

  /** Comma-separated granted scope names, e.g. "pages_messaging,pages_show_list" */
  @IsOptional()
  @IsString()
  grantedScopes?: string;
}
