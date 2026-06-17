/**
 * @file src/features/users/dto/update-user.dto.ts
 *
 * CHANGE: avatarUrl retiré. Le changement d'avatar passe désormais
 * exclusivement par POST /users/:id/avatar (UsersService.replaceAvatar),
 * qui supprime l'ancien fichier local et marque avatarSource=LOCAL.
 * L'exposer ici permettrait de désynchroniser avatarUrl/avatarSource et de
 * laisser des fichiers orphelins sur le disque.
 */

import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
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
  @IsEnum(Plan, {
    message: `activePlan must be one of: ${Object.values(Plan).join(', ')}`,
  })
  activePlan?: Plan;

  @IsOptional()
  @IsBoolean({ message: 'onboardingDone must be a boolean' })
  onboardingDone?: boolean;
}
