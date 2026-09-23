import { Test, TestingModule } from '@nestjs/testing';
import { NonConformanceService } from './non-conformance.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import {
  NonConformanceStatus,
  NonConformanceSeverity,
  Prisma,
} from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('NonConformanceService', () => {
  let service: NonConformanceService;
  let prisma: any;
  let eventBus: any;
  let numberingService: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';

  beforeEach(async () => {
    prisma = {
      item: { findFirst: jest.fn() },
      nonConformance: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      cAPA: {
        findMany: jest.fn(),
      },
    };

    eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    numberingService = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'NCR-000001' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NonConformanceService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
        { provide: NumberingService, useValue: numberingService },
      ],
    }).compile();

    service = module.get<NonConformanceService>(NonConformanceService);
  });

  it('should create an NCR and publish audit event', async () => {
    prisma.item.findFirst.mockResolvedValue({
      id: 'item-1',
      organizationId: mockOrgId,
    });
    prisma.nonConformance.create.mockResolvedValue({
      id: 'ncr-1',
      organizationId: mockOrgId,
      ncrNumber: 'NCR-000001',
      title: 'Material out of specification',
      quantityAffected: new Prisma.Decimal(25),
      severity: NonConformanceSeverity.HIGH,
      status: NonConformanceStatus.OPEN,
    });

    const result = await service.create(
      mockOrgId,
      {
        title: 'Material out of specification',
        description: 'Diameter exceeded tolerance',
        itemId: 'item-1',
        quantityAffected: 25,
        severity: NonConformanceSeverity.HIGH,
      },
      'user-1',
    );

    expect(result.ncrNumber).toBe('NCR-000001');
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'NCR_CREATED',
        organizationId: mockOrgId,
      }),
    );
  });

  it('should prevent closing NCR when active CAPAs exist', async () => {
    prisma.nonConformance.findFirst.mockResolvedValue({
      id: 'ncr-1',
      organizationId: mockOrgId,
      ncrNumber: 'NCR-000001',
      status: NonConformanceStatus.DISPOSITIONED,
    });
    prisma.cAPA.findMany.mockResolvedValue([
      { id: 'capa-1', status: 'IN_PROGRESS' },
    ]);

    await expect(
      service.close(mockOrgId, 'ncr-1', {}, 'user-1'),
    ).rejects.toThrow(BadRequestException);
  });
});
