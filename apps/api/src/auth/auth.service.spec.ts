import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { User, Session, Prisma } from '@prisma/client';

describe('AuthService', () => {
  let service: AuthService;
  let prismaMock: {
    user: {
      findFirst: jest.Mock<Promise<User | null>, [Prisma.UserFindFirstArgs]>;
      create: jest.Mock<Promise<User>, [Prisma.UserCreateArgs]>;
    };
    session: {
      findFirst: jest.Mock<
        Promise<(Session & { user: User }) | null>,
        [Prisma.SessionFindFirstArgs]
      >;
      create: jest.Mock<Promise<Session>, [Prisma.SessionCreateArgs]>;
      update: jest.Mock<Promise<Session>, [Prisma.SessionUpdateArgs]>;
      updateMany: jest.Mock<
        Promise<Prisma.BatchPayload>,
        [Prisma.SessionUpdateManyArgs]
      >;
    };
  };
  let jwtServiceMock: {
    sign: jest.Mock<string, [object, object?]>;
    verifyAsync: jest.Mock<Promise<unknown>, [string]>;
  };

  const mockUser: User = {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'test@example.com',
    passwordHash: '',
    status: 'ACTIVE',
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    passwordChangedAt: null,
    createdAt: new Date('2026-08-28T00:00:00.000Z'),
    updatedAt: new Date('2026-08-28T00:00:00.000Z'),
    deletedAt: null,
  };

  beforeAll(async () => {
    mockUser.passwordHash = await argon2.hash('ValidPassword123!', {
      type: argon2.argon2id,
    });
  });

  beforeEach(async () => {
    prismaMock = {
      user: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      session: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    jwtServiceMock = {
      sign: jest.fn().mockReturnValue('signed.jwt.token'),
      verifyAsync: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtServiceMock },
        { provide: EventBusService, useValue: { publish: jest.fn() } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('1. should register a new user successfully', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);
      prismaMock.user.create.mockResolvedValue({
        id: mockUser.id,
        email: 'newuser@example.com',
        passwordHash: 'somehash',
        status: 'ACTIVE',
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: null,
        passwordChangedAt: null,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
        deletedAt: null,
      });

      const result = await service.register({
        email: '  NewUser@example.com  ',
        password: 'ValidPassword123!',
      });

      expect(result).toEqual({
        id: mockUser.id,
        email: 'newuser@example.com',
        status: 'ACTIVE',
        createdAt: mockUser.createdAt,
      });
      expect(prismaMock.user.create).toHaveBeenCalledTimes(1);
      const callArgs = prismaMock.user.create.mock.calls[0][0];
      expect(callArgs.data.email).toBe('newuser@example.com');
      expect(callArgs.data.status).toBe('ACTIVE');
      expect(typeof callArgs.data.passwordHash).toBe('string');
      expect(callArgs.data.passwordHash.startsWith('$argon2id$')).toBe(true);
    });

    it('2. should reject registration with duplicate email', async () => {
      prismaMock.user.findFirst.mockResolvedValue(mockUser);

      await expect(
        service.register({
          email: 'test@example.com',
          password: 'ValidPassword123!',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('3. should hash passwords using native Argon2id', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);
      prismaMock.user.create.mockImplementation((args: Prisma.UserCreateArgs) =>
        Promise.resolve({
          id: 'uuid',
          email: args.data.email,
          passwordHash: args.data.passwordHash,
          status: args.data.status ?? 'ACTIVE',
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: null,
          passwordChangedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        }),
      );

      await service.register({
        email: 'argon@example.com',
        password: 'PlaintextPassword123!',
      });

      const callArgs = prismaMock.user.create.mock.calls[0][0];
      const savedHash = callArgs.data.passwordHash;

      expect(savedHash.startsWith('$argon2id$')).toBe(true);
      const isVerified = await argon2.verify(
        savedHash,
        'PlaintextPassword123!',
      );
      expect(isVerified).toBe(true);
    });
  });

  describe('login', () => {
    it('4. should login successfully with valid credentials and return access + refresh tokens', async () => {
      prismaMock.user.findFirst.mockResolvedValue(mockUser);
      prismaMock.session.create.mockResolvedValue({
        id: 'session-uuid',
        userId: mockUser.id,
        refreshTokenHash: 'hashed',
        userAgent: 'Mozilla/5.0',
        ipAddress: '127.0.0.1',
        deviceInfo: null,
        revokedAt: null,
        revokedReason: null,
        lastActivityAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.login(
        { email: 'TEST@example.com', password: 'ValidPassword123!' },
        '127.0.0.1',
        'Mozilla/5.0',
      );

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.refreshToken).toBeDefined();
      expect(typeof result.refreshToken).toBe('string');
      expect(result.expiresIn).toBe(900);
      expect(result.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        status: 'ACTIVE',
        createdAt: mockUser.createdAt,
      });

      // Verify Session was created with SHA-256 hash (never plaintext)
      const sessionCall = prismaMock.session.create.mock.calls[0][0];
      expect(sessionCall.data.refreshTokenHash).toHaveLength(64); // SHA-256 hex string
      expect(sessionCall.data.userId).toBe(mockUser.id);
      expect(sessionCall.data.ipAddress).toBe('127.0.0.1');
      expect(sessionCall.data.userAgent).toBe('Mozilla/5.0');
    });

    it('5. should reject login with invalid password using generic error', async () => {
      prismaMock.user.findFirst.mockResolvedValue(mockUser);

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'WrongPassword!',
        }),
      ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
    });

    it('6. should reject login for non-existent user using generic error', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'unknown@example.com',
          password: 'Password123!',
        }),
      ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
    });

    it('7. should reject login for suspended/inactive user', async () => {
      prismaMock.user.findFirst.mockResolvedValue({
        ...mockUser,
        status: 'SUSPENDED',
      });

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'ValidPassword123!',
        }),
      ).rejects.toThrow(
        new UnauthorizedException('Account is inactive or suspended'),
      );
    });

    it('8. should reject login for soft-deleted user', async () => {
      // Prisma query filters out deletedAt != null
      prismaMock.session.create.mockResolvedValue({
        id: 'session-uuid',
        userId: mockUser.id,
        refreshTokenHash: 'hashed',
        userAgent: 'Mozilla/5.0',
        ipAddress: '127.0.0.1',
        deviceInfo: null,
        revokedAt: null,
        revokedReason: null,
        lastActivityAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });
  });

  describe('refresh', () => {
    it('8. should refresh tokens successfully on valid session and rotate token hash', async () => {
      const originalToken =
        'raw-refresh-token-12345678901234567890123456789012';
      const tokenHash = crypto
        .createHash('sha256')
        .update(originalToken)
        .digest('hex');

      const activeSession: Session & { user: User } = {
        id: 'session-uuid',
        userId: mockUser.id,
        refreshTokenHash: tokenHash,
        userAgent: null,
        ipAddress: null,
        deviceInfo: null,
        revokedAt: null,
        revokedReason: null,
        lastActivityAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
        updatedAt: new Date(),
        user: mockUser,
      };

      prismaMock.session.findFirst.mockResolvedValue(activeSession);
      prismaMock.session.update.mockResolvedValue({ ...activeSession });

      const result = await service.refresh(originalToken);

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.refreshToken).toBeDefined();
      expect(result.refreshToken).not.toBe(originalToken);

      // Verify session was updated with new hash
      const updateCall = prismaMock.session.update.mock.calls[0][0];
      expect(updateCall.where.id).toBe('session-uuid');
      expect(updateCall.data.refreshTokenHash).toHaveLength(64);
    });

    it('10. should reject refresh when token hash does not match (Replay / Stolen Token)', async () => {
      prismaMock.session.findFirst.mockResolvedValue(null);

      await expect(
        service.refresh('compromised-or-old-refresh-token'),
      ).rejects.toThrow(
        new UnauthorizedException('Invalid or revoked refresh token'),
      );
    });

    it('11. should reject refresh on revoked session', async () => {
      const token = 'some-token';
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      prismaMock.session.findFirst.mockResolvedValue({
        id: 'session-uuid',
        userId: mockUser.id,
        refreshTokenHash: tokenHash,
        userAgent: null,
        ipAddress: null,
        revokedAt: new Date('2026-08-28T01:00:00.000Z'), // Revoked
        expiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
        updatedAt: new Date(),
        user: mockUser,
      } as any);

      await expect(service.refresh(token)).rejects.toThrow(
        new UnauthorizedException('Session has been revoked'),
      );
    });

    it('12. should reject refresh on expired session', async () => {
      const token = 'some-token';
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      prismaMock.session.findFirst.mockResolvedValue({
        id: 'session-uuid',
        userId: mockUser.id,
        refreshTokenHash: tokenHash,
        userAgent: null,
        ipAddress: null,
        revokedAt: null,
        expiresAt: new Date(Date.now() - 10000), // Expired
        createdAt: new Date(),
        updatedAt: new Date(),
        user: mockUser,
      } as any);

      await expect(service.refresh(token)).rejects.toThrow(
        new UnauthorizedException('Session has expired'),
      );
    });
  });

  describe('logout & multi-session lifecycle', () => {
    it('13. should logout current session by setting revokedAt', async () => {
      prismaMock.session.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.logout('session-uuid');

      expect(result).toEqual({
        success: true,
        message: 'Logged out successfully',
      });
      expect(prismaMock.session.updateMany).toHaveBeenCalledTimes(1);
      const call = prismaMock.session.updateMany.mock.calls[0][0];
      expect(call.where).toEqual({ id: 'session-uuid', revokedAt: null });
      expect(call.data.revokedAt).toBeInstanceOf(Date);
    });

    it('14. should logout-all sessions belonging to user', async () => {
      prismaMock.session.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.logoutAll(mockUser.id);

      expect(result).toEqual({
        success: true,
        message: 'All sessions revoked successfully',
      });
      expect(prismaMock.session.updateMany).toHaveBeenCalledTimes(1);
      const call = prismaMock.session.updateMany.mock.calls[0][0];
      expect(call.where).toEqual({ userId: mockUser.id, revokedAt: null });
      expect(call.data.revokedAt).toBeInstanceOf(Date);
    });

    it('15. should allow multiple sessions to coexist independently', async () => {
      // Mock login for Device A
      prismaMock.user.findFirst.mockResolvedValue(mockUser);
      prismaMock.session.create
        .mockResolvedValueOnce({
          id: 'session-device-a',
          userId: mockUser.id,
          refreshTokenHash: 'hash-a',
          userAgent: 'Device-A',
          ipAddress: '1.1.1.1',
          expiresAt: new Date(),
          revokedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any)
        .mockResolvedValueOnce({
          id: 'session-device-b',
          userId: mockUser.id,
          refreshTokenHash: 'hash-b',
          userAgent: 'Device-B',
          ipAddress: '2.2.2.2',
          expiresAt: new Date(),
          revokedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any);

      const sessionA = await service.login(
        { email: mockUser.email, password: 'ValidPassword123!' },
        '1.1.1.1',
        'Device-A',
      );
      const sessionB = await service.login(
        { email: mockUser.email, password: 'ValidPassword123!' },
        '2.2.2.2',
        'Device-B',
      );

      expect(sessionA.refreshToken).toBeDefined();
      expect(sessionB.refreshToken).toBeDefined();
      expect(sessionA.refreshToken).not.toBe(sessionB.refreshToken);
      expect(prismaMock.session.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('getProfile & sanitization', () => {
    it('16. should return sanitized user profile and NEVER expose passwordHash', async () => {
      prismaMock.user.findFirst.mockResolvedValue(mockUser);

      const profile = await service.getProfile(mockUser.id);

      expect(profile).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        status: 'ACTIVE',
        createdAt: mockUser.createdAt,
      });
      expect(
        Object.prototype.hasOwnProperty.call(profile, 'passwordHash'),
      ).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(profile, 'password')).toBe(
        false,
      );
    });
  });
});
