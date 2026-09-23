import { Test, TestingModule } from '@nestjs/testing';
import { EventBusService } from '../events/event-bus.service';
import { AuditService } from './audit.service';
import {
  AuditSanitizerService,
  REDACTED_VALUE,
} from './audit-sanitizer.service';
import { AuditEventListener } from './audit-event.listener';
import { AuditQueryService } from './audit-query.service';
import { PrismaService } from '../prisma/prisma.service';

describe('Audit Logging & Event Bus Integration', () => {
  let eventBus: EventBusService;
  let listener: AuditEventListener;
  let queryService: AuditQueryService;
  let prismaMock: any;

  const orgA = 'org-alpha-uuid-1111';
  const orgB = 'org-beta-uuid-2222';
  const userAdmin = 'admin-user-uuid';

  beforeEach(async () => {
    prismaMock = {
      auditLog: {
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 'audit-gen-id',
          ...data,
        })),
        count: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventBusService,
        AuditSanitizerService,
        AuditService,
        AuditEventListener,
        AuditQueryService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    eventBus = module.get<EventBusService>(EventBusService);
    listener = module.get<AuditEventListener>(AuditEventListener);
    queryService = module.get<AuditQueryService>(AuditQueryService);

    // Initialize listener subscription
    listener.onModuleInit();
  });

  it('1. should handle complete flow from EventBus to Prisma persistence with sanitization', async () => {
    // Publish domain event
    await eventBus.publish({
      eventName: 'ROLE_CREATED',
      occurredAt: new Date('2026-08-28T12:00:00Z'),
      organizationId: orgA,
      actorUserId: userAdmin,
      action: 'role.create',
      resource: 'role',
      resourceId: 'role-1',
      details: {
        name: 'WAREHOUSE_LEAD',
        apiKey: 'api_key_live_secret',
        nested: {
          passwordHash: '$argon2id$...',
          publicField: 'visible',
        },
      },
    });

    expect(prismaMock.auditLog.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: {
        organizationId: orgA,
        actorUserId: userAdmin,
        action: 'role.create',
        resource: 'role',
        resourceId: 'role-1',
        details: {
          name: 'WAREHOUSE_LEAD',
          apiKey: REDACTED_VALUE,
          nested: {
            passwordHash: REDACTED_VALUE,
            publicField: 'visible',
          },
        },
        ipAddress: null,
        userAgent: null,
        createdAt: new Date('2026-08-28T12:00:00Z'),
      },
    });
  });

  it('2. should maintain strict cross-tenant audit isolation when querying', async () => {
    // Query Org B
    prismaMock.auditLog.count.mockResolvedValue(0);
    prismaMock.auditLog.findMany.mockResolvedValue([]);

    const resultOrgB = await queryService.list(orgB, { page: 1, limit: 50 });

    expect(resultOrgB.items).toEqual([]);
    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: orgB,
        }),
      }),
    );
  });
});
