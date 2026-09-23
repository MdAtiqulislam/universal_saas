import { Test, TestingModule } from '@nestjs/testing';
import { QualityReportsService } from './quality-reports.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  InspectionDecision,
  InspectionLotStatus,
  Prisma,
} from '@prisma/client';

describe('QualityReportsService', () => {
  let service: QualityReportsService;
  let prisma: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';

  beforeEach(async () => {
    prisma = {
      qualityInspectionLot: {
        findMany: jest.fn(),
      },
      qualityHold: {
        findMany: jest.fn(),
      },
      nonConformance: {
        findMany: jest.fn(),
      },
      cAPA: {
        findMany: jest.fn(),
      },
      customerQualityIssue: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QualityReportsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<QualityReportsService>(QualityReportsService);
  });

  it('should compile inspection summary correctly', async () => {
    prisma.qualityInspectionLot.findMany.mockResolvedValue([
      {
        status: InspectionLotStatus.DECIDED,
        decision: InspectionDecision.ACCEPT,
        sampleQuantity: new Prisma.Decimal(10),
        inspectedQuantity: new Prisma.Decimal(10),
        passedQuantity: new Prisma.Decimal(10),
        failedQuantity: new Prisma.Decimal(0),
      },
      {
        status: InspectionLotStatus.DECIDED,
        decision: InspectionDecision.REJECT,
        sampleQuantity: new Prisma.Decimal(10),
        inspectedQuantity: new Prisma.Decimal(10),
        passedQuantity: new Prisma.Decimal(8),
        failedQuantity: new Prisma.Decimal(2),
      },
    ]);

    const summary = await service.getInspectionSummary(mockOrgId);
    expect(summary.totalLots).toBe(2);
    expect(summary.acceptedLots).toBe(1);
    expect(summary.rejectedLots).toBe(1);
    expect(summary.overallPassRate).toBe(90);
  });
});
