/**
 * @file src/features/auth/auth.service.spec.ts
 * @description Unit tests for AuthService.
 * All external dependencies (UsersService, JwtService, PrismaService) are mocked.
 */

import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import bcrypt from 'bcrypt';
import type { UserResponseDto } from '../../users/dto/user-response.dto.js';
import { UsersService } from '../../users/services/users.service.js';
import { AuthService } from './auth.service.js';
import { TokenSessionService } from './token-session.service.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockUser: UserResponseDto = {
  id: 'uuid-1',
  email: 'test@example.com',
  username: 'testuser',
  avatarUrl: null,
  activePlan: 'FREE',
  provider: 'LOCAL',
  onboardingDone: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockUserWithPassword = {
  ...mockUser,
  password: bcrypt.hashSync('P@ssword1!', 10),
  providerId: null,
};

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockUsersService = {
  findUserByEmail: jest.fn(),
  findUserByEmailWithPassword: jest.fn(),
  createUser: jest.fn(),
  findUserById: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('signed.jwt.token'),
};

const mockConfigService = {
  getOrThrow: jest
    .fn()
    .mockReturnValue('mock-secret-32-chars-minimum-length!!'),
  get: jest
    .fn()
    .mockImplementation((_key: string, defaultVal: string) => defaultVal),
};

const mockTokenSessionService = {
  createRefreshSession: jest.fn().mockResolvedValue(undefined),
  validateAccessSession: jest.fn().mockResolvedValue(undefined),
  validateRefreshSession: jest.fn(),
  getSession: jest.fn(),
  revokeSessionByJti: jest.fn().mockResolvedValue(undefined),
  revokeAllActiveSessions: jest.fn().mockResolvedValue(undefined),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: TokenSessionService, useValue: mockTokenSessionService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();

    // Default: buildAuthResponse always succeeds
    mockUsersService.findUserById.mockResolvedValue(mockUser);
    mockTokenSessionService.createRefreshSession.mockResolvedValue(undefined);
  });

  // ── register ──────────────────────────────────────────────────────────────

  describe('register', () => {
    it('returns AuthResponseDto with user and token pair on success', async () => {
      mockUsersService.findUserByEmail.mockResolvedValue(null);
      mockUsersService.createUser.mockResolvedValue(mockUser);

      const result = await service.register({
        email: 'test@example.com',
        username: 'testuser',
        password: 'P@ssword1!',
      });

      expect(result.user).toEqual(mockUser);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(
        mockTokenSessionService.createRefreshSession,
      ).toHaveBeenCalledTimes(1);
    });

    it('throws ConflictException when email is already registered', async () => {
      mockUsersService.findUserByEmail.mockResolvedValue(mockUser);

      await expect(
        service.register({
          email: 'test@example.com',
          username: 'testuser',
          password: 'P@ssword1!',
        }),
      ).rejects.toThrow(ConflictException);

      expect(mockUsersService.createUser).not.toHaveBeenCalled();
    });
  });

  // ── login ─────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('returns AuthResponseDto for valid credentials', async () => {
      mockUsersService.findUserByEmailWithPassword.mockResolvedValue(
        mockUserWithPassword,
      );

      const result = await service.login({
        email: 'test@example.com',
        password: 'P@ssword1!',
      });

      expect(result.user).toEqual(mockUser);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('throws UnauthorizedException for unknown email', async () => {
      mockUsersService.findUserByEmailWithPassword.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@x.com', password: 'P@ssword1!' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for wrong password', async () => {
      mockUsersService.findUserByEmailWithPassword.mockResolvedValue(
        mockUserWithPassword,
      );

      await expect(
        service.login({ email: 'test@example.com', password: 'WrongP@ss1!' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('uses the same error message for unknown email and wrong password (prevents enumeration)', async () => {
      // Unknown email
      mockUsersService.findUserByEmailWithPassword.mockResolvedValue(null);
      let err1: Error | undefined;
      try {
        await service.login({ email: 'nobody@x.com', password: 'P@ssword1!' });
      } catch (e) {
        err1 = e as Error;
      }

      // Wrong password
      mockUsersService.findUserByEmailWithPassword.mockResolvedValue(
        mockUserWithPassword,
      );
      let err2: Error | undefined;
      try {
        await service.login({
          email: 'test@example.com',
          password: 'WrongP@ss1!',
        });
      } catch (e) {
        err2 = e as Error;
      }

      expect(err1?.message).toBe(err2?.message);
    });
  });

  // ── refresh ───────────────────────────────────────────────────────────────

  describe('refresh', () => {
    it('rotates the matched refresh session when the token hash matches', async () => {
      mockTokenSessionService.validateRefreshSession.mockResolvedValue({
        id: 'session-1',
        userId: 'uuid-1',
        jti: 'refresh-jti',
        tokenHash: bcrypt.hashSync('valid.refresh.token', 10),
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
        createdAt: new Date(),
      });

      const result = await service.refresh({
        sub: 'uuid-1',
        email: 'test@example.com',
        jti: 'refresh-jti',
        sessionTokenId: 'session-1',
        sessionTokenHash: bcrypt.hashSync('valid.refresh.token', 10),
        refreshToken: 'valid.refresh.token',
      });

      expect(result.user).toEqual(mockUser);
      expect(mockTokenSessionService.revokeSessionByJti).toHaveBeenCalledWith(
        'uuid-1',
        'refresh-jti',
      );
      expect(mockTokenSessionService.createRefreshSession).toHaveBeenCalled();
    });

    it('throws UnauthorizedException when no active token matches', async () => {
      await expect(
        service.refresh({
          sub: 'uuid-1',
          email: 'test@example.com',
          jti: 'refresh-jti',
          sessionTokenId: 'session-1',
          sessionTokenHash: bcrypt.hashSync('another.token', 10),
          refreshToken: 'some.invalid.token',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('revokes all tokens when reuse is detected', async () => {
      try {
        await service.refresh({
          sub: 'uuid-1',
          email: 'test@example.com',
          jti: 'refresh-jti',
          sessionTokenId: 'session-1',
          sessionTokenHash: bcrypt.hashSync('another.token', 10),
          refreshToken: 'reused.token',
        });
      } catch {
        // Expected to throw
      }

      expect(
        mockTokenSessionService.revokeAllActiveSessions,
      ).toHaveBeenCalledWith('uuid-1');
    });
  });

  // ── logout ────────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('revokes the current refresh session when the token hash matches', async () => {
      await expect(
        service.logout({
          sub: 'uuid-1',
          email: 'test@example.com',
          jti: 'refresh-jti',
          sessionTokenId: 'session-1',
          sessionTokenHash: bcrypt.hashSync('valid.refresh.token', 10),
          refreshToken: 'valid.refresh.token',
        }),
      ).resolves.toBeUndefined();

      expect(mockTokenSessionService.revokeSessionByJti).toHaveBeenCalledWith(
        'uuid-1',
        'refresh-jti',
      );
    });

    it('revokes all sessions when a revoked token is replayed', async () => {
      await expect(
        service.logout({
          sub: 'uuid-1',
          email: 'test@example.com',
          jti: 'refresh-jti',
          sessionTokenId: 'session-1',
          sessionTokenHash: bcrypt.hashSync('another.token', 10),
          refreshToken: 'already.revoked.token',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(
        mockTokenSessionService.revokeAllActiveSessions,
      ).toHaveBeenCalledWith('uuid-1');
    });
  });
});
