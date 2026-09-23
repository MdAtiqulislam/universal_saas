import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User, Session } from '@prisma/client';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

interface MockRequest {
  headers: Record<string, string | undefined>;
  user?: { id: string; sessionId: string };
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let jwtServiceMock: {
    verifyAsync: jest.Mock<Promise<unknown>, [string]>;
  };
  let prismaMock: {
    user: {
      findFirst: jest.Mock<Promise<User | null>, [unknown]>;
    };
    session: {
      findFirst: jest.Mock<Promise<Session | null>, [unknown]>;
    };
  };

  const mockUser: User = {
    id: 'user-uuid',
    email: 'user@example.com',
    passwordHash: 'hash',
    status: 'ACTIVE',
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    passwordChangedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockSession: Session = {
    id: 'session-uuid',
    userId: 'user-uuid',
    refreshTokenHash: 'hash',
    userAgent: null,
    ipAddress: null,
    deviceInfo: null,
    revokedAt: null,
    revokedReason: null,
    lastActivityAt: new Date(),
    expiresAt: new Date(Date.now() + 3600000),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const createMockContext = (
    authHeader?: string,
  ): { context: ExecutionContext; req: MockRequest } => {
    const req: MockRequest = {
      headers: authHeader ? { authorization: authHeader } : {},
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => req as unknown as AuthenticatedRequest,
      }),
    } as unknown as ExecutionContext;

    return { context, req };
  };

  beforeEach(async () => {
    jwtServiceMock = {
      verifyAsync: jest.fn<Promise<unknown>, [string]>(),
    };

    prismaMock = {
      user: {
        findFirst: jest.fn<Promise<User | null>, [unknown]>(),
      },
      session: {
        findFirst: jest.fn<Promise<Session | null>, [unknown]>(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        { provide: JwtService, useValue: jwtServiceMock },
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
  });

  it('1. should reject when Authorization header is missing', async () => {
    const { context } = createMockContext();

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Authentication token required'),
    );
  });

  it('2. should reject when token signature is invalid', async () => {
    const { context } = createMockContext('Bearer invalid.token.string');
    jwtServiceMock.verifyAsync.mockRejectedValue(
      new Error('invalid signature'),
    );

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Invalid or expired authentication token'),
    );
  });

  it('3. should reject when token is expired', async () => {
    const { context } = createMockContext('Bearer expired.jwt.token');
    jwtServiceMock.verifyAsync.mockRejectedValue(new Error('jwt expired'));

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Invalid or expired authentication token'),
    );
  });

  it('4. should reject when sub claim is missing', async () => {
    const { context } = createMockContext('Bearer valid.token');
    jwtServiceMock.verifyAsync.mockResolvedValue({ sid: 'session-uuid' }); // missing sub

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Malformed authentication token claims'),
    );
  });

  it('5. should reject when sid claim is missing', async () => {
    const { context } = createMockContext('Bearer valid.token');
    jwtServiceMock.verifyAsync.mockResolvedValue({ sub: 'user-uuid' }); // missing sid

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Malformed authentication token claims'),
    );
  });

  it('6. should reject when user does not exist in database', async () => {
    const { context } = createMockContext('Bearer valid.token');
    jwtServiceMock.verifyAsync.mockResolvedValue({
      sub: 'unknown-user',
      sid: 'session-uuid',
    });
    prismaMock.user.findFirst.mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('User not found or has been deleted'),
    );
  });

  it('7. should reject when user is suspended or inactive', async () => {
    const { context } = createMockContext('Bearer valid.token');
    jwtServiceMock.verifyAsync.mockResolvedValue({
      sub: 'user-uuid',
      sid: 'session-uuid',
    });
    prismaMock.user.findFirst.mockResolvedValue({
      ...mockUser,
      status: 'SUSPENDED',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('User account is inactive or suspended'),
    );
  });

  it('8. should reject when user is soft-deleted', async () => {
    const { context } = createMockContext('Bearer valid.token');
    jwtServiceMock.verifyAsync.mockResolvedValue({
      sub: 'user-uuid',
      sid: 'session-uuid',
    });
    prismaMock.user.findFirst.mockResolvedValue(null); // Filtered by deletedAt: null

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('User not found or has been deleted'),
    );
  });

  it('9. should reject when session is revoked', async () => {
    const { context } = createMockContext('Bearer valid.token');
    jwtServiceMock.verifyAsync.mockResolvedValue({
      sub: 'user-uuid',
      sid: 'session-uuid',
    });
    prismaMock.user.findFirst.mockResolvedValue(mockUser);
    prismaMock.session.findFirst.mockResolvedValue({
      ...mockSession,
      revokedAt: new Date('2026-08-28T00:00:00.000Z'),
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Session has been revoked or does not exist'),
    );
  });

  it('10. should reject when session is expired', async () => {
    const { context } = createMockContext('Bearer valid.token');
    jwtServiceMock.verifyAsync.mockResolvedValue({
      sub: 'user-uuid',
      sid: 'session-uuid',
    });
    prismaMock.user.findFirst.mockResolvedValue(mockUser);
    prismaMock.session.findFirst.mockResolvedValue({
      ...mockSession,
      expiresAt: new Date(Date.now() - 5000), // Expired in past
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Session has expired'),
    );
  });

  it('11. should allow request and attach user and sessionId when token and session are valid', async () => {
    const { context, req } = createMockContext('Bearer valid.token');
    jwtServiceMock.verifyAsync.mockResolvedValue({
      sub: 'user-uuid',
      sid: 'session-uuid',
    });
    prismaMock.user.findFirst.mockResolvedValue(mockUser);
    prismaMock.session.findFirst.mockResolvedValue(mockSession);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(req.user).toEqual({
      id: 'user-uuid',
      sessionId: 'session-uuid',
    });
  });
});
