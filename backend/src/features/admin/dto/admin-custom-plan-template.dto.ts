// src/features/admin/dto/admin-custom-plan-template.dto.ts

import { Type } from 'class-transformer';
import {
  IsBoolean, IsInt, IsOptional, IsPositive,
  IsString, Max, MaxLength, Min, MinLength,
} from 'class-validator';

export class CreateCustomPlanTemplateDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceAriary!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  durationDays: number = 30;

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
  isPublic?: boolean = true;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

// Tous les champs optionnels pour le PATCH
export class UpdateCustomPlanTemplateDto {
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
  isPublic?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
