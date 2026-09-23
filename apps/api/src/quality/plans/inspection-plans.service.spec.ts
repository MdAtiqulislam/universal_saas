import { Test, TestingModule } from '@nestjs/testing';
import { InspectionPlansService } from './inspection-plans.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { InspectionType, CharacteristicDataType } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('InspectionPlansService', () => {
  let service: InspectionPlansService;
  let prisma: any;
  let eventBus: any;
  let numberingService: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';

  beforeEach(async () => {
    prisma = {
      item: { findFirst: jest.fn() },
      itemVariant: { findFirst: jest.fn() },
      samplingPlan: { findFirst: jest.fn() },
      inspectionPlan: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      inspectionCharacteristic: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    numberingService = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'QIP-000001' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InspectionPlansService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
        { provide: NumberingService, useValue: numberingService },
      ],
    }).compile();

    service = module.get<InspectionPlansService>(InspectionPlansService);
  });

  it('should create an inspection plan with characteristics and publish audit event', async () => {
    prisma.item.findFirst.mockResolvedValue({
      id: 'item-1',
      organizationId: mockOrgId,
    });
    prisma.inspectionPlan.findFirst.mockResolvedValue(null);
    prisma.inspectionPlan.create.mockResolvedValue({
      id: 'plan-1',
      organizationId: mockOrgId,
      planNumber: 'QIP-000001',
      name: 'Receiving Inspection Plan',
      version: 1,
      itemId: 'item-1',
      inspectionType: InspectionType.INCOMING_PURCHASE,
      isActive: true,
      isImmutable: false,
    });

    const result = await service.create(
      mockOrgId,
      {
        name: 'Receiving Inspection Plan',
        itemId: 'item-1',
        inspectionType: InspectionType.INCOMING_PURCHASE,
        characteristics: [
          {
            sequence: 1,
            code: 'DIM-01',
            name: 'Outer Diameter',
            dataType: CharacteristicDataType.NUMERIC_SPEC,
            targetValue: 10,
            minSpec: 9.8,
            maxSpec: 10.2,
            isMandatory: true,
          },
        ],
      },
      'user-1',
    );

    expect(result.planNumber).toBe('QIP-000001');
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'INSPECTION_PLAN_CREATED',
        organizationId: mockOrgId,
      }),
    );
  });

  it('should prevent mutating an immutable inspection plan', async () => {
    prisma.inspectionPlan.findFirst.mockResolvedValue({
      id: 'plan-1',
      organizationId: mockOrgId,
      isImmutable: true,
      _count: { inspectionLots: 5 },
    });

    await expect(
      service.update(mockOrgId, 'plan-1', { name: 'Updated' }, 'user-1'),
    ).rejects.toThrow(BadRequestException);
  });
});
