import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Plan } from '../../../generated/prisma/client.js';

export class UpdateUserDto {
  @IsOptional()
  @IsEmail({}, { message: 'Invalid email format' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email?: string;

  @IsOptional()
  @IsString({ message: 'Username must be a string' })
  @MinLength(3, { message: 'Username must be at least 3 characters' })
  @MaxLength(30, { message: 'Username must be at most 30 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  username?: string;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsUrl({ require_tld: false }, { message: 'avatarUrl must be a valid URL' })
  avatarUrl?: string | null;

  @IsOptional()
  @IsEnum(Plan, {
    message: `activePlan must be one of: ${Object.values(Plan).join(', ')}`,
  })
  activePlan?: Plan;

  @IsOptional()
  @IsBoolean({ message: 'onboardingDone must be a boolean' })
  onboardingDone?: boolean;
}
