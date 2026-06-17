/**
 * @file src/features/users/services/users.service.ts
 *
 * CHANGES (avatar sync) :
 *   1. Nouveau champ avatarSource (LOCAL | GOOGLE) sur User — voir prisma/schema-changes.prisma
 *   2. replaceAvatar() — point d'entrée UNIQUE pour changer l'avatar :
 *        - si l'ancien avatarUrl pointait vers un fichier géré localement
 *          (/uploads/avatars/...), il est supprimé du disque avant d'écrire le nouveau
 *        - met à jour avatarUrl + avatarSource en une seule transaction Prisma
 *   3. findOrCreateOAuthUser() — si le compte existe déjà ET que sa photo est
 *      toujours "gérée par Google" (avatarSource=GOOGLE), on la resynchronise à
 *      chaque login avec la dernière photo du profil Google. Si l'utilisateur a
 *      uploadé une photo manuellement (avatarSource=LOCAL), on n'y touche plus —
 *      le choix manuel est prioritaire.
 *   4. UpdateUserDto n'accepte plus avatarUrl : tout changement d'avatar passe
 *      désormais par replaceAvatar() (endpoint POST /users/:id/avatar), pour
 *      garantir qu'on ne laisse jamais un fichier orphelin sur le disque.
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
import { unlink } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { PrismaService } from '../../../database/prisma.service.js';
import {
  AuthProvider,
  AvatarSource,
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

  /** Doit correspondre à `destination` dans FileInterceptor (users.controller.ts) */
  private readonly avatarDir = join(process.cwd(), 'uploads', 'avatars');

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
      avatarSource:    user.avatarSource,
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

  // ─── Avatar management ──────────────────────────────────────────────────────

  /** True si l'URL pointe vers un fichier que NOUS gérons sur le disque local. */
  private isManagedAvatarUrl(url: string | null | undefined): boolean {
    return !!url && url.includes('/uploads/avatars/');
  }

  /** Supprime le fichier local correspondant à une ancienne avatarUrl. Best-effort. */
  private async deleteLocalAvatarFile(avatarUrl: string): Promise<void> {
    let pathname = avatarUrl;
    try {
      pathname = new URL(avatarUrl).pathname;
    } catch {
      // avatarUrl n'était pas une URL absolue valide — on retente avec la valeur brute
    }

    const filePath = join(this.avatarDir, basename(pathname));

    try {
      await unlink(filePath);
      this.logger.log(`[AVATAR_FILE_DELETED] path=${filePath}`);
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code === 'ENOENT') return; // déjà absent — rien à faire
      this.logger.warn(
        `[AVATAR_FILE_DELETE_FAILED] path=${filePath} ` +
        `err="${err instanceof Error ? err.message : String(err)}"`,
      );
    }
  }

  /**
   * Point d'entrée UNIQUE pour changer l'avatar d'un utilisateur.
   *
   * - Si l'avatar actuel est un fichier géré localement (upload manuel précédent),
   *   il est supprimé du disque avant d'écrire le nouveau (jamais de fichier orphelin).
   * - Si l'avatar actuel est une URL externe (photo Google), rien à supprimer du
   *   disque : on remplace simplement la valeur en base.
   *
   * @param source LOCAL (upload manuel) ou GOOGLE (synchro automatique au login)
   */
  async replaceAvatar(
    userId: string,
    newAvatarUrl: string,
    source: AvatarSource,
  ): Promise<UserResponseDto> {
    const current = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!current) throw new NotFoundException('Utilisateur introuvable.');

    const hasOldManagedFile =
      this.isManagedAvatarUrl(current.avatarUrl) &&
      current.avatarUrl !== newAvatarUrl;

    if (hasOldManagedFile) {
      await this.deleteLocalAvatarFile(current.avatarUrl as string);
    }

    try {
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: { avatarUrl: newAvatarUrl, avatarSource: source },
      });

      this.logger.log(
        `[AVATAR_REPLACED] userId=${userId} source=${source} ` +
        `previousFileDeleted=${hasOldManagedFile}`,
      );

      return this.toResponse(updated);
    } catch (error) {
      this.handlePrismaError(error, 'Failed to update avatar');
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
          avatarSource:    AvatarSource.LOCAL,
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
   *
   * Synchro avatar : si le compte existe déjà et que sa photo est toujours
   * "gérée par Google" (avatarSource=GOOGLE, c.-à-d. jamais remplacée
   * manuellement), on la met à jour avec la dernière photo du profil Google
   * à chaque login. Si l'utilisateur a uploadé une photo lui-même
   * (avatarSource=LOCAL), elle est prioritaire et n'est jamais écrasée ici.
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

    if (existing) {
      const shouldSyncGoogleAvatar =
        existing.avatarSource === AvatarSource.GOOGLE &&
        !!data.avatarUrl &&
        data.avatarUrl !== existing.avatarUrl;

      if (shouldSyncGoogleAvatar) {
        this.logger.log(
          `[AVATAR_SYNCED_FROM_GOOGLE] userId=${existing.id} on login`,
        );
        return this.replaceAvatar(
          existing.id,
          data.avatarUrl as string,
          AvatarSource.GOOGLE,
        );
      }

      return this.toResponse(existing);
    }

    const now = new Date();
    const isGoogle = data.provider === AuthProvider.GOOGLE;

    const user = await this.prisma.user.create({
      data: {
        email:           data.email,
        username:        data.username,
        avatarUrl:       data.avatarUrl ?? null,
        avatarSource:    isGoogle ? AvatarSource.GOOGLE : AvatarSource.LOCAL,
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
          avatarSource:    AvatarSource.LOCAL,
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

  /**
   * Met à jour les champs de profil "simples". L'avatar n'est PLUS modifiable
   * via cette méthode — passe par replaceAvatar() (endpoint dédié) pour garantir
   * que l'ancien fichier local est toujours nettoyé du disque.
   */
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
