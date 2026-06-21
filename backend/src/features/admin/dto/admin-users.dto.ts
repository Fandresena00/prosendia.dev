// src/features/admin/dto/admin-users.dto.ts

import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { PlanIdDto } from '../../billing/dto/billing.dto.js';

export class AdminListUsersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 20;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsEnum(PlanIdDto)
  plan?: PlanIdDto;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  suspended?: boolean;
}

export class SuspendUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ChangeUserPlanDto {
  @IsEnum(PlanIdDto)
  plan!: PlanIdDto;
}

export class AdjustCreditsDto {
  @Type(() => Number)
  @IsNumber()
  /** Positif = ajouter, négatif = retirer */
  amount!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
