/**
 * @file src/features/users/dto/change-password.dto.ts
 * @description Input validation for PATCH /users/:id/change-password.
 * Requires the current password for verification before updating.
 */

import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString({ message: 'Current password must be a string' })
  @IsNotEmpty({ message: 'Current password is required' })
  currentPassword!: string;

  @IsString({ message: 'New password must be a string' })
  @IsNotEmpty({ message: 'New password is required' })
  @MinLength(8, { message: 'New password must be at least 8 characters' })
  @Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/, {
    message:
      'New password must contain at least one uppercase letter, one number, and one special character',
  })
  newPassword!: string;

  @IsString({ message: 'Password confirmation must be a string' })
  @IsNotEmpty({ message: 'Password confirmation is required' })
  confirmPassword!: string;
}
