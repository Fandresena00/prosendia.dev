import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class SyncPostsDto {
  @IsString() @IsNotEmpty() businessProfileId!: string;
  @IsOptional() @Type(() => Number) @IsInt() @IsPositive() limit?: number;
}

export class SyncCommentsDto {
  @IsString() @IsNotEmpty() postId!: string;
  @IsOptional() @Type(() => Number) @IsInt() @IsPositive() limit?: number;
}

export class SyncConversationsDto {
  @IsString() @IsNotEmpty() businessProfileId!: string;
  @IsOptional() @Type(() => Number) @IsInt() @IsPositive() limit?: number;
}
