import { Test, TestingModule } from '@nestjs/testing';
import { InspectionLotsService } from './inspection-lots.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { SamplingPlansService } from '../sampling/sampling-plans.service';
import { InspectionDecisionService } from './inspection-decision.service';
import {
  InspectionType,
  InspectionLotStatus,
  InspectionDecision,
  Prisma,
} from '@prisma/client';

describe('InspectionLotsService', () => {
  let service: InspectionLotsService;
  let prisma: any;
  let eventBus: any;
  let numberingService: any;
  let samplingService: any;
  let decisionService: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';

  beforeEach(async () => {
    prisma = {
      item: { findFirst: jest.fn() },
      location: { findFirst: jest.fn() },
      inspectionPlan: { findFirst: jest.fn(), update: jest.fn() },
      qualityInspectionLot: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      inspectionResult: {
        upsert: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      qualityHold: { create: jest.fn() },
      nonConformance: { create: jest.fn() },
      qualityConfiguration: { findUnique: jest.fn() },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    numberingService = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'QIL-000001' }),
    };
    samplingService = {
      calculateSampleQuantity: jest
        .fn()
        .mockReturnValue(new Prisma.Decimal(10)),
    };
    decisionService = {
      evaluateResults: jest.fn().mockReturnValue({
        canAccept: true,
        hasFailures: false,
        missingMandatoryCount: 0,
      }),
      validateDecision: jest.fn(),
      getSuggestedNcrSeverity: jest.fn().mockReturnValue('HIGH'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InspectionLotsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
        { provide: NumberingService, useValue: numberingService },
        { provide: SamplingPlansService, useValue: samplingService },
        { provide: InspectionDecisionService, useValue: decisionService },
      ],
    }).compile();

    service = module.get<InspectionLotsService>(InspectionLotsService);
  });

  it('should create an inspection lot with sample size calculation', async () => {
    prisma.item.findFirst.mockResolvedValue({
      id: 'item-1',
      organizationId: mockOrgId,
    });
    prisma.location.findFirst.mockResolvedValue({
      id: 'loc-1',
      organizationId: mockOrgId,
    });
    prisma.inspectionPlan.findFirst.mockResolvedValue({
      id: 'plan-1',
      samplingPlan: {
        samplingType: 'PERCENTAGE_BASED',
        percentageRate: new Prisma.Decimal(10),
      },
      isImmutable: false,
    });
    prisma.qualityInspectionLot.create.mockResolvedValue({
      id: 'lot-1',
      organizationId: mockOrgId,
      lotNumber: 'QIL-000001',
      totalQuantity: new Prisma.Decimal(100),
      sampleQuantity: new Prisma.Decimal(10),
      inspectionType: InspectionType.INCOMING_PURCHASE,
      status: InspectionLotStatus.PENDING,
    });

    const result = await service.create(
      mockOrgId,
      {
        itemId: 'item-1',
        warehouseId: 'wh-1',
        locationId: 'loc-1',
        inspectionType: InspectionType.INCOMING_PURCHASE,
        totalQuantity: 100,
      },
      'user-1',
    );

    expect(result.lotNumber).toBe('QIL-000001');
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'INSPECTION_LOT_CREATED',
        organizationId: mockOrgId,
      }),
    );
  });

  it('should decide inspection lot as ACCEPT and mark immutable', async () => {
    const mockLot = {
      id: 'lot-1',
      organizationId: mockOrgId,
      lotNumber: 'QIL-000001',
      sampleQuantity: new Prisma.Decimal(5),
      totalQuantity: new Prisma.Decimal(50),
      status: InspectionLotStatus.COMPLETED,
      isImmutable: false,
      inspectionPlan: { characteristics: [] },
      results: [],
    };
    prisma.qualityInspectionLot.findFirst.mockResolvedValue(mockLot);
    prisma.qualityInspectionLot.update.mockResolvedValue({
      ...mockLot,
      status: InspectionLotStatus.DECIDED,
      decision: InspectionDecision.ACCEPT,
      isImmutable: true,
    });

    const result = await service.decide(
      mockOrgId,
      'lot-1',
      { decision: InspectionDecision.ACCEPT },
      'user-1',
    );

    expect(result.status).toBe(InspectionLotStatus.DECIDED);
    expect(result.decision).toBe(InspectionDecision.ACCEPT);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'INSPECTION_DECISION_MADE',
        organizationId: mockOrgId,
      }),
    );
  });
});
