// src/features/admin/dto/admin-custom-plan-config.dto.ts
//
// userId est maintenant REQUIS dans la création (config user-specific).

import { Type } from 'class-transformer';
import {
  IsBoolean, IsInt, IsOptional, IsPositive,
  IsString, IsUUID, Max, MaxLength, Min, MinLength,
} from 'class-validator';

export class CreateCustomPlanConfigDto {
  @IsUUID('4')
  userId!: string; // ← OBLIGATOIRE — config liée à un user spécifique

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceAriary!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  durationDays?: number;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  credits!: number;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  maxPages!: number;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  maxManagedPosts!: number;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  maxReferenceImages!: number;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;

  @IsOptional()
  @IsBoolean()
  isPurchasable?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

// Tous champs optionnels pour PATCH
export class UpdateCustomPlanConfigDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceAriary?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  durationDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  credits?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  maxPages?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  maxManagedPosts?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  maxReferenceImages?: number;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;

  @IsOptional()
  @IsBoolean()
  isPurchasable?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

// Aliases pour compatibilité avec les imports existants
export { CreateCustomPlanConfigDto as CreateCustomPlanTemplateDto };
export { UpdateCustomPlanConfigDto as UpdateCustomPlanTemplateDto };
