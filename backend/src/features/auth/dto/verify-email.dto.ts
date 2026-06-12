/**
 * @file src/features/auth/dto/verify-email.dto.ts
 */

import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class VerifyEmailDto {
  @IsEmail({}, { message: 'Format email invalide.' })
  @IsNotEmpty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'Le code est requis.' })
  @Length(6, 6, { message: 'Le code doit contenir exactement 6 chiffres.' })
  @Matches(/^\d{6}$/, { message: 'Le code doit contenir uniquement des chiffres.' })
  code!: string;
}
