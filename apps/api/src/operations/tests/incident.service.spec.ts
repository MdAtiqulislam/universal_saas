import { Test, TestingModule } from '@nestjs/testing';
import { IncidentService } from '../incidents/incident.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import {
  IncidentSeverity,
  IncidentSource,
  IncidentStatus,
} from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('M38: Incident Management (INV-331, INV-332, INV-333, INV-334)', () => {
  let incidentService: IncidentService;
  let prismaMock: any;
  let auditMock: any;

  const mockOrgId = '00000000-0000-0000-0000-000000000001';
  const mockUserId = '11111111-1111-1111-1111-111111111111';

  beforeEach(async () => {
    prismaMock = {
      operationalIncident: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation((args) =>
          Promise.resolve({
            id: 'inc-uuid-1',
            ...args.data,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockImplementation((args) =>
          Promise.resolve({
            id: args.where.id,
            ...args.data,
          }),
        ),
      },
    };
    auditMock = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidentService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();

    incidentService = module.get<IncidentService>(IncidentService);
  });

  describe('Incident Creation & Unique Sequencing (INV-331)', () => {
    it('1. should create an incident with auto-assigned sequential incidentNumber', async () => {
      const result = await incidentService.createIncident(
        {
          title: 'Database connection pool exhausted',
          description:
            'Spike in active connections causing 504 gateway timeouts',
          severity: IncidentSeverity.SEV1,
          source: IncidentSource.ALERT,
          organizationId: mockOrgId,
        },
        mockUserId,
      );

      expect(result.incidentNumber).toBe('INC-000001');
      expect(result.status).toBe(IncidentStatus.OPEN);
      expect(auditMock.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'OPERATIONS_INCIDENT_CREATED',
          resource: 'OperationalIncident',
          actorUserId: mockUserId,
        }),
      );
    });
  });

  describe('Lifecycle State Transitions (INV-332)', () => {
    it('2. should allow acknowledging an OPEN incident', async () => {
      prismaMock.operationalIncident.findUnique.mockResolvedValueOnce({
        id: 'inc-1',
        status: IncidentStatus.OPEN,
        organizationId: mockOrgId,
      });

      const updated = await incidentService.acknowledgeIncident(
        'inc-1',
        mockUserId,
      );
      expect(updated.status).toBe(IncidentStatus.ACKNOWLEDGED);
      expect(updated.acknowledgedAt).toBeDefined();
    });

    it('3. should reject acknowledging an already ACKNOWLEDGED or RESOLVED incident (INV-332)', async () => {
      prismaMock.operationalIncident.findUnique.mockResolvedValueOnce({
        id: 'inc-1',
        status: IncidentStatus.RESOLVED,
        organizationId: mockOrgId,
      });

      await expect(
        incidentService.acknowledgeIncident('inc-1', mockUserId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Resolution & Closure Requirements (INV-333, INV-334)', () => {
    it('4. should require resolvedAt when resolving an incident (INV-333)', async () => {
      prismaMock.operationalIncident.findUnique.mockResolvedValueOnce({
        id: 'inc-1',
        status: IncidentStatus.ACKNOWLEDGED,
        organizationId: mockOrgId,
      });

      const resolved = await incidentService.resolveIncident(
        'inc-1',
        {
          resolution: 'Increased connection pool max size to 50',
          rootCause: 'Connection leak in legacy reporting query',
        },
        mockUserId,
      );

      expect(resolved.status).toBe(IncidentStatus.RESOLVED);
      expect(resolved.resolvedAt).toBeDefined();
      expect(resolved.resolution).toBe(
        'Increased connection pool max size to 50',
      );
    });

    it('5. should enforce that CLOSED status is terminal and immutable (INV-334)', async () => {
      prismaMock.operationalIncident.findUnique.mockResolvedValueOnce({
        id: 'inc-1',
        status: IncidentStatus.CLOSED,
        organizationId: mockOrgId,
      });

      const closed = await incidentService.closeIncident('inc-1', mockUserId);
      expect(closed.status).toBe(IncidentStatus.CLOSED);
      expect(prismaMock.operationalIncident.update).not.toHaveBeenCalled();
    });
  });
});
