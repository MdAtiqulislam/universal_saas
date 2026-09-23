import { Test, TestingModule } from '@nestjs/testing';
import { SupplierQualityService } from './supplier-quality.service';
import { PrismaService } from '../../prisma/prisma.service';
import { InspectionDecision, Prisma } from '@prisma/client';

describe('SupplierQualityService', () => {
  let service: SupplierQualityService;
  let prisma: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';

  beforeEach(async () => {
    prisma = {
      supplier: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      qualityInspectionLot: {
        findMany: jest.fn(),
      },
      nonConformance: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      purchaseReturn: {
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupplierQualityService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<SupplierQualityService>(SupplierQualityService);
  });

  it('should calculate supplier metrics and quality score', async () => {
    prisma.supplier.findMany.mockResolvedValue([
      { id: 'sup-1', code: 'SUP-01', name: 'Acme Steel' },
    ]);

    prisma.qualityInspectionLot.findMany.mockResolvedValue([
      {
        decision: InspectionDecision.ACCEPT,
        inspectedQuantity: new Prisma.Decimal(10),
        failedQuantity: new Prisma.Decimal(0),
      },
      {
        decision: InspectionDecision.REJECT,
        inspectedQuantity: new Prisma.Decimal(10),
        failedQuantity: new Prisma.Decimal(2),
      },
    ]);

    prisma.nonConformance.count.mockResolvedValue(1);
    prisma.purchaseReturn.count.mockResolvedValue(0);

    const summary = await service.getSupplierQualitySummary(mockOrgId);
    expect(summary.length).toBe(1);
    expect(summary[0].totalLots).toBe(2);
    expect(summary[0].acceptedLots).toBe(1);
    expect(summary[0].rejectedLots).toBe(1);
    expect(summary[0].lotRejectionRate).toBe(50);
  });
});
