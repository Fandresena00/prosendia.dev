/**
 * @file src/features/users/users.service.spec.ts
 * @description Unit tests for UsersService.
 * All Prisma calls are mocked — no DB required.
 */

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import bcrypt from 'bcrypt';
import { Prisma } from '../../../generated/prisma/client.js';
import { UsersService } from './users.service.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockUserRecord = {
  id: 'uuid-1',
  email: 'test@example.com',
  username: 'testuser',
  password: bcrypt.hashSync('P@ssword1!', 10),
  avatarUrl: null,
  activePlan: 'FREE' as const,
  provider: 'LOCAL' as const,
  providerId: null,
  onboardingDone: false,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

const mockUserResponse = {
  id: mockUserRecord.id,
  email: mockUserRecord.email,
  username: mockUserRecord.username,
  avatarUrl: null,
  activePlan: mockUserRecord.activePlan,
  provider: mockUserRecord.provider,
  onboardingDone: mockUserRecord.onboardingDone,
  createdAt: mockUserRecord.createdAt,
  updatedAt: mockUserRecord.updatedAt,
};

// ─── Prisma mock ──────────────────────────────────────────────────────────────

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: 'PrismaService', useValue: mockPrisma },
      ],
    })
      .overrideProvider('PrismaService')
      .useValue(mockPrisma)
      .compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  // ── findUserById ──────────────────────────────────────────────────────────

  describe('findUserById', () => {
    it('returns UserResponseDto when user exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUserRecord);

      const result = await service.findUserById({ id: 'uuid-1' });

      expect(result).toEqual(mockUserResponse);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'uuid-1' },
      });
    });

    it('throws NotFoundException when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findUserById({ id: 'missing' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── findUserByEmail ───────────────────────────────────────────────────────

  describe('findUserByEmail', () => {
    it('returns UserResponseDto when email matches', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUserRecord);

      const result = await service.findUserByEmail('test@example.com');

      expect(result).toEqual(mockUserResponse);
    });

    it('returns null when no user matches the email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.findUserByEmail('nobody@example.com');

      expect(result).toBeNull();
    });
  });

  // ── createUser ────────────────────────────────────────────────────────────

  describe('createUser', () => {
    it('creates a user and returns UserResponseDto (no password in response)', async () => {
      mockPrisma.user.create.mockResolvedValue(mockUserRecord);

      const result = await service.createUser({
        email: 'test@example.com',
        username: 'testuser',
        password: 'P@ssword1!',
      });

      expect(result).toEqual(mockUserResponse);
      // Ensure the password hash was never returned
      expect(result).not.toHaveProperty('password');
    });

    it('throws ConflictException on duplicate email (P2002)', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: '5.0.0', meta: {} },
      );
      mockPrisma.user.create.mockRejectedValue(prismaError);

      await expect(
        service.createUser({
          email: 'test@example.com',
          username: 'testuser',
          password: 'P@ssword1!',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── updateUser ────────────────────────────────────────────────────────────

  describe('updateUser', () => {
    it('updates provided fields and returns updated UserResponseDto', async () => {
      const updated = { ...mockUserRecord, username: 'newname' };
      mockPrisma.user.update.mockResolvedValue(updated);

      const result = await service.updateUser(
        { id: 'uuid-1' },
        { username: 'newname' },
      );

      expect(result.username).toBe('newname');
    });

    it('throws NotFoundException when user does not exist (P2025)', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Record not found',
        { code: 'P2025', clientVersion: '5.0.0', meta: {} },
      );
      mockPrisma.user.update.mockRejectedValue(prismaError);

      await expect(
        service.updateUser({ id: 'missing' }, { username: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── changePassword ────────────────────────────────────────────────────────

  describe('changePassword', () => {
    it('changes the password when current password is correct', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUserRecord);
      mockPrisma.user.update.mockResolvedValue(mockUserRecord);

      const result = await service.changePassword(
        { id: 'uuid-1' },
        {
          currentPassword: 'P@ssword1!',
          newPassword: 'N3wP@ssword!',
          confirmPassword: 'N3wP@ssword!',
        },
      );

      expect(result).toEqual(mockUserResponse);
      expect(mockPrisma.user.update).toHaveBeenCalled();
    });

    it('throws NotFoundException when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.changePassword(
          { id: 'missing' },
          {
            currentPassword: 'P@ssword1!',
            newPassword: 'N3wP@ssword!',
            confirmPassword: 'N3wP@ssword!',
          },
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when passwords do not match', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUserRecord);

      await expect(
        service.changePassword(
          { id: 'uuid-1' },
          {
            currentPassword: 'P@ssword1!',
            newPassword: 'N3wP@ssword!',
            confirmPassword: 'DifferentPassword1!',
          },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when current password is incorrect', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUserRecord);

      await expect(
        service.changePassword(
          { id: 'uuid-1' },
          {
            currentPassword: 'WrongP@ss1!',
            newPassword: 'N3wP@ssword!',
            confirmPassword: 'N3wP@ssword!',
          },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── deleteUser ────────────────────────────────────────────────────────────

  describe('deleteUser', () => {
    it('deletes the user and returns UserResponseDto', async () => {
      mockPrisma.user.delete.mockResolvedValue(mockUserRecord);

      const result = await service.deleteUser({ id: 'uuid-1' });

      expect(result).toEqual(mockUserResponse);
    });

    it('throws NotFoundException when user does not exist (P2025)', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Record not found',
        { code: 'P2025', clientVersion: '5.0.0', meta: {} },
      );
      mockPrisma.user.delete.mockRejectedValue(prismaError);

      await expect(service.deleteUser({ id: 'missing' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
