// src/features/admin/dto/admin-management.dto.ts

import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export enum AdminRoleDto {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
}

export class CreateAdminDto {
  @IsEmail()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email!: string;

  @IsString()
  @MinLength(10)
  @Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,}$/, {
    message:
      'Le mot de passe doit contenir au moins une majuscule, un chiffre et un caractère spécial (min 10 caractères).',
  })
  password!: string;

  /**
   * Toujours ADMIN ici — seul le seed initial peut créer un SUPER_ADMIN.
   * Le champ existe pour usage futur (multi super-admin), mais le service
   * refuse explicitement la valeur SUPER_ADMIN via cet endpoint.
   */
  @IsOptional()
  @IsEnum(AdminRoleDto)
  role?: AdminRoleDto;
}
