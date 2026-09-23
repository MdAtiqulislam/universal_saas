import { Test, TestingModule } from '@nestjs/testing';
import { InspectionLotsService } from '../inspections/inspection-lots.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { SamplingPlansService } from '../sampling/sampling-plans.service';
import { InspectionDecisionService } from '../inspections/inspection-decision.service';
import {
  InspectionLotStatus,
  InspectionDecision,
  Prisma,
} from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('Quality Concurrency & Immutability', () => {
  let service: InspectionLotsService;
  let prisma: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';

  beforeEach(async () => {
    prisma = {
      qualityInspectionLot: {
        findFirst: jest.fn(),
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InspectionLotsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: { publish: jest.fn() } },
        {
          provide: NumberingService,
          useValue: {
            nextNumber: jest.fn().mockResolvedValue({ formatted: 'QHD-001' }),
          },
        },
        { provide: SamplingPlansService, useValue: {} },
        {
          provide: InspectionDecisionService,
          useValue: {
            evaluateResults: jest.fn().mockReturnValue({
              canAccept: true,
              hasFailures: false,
              missingMandatoryCount: 0,
            }),
            validateDecision: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<InspectionLotsService>(InspectionLotsService);
  });

  it('Concurrent decision calls on already decided lot fail with BadRequestException', async () => {
    const decidedLot = {
      id: 'lot-1',
      organizationId: mockOrgId,
      status: InspectionLotStatus.DECIDED,
      isImmutable: true,
      decision: InspectionDecision.ACCEPT,
      sampleQuantity: new Prisma.Decimal(5),
      totalQuantity: new Prisma.Decimal(50),
      results: [],
    };

    prisma.qualityInspectionLot.findFirst.mockResolvedValue(decidedLot);

    await expect(
      service.decide(
        mockOrgId,
        'lot-1',
        { decision: InspectionDecision.ACCEPT },
        'user-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('Concurrent result recording on finalized lot fails with BadRequestException', async () => {
    const finalizedLot = {
      id: 'lot-1',
      organizationId: mockOrgId,
      status: InspectionLotStatus.DECIDED,
      isImmutable: true,
      results: [],
    };

    prisma.qualityInspectionLot.findFirst.mockResolvedValue(finalizedLot);

    await expect(
      service.recordResults(
        mockOrgId,
        'lot-1',
        {
          results: [
            {
              characteristicId: 'char-1',
              sampleNumber: 1,
              isPass: true,
            },
          ],
        },
        'user-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
