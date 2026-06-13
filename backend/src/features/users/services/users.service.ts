/**
 * @file src/features/users/services/users.service.ts
 *
 * CHANGES:
 *   1. findOrCreateOAuthUser() — emailVerified=true + emailVerifiedAt=now()
 *      (Google a déjà vérifié l'email)
 *   2. createVerifiedUser() — méthode ajoutée pour l'inscription locale
 *      (appelée après vérification du code email)
 *   3. toResponse() — expose emailVerified + emailVerifiedAt
 *   4. createUser() — emailVerified=false (non utilisé en prod, garde-fou)
 *
 * Fichier complet — remplace l'ancien users.service.ts.
 */

import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import bcrypt from 'bcrypt';
import { PrismaService } from '../../../database/prisma.service.js';
import {
  AuthProvider,
  Plan,
  Prisma,
} from '../../../generated/prisma/client.js';
import { CreditService } from '../../billing/services/credit.service.js';
import type { ChangePasswordDto } from '../dto/change-password.dto.js';
import type { CreateUserDto } from '../dto/create-user.dto.js';
import type { UpdateUserDto } from '../dto/update-user.dto.js';
import { UserResponseDto } from '../dto/user-response.dto.js';

type UserRecord = Prisma.UserGetPayload<Record<string, never>>;
export type UserWithPassword = UserRecord & { password: string };

const SALT_ROUNDS = 12;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => CreditService))
    private readonly creditService: CreditService,
  ) {}

  // ─── Private helpers ──────────────────────────────────────────────────────

  private toResponse(user: UserRecord): UserResponseDto {
    return {
      id:              user.id,
      email:           user.email,
      username:        user.username,
      avatarUrl:       user.avatarUrl ?? null,
      activePlan:      user.activePlan,
      provider:        user.provider,
      onboardingDone:  user.onboardingDone,
      emailVerified:   user.emailVerified,
      emailVerifiedAt: user.emailVerifiedAt ?? null,
      createdAt:       user.createdAt,
      updatedAt:       user.updatedAt,
    };
  }

  private handlePrismaError(error: unknown, fallback: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      switch (error.code) {
        case 'P2002':
          throw new ConflictException(
            'Un utilisateur avec cet email ou ce nom existe déjà.',
          );
        case 'P2025':
          throw new NotFoundException('Utilisateur introuvable.');
        default:
          throw new BadRequestException(fallback);
      }
    }
    throw new InternalServerErrorException(
      'Une erreur inattendue s\'est produite.',
    );
  }

  private async initCredits(userId: string, email: string): Promise<void> {
    try {
      await this.creditService.initializeFreeUser(userId);
      this.logger.log(
        `[USER_CREDITS_INITIALIZED] userId=${userId} creditBalance=500`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[USER_CREDITS_INIT_FAILED] userId=${userId} email=${email} err="${msg}". ` +
        `Run CreditService.repairBalance("${userId}") to fix manually.`,
      );
    }
  }

  // ─── Queries ──────────────────────────────────────────────────────────────

  async findUserById(
    where: Prisma.UserWhereUniqueInput,
  ): Promise<UserResponseDto> {
    try {
      const user = await this.prisma.user.findUnique({ where });
      if (!user) throw new NotFoundException('Utilisateur introuvable.');
      return this.toResponse(user);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.handlePrismaError(error, 'Failed to fetch user');
    }
  }

  async findUserByEmail(email: string): Promise<UserResponseDto | null> {
    try {
      const user = await this.prisma.user.findUnique({ where: { email } });
      return user ? this.toResponse(user) : null;
    } catch (error) {
      this.handlePrismaError(error, 'Failed to fetch user by email');
    }
  }

  async findUserByEmailWithPassword(
    email: string,
  ): Promise<UserWithPassword | null> {
    try {
      const user = await this.prisma.user.findUnique({ where: { email } });
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
      return users.map((u) => this.toResponse(u));
    } catch (error) {
      this.handlePrismaError(error, 'Failed to fetch users');
    }
  }

  // ─── createVerifiedUser — appelé après vérification email ─────────────────

  /**
   * Crée un utilisateur LOCAL avec email déjà vérifié.
   * Appelé par AuthService.completeRegistration() uniquement.
   * Accepte un passwordHash pré-calculé (bcrypt) — pas de double-hashing.
   */
  async createVerifiedUser(data: {
    email: string;
    username: string;
    passwordHash: string;
  }): Promise<UserResponseDto> {
    try {
      const now = new Date();

      const user = await this.prisma.user.create({
        data: {
          email:           data.email,
          username:        data.username,
          password:        data.passwordHash,
          activePlan:      Plan.FREE,
          provider:        AuthProvider.LOCAL,
          onboardingDone:  false,
          emailVerified:   true,
          emailVerifiedAt: now,
        },
      });

      this.logger.log(
        `[USER_CREATED_VERIFIED] userId=${user.id} email=${user.email} plan=FREE`,
      );

      await this.initCredits(user.id, user.email);

      return this.toResponse(user);
    } catch (error) {
      this.handlePrismaError(error, 'Failed to create verified user');
    }
  }

  // ─── findOrCreateOAuthUser — Google / Facebook ────────────────────────────

  /**
   * Trouve ou crée un utilisateur OAuth (Google, Facebook).
   * Les comptes OAuth sont considérés vérifiés d'office.
   */
  async findOrCreateOAuthUser(data: {
    email: string;
    username: string;
    avatarUrl?: string;
    provider: AuthProvider;
  }): Promise<UserResponseDto> {
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existing) return this.toResponse(existing);

    const now = new Date();

    const user = await this.prisma.user.create({
      data: {
        email:           data.email,
        username:        data.username,
        avatarUrl:       data.avatarUrl ?? null,
        password:        '',
        activePlan:      Plan.FREE,
        provider:        data.provider,
        onboardingDone:  false,
        // OAuth = email pré-vérifié par le provider
        emailVerified:   true,
        emailVerifiedAt: now,
      },
    });

    this.logger.log(
      `[USER_CREATED_OAUTH] userId=${user.id} email=${user.email} ` +
      `provider=${data.provider} emailVerified=true`,
    );

    await this.initCredits(user.id, user.email);

    return this.toResponse(user);
  }

  // ─── createUser — garde-fou admin (non utilisé en prod signup) ────────────

  async createUser(data: CreateUserDto): Promise<UserResponseDto> {
    try {
      const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);

      const user = await this.prisma.user.create({
        data: {
          email:           data.email,
          username:        data.username,
          password:        hashedPassword,
          activePlan:      Plan.FREE,
          provider:        AuthProvider.LOCAL,
          onboardingDone:  false,
          emailVerified:   false,
          emailVerifiedAt: null,
        },
      });

      this.logger.log(
        `[USER_CREATED] userId=${user.id} email=${user.email} plan=FREE`,
      );

      await this.initCredits(user.id, user.email);

      return this.toResponse(user);
    } catch (error) {
      this.handlePrismaError(error, 'Failed to create user');
    }
  }

  // ─── Standard mutations ───────────────────────────────────────────────────

  async updateUser(
    where: Prisma.UserWhereUniqueInput,
    data: UpdateUserDto,
  ): Promise<UserResponseDto> {
    try {
      const user = await this.prisma.user.update({
        where,
        data: {
          ...(data.email        !== undefined && { email: data.email }),
          ...(data.username     !== undefined && { username: data.username }),
          ...(data.avatarUrl    !== undefined && { avatarUrl: data.avatarUrl }),
          ...(data.activePlan   !== undefined && { activePlan: data.activePlan }),
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
    const user = await this.prisma.user.findUnique({ where });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');

    if (data.newPassword !== data.confirmPassword) {
      throw new BadRequestException(
        'La confirmation du mot de passe ne correspond pas.',
      );
    }

    const isCurrentValid = await bcrypt.compare(
      data.currentPassword,
      user.password,
    );
    if (!isCurrentValid) {
      throw new BadRequestException('Le mot de passe actuel est incorrect.');
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

  // ─── Safety net : repair credits on login ─────────────────────────────────

  async ensureCreditsInitialized(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { creditBalance: true },
    });

    if (!user || user.creditBalance > 0) return;

    this.logger.warn(
      `[CREDITS_REPAIR_ON_LOGIN] userId=${userId} has 0 credits — running repair`,
    );

    try {
      const activeSub = await this.prisma.subscription.findFirst({
        where: { userId, status: 'ACTIVE' },
        select: { id: true, creditsGranted: true },
      });

      if (activeSub && activeSub.creditsGranted > 0) {
        await this.creditService.grantCredits(
          userId,
          activeSub.id,
          activeSub.creditsGranted,
          'Repair on login',
        );
      } else if (!activeSub) {
        await this.creditService.initializeFreeUser(userId);
      }
    } catch (err: unknown) {
      this.logger.error(
        `[CREDITS_REPAIR_FAILED] userId=${userId} ` +
        `err="${err instanceof Error ? err.message : String(err)}"`,
      );
    }
  }
}
