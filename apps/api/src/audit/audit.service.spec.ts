import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import {
  AuditSanitizerService,
  REDACTED_VALUE,
} from './audit-sanitizer.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuditService', () => {
  let service: AuditService;
  let prismaMock: any;

  const mockOrgId = 'org-1111-1111';
  const mockActorId = 'user-2222-2222';

  beforeEach(async () => {
    prismaMock = {
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        AuditSanitizerService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  it('1. should persist sanitized audit log record into database', async () => {
    const occurredAt = new Date();
    await service.record({
      eventName: 'ROLE_CREATED',
      occurredAt,
      organizationId: mockOrgId,
      actorUserId: mockActorId,
      action: 'role.create',
      resource: 'role',
      resourceId: 'role-123',
      details: {
        name: 'ACCOUNTANT',
        password: 'sensitive_password',
      },
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
    });

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: {
        organizationId: mockOrgId,
        actorUserId: mockActorId,
        action: 'role.create',
        resource: 'role',
        resourceId: 'role-123',
        details: {
          name: 'ACCOUNTANT',
          password: REDACTED_VALUE,
        },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        createdAt: occurredAt,
      },
    });
  });

  it('2. should support system-initiated audit events with actorUserId = null', async () => {
    await service.record({
      eventName: 'SYSTEM_MAINTENANCE',
      occurredAt: new Date(),
      organizationId: mockOrgId,
      actorUserId: null,
      action: 'system.cleanup',
      resource: 'organization',
      resourceId: mockOrgId,
      details: { note: 'automated' },
    });

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorUserId: null,
          action: 'system.cleanup',
        }),
      }),
    );
  });

  it('3. should skip recording if organizationId is missing', async () => {
    await service.record({
      eventName: 'GLOBAL_EVENT',
      occurredAt: new Date(),
      organizationId: '',
      action: 'global.event',
      resource: 'global',
    });

    expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
  });
});
