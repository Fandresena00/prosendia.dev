// src/features/admin/dto/admin-custom-subscription.dto.ts

import { Type } from 'class-transformer';
import {
  IsInt, IsOptional, IsPositive, IsString,
  Max, MaxLength, Min,
} from 'class-validator';

export class CreateCustomSubscriptionDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  credits!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  durationDays!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceAriary!: number;

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
  @IsString()
  @MaxLength(500)
  note?: string;
}
