import { Test, TestingModule } from '@nestjs/testing';
import { SecurityAuthHardeningService } from '../authentication/security-auth-hardening.service';
import { SecuritySessionsService } from '../sessions/security-sessions.service';
import { SecurityEventsService } from '../events/security-events.service';
import { SecurityPoliciesService } from '../policies/security-policies.service';
import { RateLimitingService } from '../rate-limiting/rate-limiting.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { AuditSanitizerService } from '../../audit/audit-sanitizer.service';
import {
  SecurityEventCategory,
  SecurityEventSeverity,
} from '../dto/security-events.dto';

describe('Milestone M37: Security, Compliance & Platform Hardening Services', () => {
  let authHardeningService: SecurityAuthHardeningService;
  let sessionsService: SecuritySessionsService;
  let eventsService: SecurityEventsService;
  let policiesService: SecurityPoliciesService;
  let rateLimitingService: RateLimitingService;
  let prisma: any;
  let eventBus: any;

  const mockOrgId = '00000000-0000-0000-0000-000000000001';
  const mockUserId = '11111111-1111-1111-1111-111111111111';

  beforeEach(async () => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      session: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
        count: jest.fn().mockResolvedValue(0),
      },
      organizationMember: {
        findMany: jest.fn().mockResolvedValue([{ userId: mockUserId }]),
      },
      loginAttempt: {
        create: jest.fn().mockResolvedValue({ id: 'att-1' }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      securityEvent: {
        create: jest.fn().mockResolvedValue({ id: 'sec-1' }),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      securityPolicy: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SecurityAuthHardeningService,
        SecuritySessionsService,
        SecurityEventsService,
        SecurityPoliciesService,
        RateLimitingService,
        AuditSanitizerService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
      ],
    }).compile();

    authHardeningService = module.get<SecurityAuthHardeningService>(
      SecurityAuthHardeningService,
    );
    sessionsService = module.get<SecuritySessionsService>(
      SecuritySessionsService,
    );
    eventsService = module.get<SecurityEventsService>(SecurityEventsService);
    policiesService = module.get<SecurityPoliciesService>(
      SecurityPoliciesService,
    );
    rateLimitingService = module.get<RateLimitingService>(RateLimitingService);
  });

  describe('1. Authentication Hardening & Lockout', () => {
    it('should detect when user account is currently locked out', async () => {
      const lockedUntil = new Date(Date.now() + 10 * 60 * 1000); // 10 mins in future
      prisma.user.findFirst.mockResolvedValue({
        id: mockUserId,
        email: 'user@example.com',
        lockedUntil,
      });

      const res =
        await authHardeningService.checkAccountLockout('user@example.com');
      expect(res.isLocked).toBe(true);
      expect(res.remainingMinutes).toBeGreaterThanOrEqual(9);
    });

    it('should increment failed attempts and trigger lockout when reaching 5 failures', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: mockUserId,
        email: 'user@example.com',
        failedLoginAttempts: 4, // Next will be 5 -> Lockout!
      });

      await authHardeningService.handleFailedLogin(
        'user@example.com',
        mockOrgId,
        '192.168.1.1',
        'Mozilla/5.0',
      );

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUserId },
          data: expect.objectContaining({
            failedLoginAttempts: 5,
            lockedUntil: expect.any(Date),
          }),
        }),
      );

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'ACCOUNT_LOCKED' }),
      );
    });

    it('should reset failed login counters upon successful authentication', async () => {
      await authHardeningService.handleSuccessfulLogin(
        mockUserId,
        'user@example.com',
        mockOrgId,
      );

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUserId },
          data: expect.objectContaining({
            failedLoginAttempts: 0,
            lockedUntil: null,
            lastLoginAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should allow admin to explicitly unlock a locked account', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: mockUserId,
        email: 'user@example.com',
        failedLoginAttempts: 5,
        lockedUntil: new Date(Date.now() + 60000),
      });

      const res = await authHardeningService.unlockAccount(
        mockOrgId,
        mockUserId,
        'admin-1',
      );

      expect(res.success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUserId },
          data: { failedLoginAttempts: 0, lockedUntil: null },
        }),
      );
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'ACCOUNT_UNLOCKED' }),
      );
    });
  });

  describe('2. Sessions & Global Logout Management', () => {
    it('should revoke a single active session and publish SESSION_REVOKED', async () => {
      prisma.session.findUnique.mockResolvedValue({
        id: 'sess-1',
        userId: mockUserId,
        revokedAt: null,
        user: { id: mockUserId, email: 'user@example.com' },
      });
      prisma.session.update.mockResolvedValue({
        id: 'sess-1',
        revokedAt: new Date(),
        revokedReason: 'Suspicious location',
      });

      const res = await sessionsService.revokeSession(
        mockOrgId,
        'sess-1',
        'Suspicious location',
        mockUserId,
      );

      expect(res.status).toBe('REVOKED');
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'SESSION_REVOKED' }),
      );
    });

    it('should revoke all active sessions for a user (Logout All Devices)', async () => {
      prisma.session.findMany.mockResolvedValue([
        { id: 'sess-1', userId: mockUserId },
        { id: 'sess-2', userId: mockUserId },
      ]);

      const res = await sessionsService.revokeAllUserSessions(
        mockOrgId,
        mockUserId,
        'Global logout',
        mockUserId,
      );

      expect(res.revokedCount).toBe(2);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'LOGOUT_ALL_DEVICES' }),
      );
    });
  });

  describe('3. Security Event Logging & Sanitization', () => {
    it('should log append-only security event and redact sensitive token keys', async () => {
      await eventsService.logEvent(mockOrgId, {
        category: SecurityEventCategory.AUTHENTICATION,
        eventType: 'LOGIN_FAILURE',
        severity: SecurityEventSeverity.HIGH,
        actorUserId: mockUserId,
        details: {
          username: 'admin',
          password: 'superSecretPassword123!',
          nested: { apiKey: 'key_live_9999' },
        },
      });

      expect(prisma.securityEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            category: 'AUTHENTICATION',
            eventType: 'LOGIN_FAILURE',
            details: {
              username: 'admin',
              password: '[REDACTED]',
              nested: { apiKey: '[REDACTED]' },
            },
          }),
        }),
      );
    });
  });

  describe('4. Rate Limiting Engine', () => {
    it('should track quota within window and reject requests exceeding limit', async () => {
      const key = 'tenant:1:api:test';
      const limit = 3;

      const r1 = await rateLimitingService.checkRateLimit(
        key,
        limit,
        60,
        mockOrgId,
      );
      const r2 = await rateLimitingService.checkRateLimit(
        key,
        limit,
        60,
        mockOrgId,
      );
      const r3 = await rateLimitingService.checkRateLimit(
        key,
        limit,
        60,
        mockOrgId,
      );
      const r4 = await rateLimitingService.checkRateLimit(
        key,
        limit,
        60,
        mockOrgId,
      );

      expect(r1.allowed).toBe(true);
      expect(r2.allowed).toBe(true);
      expect(r3.allowed).toBe(true);
      expect(r4.allowed).toBe(false); // 4 > 3 -> blocked!
      expect(r4.remaining).toBe(0);
    });
  });
});
