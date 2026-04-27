/**
 * @file src/features/users/users.service.ts
 * @description User domain service.
 *
 * Responsibilities:
 * - CRUD operations on the User entity
 * - Password hashing and verification
 * - Internal method for auth: findUserByEmailWithPassword
 *
 * NOT responsible for:
 * - Token generation → AuthService
 * - Session management → AuthService
 * - HTTP request validation → class-validator pipes + DTOs
 */

import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import bcrypt from 'bcrypt';
import { PrismaService } from '../../../database/prisma.service.js';
import {
  AuthProvider,
  Plan,
  Prisma,
} from '../../../generated/prisma/client.js';
import type { ChangePasswordDto } from '../dto/change-password.dto.js';
import type { CreateUserDto } from '../dto/create-user.dto.js';
import type { UpdateUserDto } from '../dto/update-user.dto.js';
import { UserResponseDto } from '../dto/user-response.dto.js';

/** Full Prisma row — used internally only, never returned to API consumers. */
type UserRecord = Prisma.UserGetPayload<Record<string, never>>;

/**
 * Internal type for password verification.
 * Used exclusively by AuthService — the hash must never leave the service layer.
 */
export type UserWithPassword = UserRecord & { password: string };

/** bcrypt cost factor — 12 is the modern recommended minimum (2025). */
const SALT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * Maps a full Prisma User row to the public UserResponseDto shape.
   * This is the ONLY place where sensitive fields are stripped.
   */
  private toResponse(user: UserRecord): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      // Preserve null rather than coercing to empty string
      avatarUrl: user.avatarUrl ?? null,
      activePlan: user.activePlan,
      // Include provider so frontend can show "Logged in with Google" etc.
      provider: user.provider,
      onboardingDone: user.onboardingDone,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Translates Prisma error codes into typed NestJS exceptions.
   * Always throws — return type `never` enforces this at compile time.
   */
  private handlePrismaError(error: unknown, fallback: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      switch (error.code) {
        case 'P2002':
          throw new ConflictException(
            'A user with this email or username already exists',
          );
        case 'P2025':
          throw new NotFoundException('User not found');
        default:
          throw new BadRequestException(fallback);
      }
    }

    throw new InternalServerErrorException(
      'An unexpected database error occurred',
    );
  }

  // ─── Queries ────────────────────────────────────────────────────────────────

  async findUserById(
    where: Prisma.UserWhereUniqueInput,
  ): Promise<UserResponseDto> {
    try {
      const user = await this.prisma.user.findUnique({ where });

      if (!user) throw new NotFoundException('User not found');

      return this.toResponse(user);
    } catch (error) {
      // Re-throw domain exceptions; translate everything else
      if (error instanceof NotFoundException) throw error;
      this.handlePrismaError(error, 'Failed to fetch user');
    }
  }

  /**
   * Returns null when no user matches — callers decide how to handle absence.
   * Used by AuthService to check for existing email before registration.
   */
  async findUserByEmail(email: string): Promise<UserResponseDto | null> {
    try {
      const user = await this.prisma.user.findUnique({ where: { email } });
      return user ? this.toResponse(user) : null;
    } catch (error) {
      this.handlePrismaError(error, 'Failed to fetch user by email');
    }
  }

  /**
   * @internal Used exclusively by AuthService for credential verification.
   * Returns the full Prisma row including the password hash.
   * This method MUST NOT be exposed via any controller.
   */
  async findUserByEmailWithPassword(
    email: string,
  ): Promise<UserWithPassword | null> {
    try {
      const user = await this.prisma.user.findUnique({ where: { email } });
      // Cast is safe: Prisma returns all columns including password by default
      return user as UserWithPassword | null;
    } catch (error) {
      this.handlePrismaError(error, 'Failed to fetch user credentials');
    }
  }

  async findAllUsers(): Promise<UserResponseDto[]> {
    try {
      const users = await this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
      });
      return users.map((user) => this.toResponse(user));
    } catch (error) {
      this.handlePrismaError(error, 'Failed to fetch users');
    }
  }

  // ─── Mutations ──────────────────────────────────────────────────────────────

  async createUser(data: CreateUserDto): Promise<UserResponseDto> {
    try {
      const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);

      const user = await this.prisma.user.create({
        data: {
          email: data.email,
          username: data.username,
          password: hashedPassword,
          activePlan: Plan.FREE,
          provider: AuthProvider.LOCAL,
          onboardingDone: false,
        },
      });

      return this.toResponse(user);
    } catch (error) {
      this.handlePrismaError(error, 'Failed to create user');
    }
  }

  async updateUser(
    where: Prisma.UserWhereUniqueInput,
    data: UpdateUserDto,
  ): Promise<UserResponseDto> {
    try {
      const user = await this.prisma.user.update({
        where,
        data: {
          // Spread only provided fields — undefined values are ignored by Prisma
          ...(data.email !== undefined && { email: data.email }),
          ...(data.username !== undefined && { username: data.username }),
          ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
          ...(data.activePlan !== undefined && { activePlan: data.activePlan }),
          ...(data.onboardingDone !== undefined && {
            onboardingDone: data.onboardingDone,
          }),
        },
      });

      return this.toResponse(user);
    } catch (error) {
      this.handlePrismaError(error, 'Failed to update user');
    }
  }

  async changePassword(
    where: Prisma.UserWhereUniqueInput,
    data: ChangePasswordDto,
  ): Promise<UserResponseDto> {
    // Fetch the full record outside the try/catch so NotFoundException
    // propagates cleanly without being swallowed by handlePrismaError
    const user = await this.prisma.user.findUnique({ where });

    if (!user) throw new NotFoundException('User not found');

    if (data.newPassword !== data.confirmPassword) {
      throw new BadRequestException('Password confirmation does not match');
    }

    const isCurrentValid = await bcrypt.compare(
      data.currentPassword,
      user.password,
    );

    if (!isCurrentValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    try {
      const hashedPassword = await bcrypt.hash(data.newPassword, SALT_ROUNDS);

      const updated = await this.prisma.user.update({
        where,
        data: { password: hashedPassword },
      });

      return this.toResponse(updated);
    } catch (error) {
      this.handlePrismaError(error, 'Failed to change password');
    }
  }

  async deleteUser(
    where: Prisma.UserWhereUniqueInput,
  ): Promise<UserResponseDto> {
    try {
      const user = await this.prisma.user.delete({ where });
      return this.toResponse(user);
    } catch (error) {
      this.handlePrismaError(error, 'Failed to delete user');
    }
  }
}
