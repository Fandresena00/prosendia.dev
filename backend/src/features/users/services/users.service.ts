/**
 * @file src/features/users/users.service.ts
 *
 * FIX — Bug crédits FREE
 * ──────────────────────
 * createUser() créait l'utilisateur avec activePlan=FREE mais ne créait ni
 * Subscription, ni CreditLedger, ni ne mettait creditBalance=500.
 *
 * Résultat : tout nouvel utilisateur avait 0 crédit → IA bloquée dès l'inscription.
 *
 * FIX : après prisma.user.create(), appeler CreditService.initializeFreeUser()
 * qui crée l'abonnement FREE ACTIVE + attribue 500 crédits atomiquement.
 *
 * L'injection de CreditService utilise forwardRef() pour éviter la dépendance
 * circulaire potentielle (BillingModule ↔ UsersModule).
 * Si aucune dépendance circulaire, forwardRef n'est pas nécessaire — vérifier
 * les imports dans users.module.ts.
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

/** Full Prisma row — used internally only, never returned to API consumers. */
type UserRecord = Prisma.UserGetPayload<Record<string, never>>;

export type UserWithPassword = UserRecord & { password: string };

const SALT_ROUNDS = 12;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    // forwardRef protège contre la dépendance circulaire
    // BillingModule → UsersModule → BillingModule si les deux s'importent mutuellement
    @Inject(forwardRef(() => CreditService))
    private readonly creditService: CreditService,
  ) {}

  // ─── Private helpers ───────────────────────────────────────────────────────

  private toResponse(user: UserRecord): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      avatarUrl: user.avatarUrl ?? null,
      activePlan: user.activePlan,
      provider: user.provider,
      onboardingDone: user.onboardingDone,
      emailVerified: user.emailVerified, // ← NEW
      emailVerifiedAt: user.emailVerifiedAt ?? null, // ← NEW
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

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

  // ─── Queries ───────────────────────────────────────────────────────────────

  async findUserById(
    where: Prisma.UserWhereUniqueInput,
  ): Promise<UserResponseDto> {
    try {
      const user = await this.prisma.user.findUnique({ where });
      if (!user) throw new NotFoundException('User not found');
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

  async createVerifiedUser(data: {
    email: string;
    username: string;
    passwordHash: string;
  }): Promise<UserResponseDto> {
    try {
      const now = new Date();

      const user = await this.prisma.user.create({
        data: {
          email: data.email,
          username: data.username,
          password: data.passwordHash, // already bcrypt-hashed
          activePlan: Plan.FREE,
          provider: AuthProvider.LOCAL,
          onboardingDone: false,
          emailVerified: true, // ← verified at creation
          emailVerifiedAt: now, // ← timestamp
        },
      });

      this.logger.log(
        `[USER_CREATED_VERIFIED] userId=${user.id} email=${user.email} ` +
          `emailVerified=true plan=FREE`,
      );

      try {
        await this.creditService.initializeFreeUser(user.id);
        this.logger.log(
          `[USER_CREDITS_INITIALIZED] userId=${user.id} creditBalance=500`,
        );
      } catch (creditErr: unknown) {
        const msg =
          creditErr instanceof Error ? creditErr.message : String(creditErr);
        this.logger.error(
          `[USER_CREDITS_INIT_FAILED] userId=${user.id} err="${msg}". ` +
            `Run CreditService.repairBalance("${user.id}") to fix manually.`,
        );
      }

      return this.toResponse(user);
    } catch (error) {
      this.handlePrismaError(error, 'Failed to create verified user');
    }
  } // ─── createUser — FIX ─────────────────────────────────────────────────────

  /**
   * Crée un nouvel utilisateur et initialise ses crédits FREE (500 crédits).
   *
   * AVANT le fix : creditBalance restait à 0 après création.
   * APRÈS le fix : initializeFreeUser() est appelé après création
   *   → Subscription FREE ACTIVE créée
   *   → 500 crédits attribués
   *   → CreditLedger initialisé
   *
   * En cas d'échec de l'initialisation des crédits, l'utilisateur est tout
   * de même créé (on ne rollback pas la création) mais une erreur est loggée
   * pour intervention manuelle ou rattrapage via repairBalance().
   */
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
          emailVerified: false,
          emailVerifiedAt: null,
          // creditBalance: 0 (défaut Prisma) — sera mis à 500 juste après
        },
      });

      this.logger.log(
        `[USER_CREATED] userId=${user.id} email=${user.email} plan=FREE`,
      );

      // ── FIX: Initialiser les crédits FREE ──────────────────────────────
      // Ne pas await dans un try/catch qui avale l'erreur silencieusement.
      // On log l'erreur mais on ne bloque pas la création du compte.
      try {
        await this.creditService.initializeFreeUser(user.id);

        this.logger.log(
          `[USER_CREDITS_INITIALIZED] userId=${user.id} ` +
            `creditBalance=500 plan=FREE subscription=ACTIVE`,
        );
      } catch (creditErr: unknown) {
        const msg =
          creditErr instanceof Error ? creditErr.message : String(creditErr);
        this.logger.error(
          `[USER_CREDITS_INIT_FAILED] CRITICAL — User created but credits NOT initialized. ` +
            `userId=${user.id} email=${user.email} err="${msg}". ` +
            `Run CreditService.repairBalance("${user.id}") to fix manually.`,
        );
        // Ne pas relancer — le compte est créé, les crédits peuvent être
        // réparés via repairBalance() ou au prochain login
      }

      return this.toResponse(user);
    } catch (error) {
      this.handlePrismaError(error, 'Failed to create user');
    }
  }

  // ─── OAuth user creation (Google, Facebook) ────────────────────────────────

  /**
   * Utilisé par AuthService pour les providers OAuth.
   * Même logique d'initialisation des crédits.
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

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        avatarUrl: data.avatarUrl ?? null,
        password: '',
        activePlan: Plan.FREE,
        provider: data.provider,
        onboardingDone: false,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });

    this.logger.log(
      `[USER_CREATED_OAUTH] userId=${user.id} email=${user.email} ` +
        `provider=${data.provider} plan=FREE`,
    );

    try {
      await this.creditService.initializeFreeUser(user.id);
      this.logger.log(
        `[USER_CREDITS_INITIALIZED] OAuth userId=${user.id} creditBalance=500`,
      );
    } catch (creditErr: unknown) {
      this.logger.error(
        `[USER_CREDITS_INIT_FAILED] OAuth user created but credits NOT initialized. ` +
          `userId=${user.id} err="${creditErr instanceof Error ? creditErr.message : String(creditErr)}"`,
      );
    }

    return this.toResponse(user);
  }

  // ─── Repair credits on login (safety net) ─────────────────────────────────

  /**
   * Vérifie et répare les crédits lors du login si le solde est incohérent.
   * Safety net pour les comptes créés avant le fix.
   *
   * À appeler dans AuthService.login() / AuthService.refreshTokens()
   * une seule fois par session (pas à chaque refresh).
   */
  async ensureCreditsInitialized(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { creditBalance: true, activePlan: true },
    });

    if (!user) return;

    // Si le solde est à 0 et le plan est FREE → initialiser
    if (user.creditBalance === 0) {
      this.logger.warn(
        `[CREDITS_REPAIR_ON_LOGIN] user=${userId} has 0 credits — ` +
          `running initializeFreeUser() as safety net`,
      );

      try {
        // Vérifier s'il y a déjà un abonnement actif avant d'en créer un
        const activeSub = await this.prisma.subscription.findFirst({
          where: { userId, status: 'ACTIVE' },
          select: { id: true, creditsGranted: true },
        });

        if (activeSub && activeSub.creditsGranted > 0) {
          // Abonnement existe mais crédits pas attribués → grant direct
          await this.creditService.grantCredits(
            userId,
            activeSub.id,
            activeSub.creditsGranted,
            'Repair on login',
          );
          this.logger.log(
            `[CREDITS_REPAIRED_ON_LOGIN] user=${userId} ` +
              `credits=${activeSub.creditsGranted} (from existing subscription)`,
          );
        } else if (!activeSub) {
          // Pas d'abonnement du tout → initialiser FREE complet
          await this.creditService.initializeFreeUser(userId);
          this.logger.log(
            `[CREDITS_INITIALIZED_ON_LOGIN] user=${userId} credits=500 FREE`,
          );
        }
      } catch (err: unknown) {
        this.logger.error(
          `[CREDITS_REPAIR_FAILED] user=${userId} ` +
            `err="${err instanceof Error ? err.message : String(err)}"`,
        );
      }
    }
  }

  // ─── Standard mutations ────────────────────────────────────────────────────

  async updateUser(
    where: Prisma.UserWhereUniqueInput,
    data: UpdateUserDto,
  ): Promise<UserResponseDto> {
    try {
      const user = await this.prisma.user.update({
        where,
        data: {
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
