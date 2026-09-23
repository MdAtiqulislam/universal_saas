import { Test, TestingModule } from '@nestjs/testing';
import { ServiceCostingService } from '../costing/service-costing.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

describe('ServiceCostingService', () => {
  let service: ServiceCostingService;
  let prisma: any;

  const mockOrgId = 'org-1111-2222-3333-4444';
  const mockOrderId = 'order-1111-2222-3333-4444';

  beforeEach(async () => {
    prisma = {
      serviceOrder: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceCostingService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ServiceCostingService>(ServiceCostingService);
  });

  it('should accurately calculate parts, labor, warranty, and customer charges with exact Decimal arithmetic', async () => {
    prisma.serviceOrder.findFirst.mockResolvedValue({
      id: mockOrderId,
      organizationId: mockOrgId,
      otherCost: new Prisma.Decimal('25.0000'),
      partsRequirements: [
        {
          issuedQuantity: new Prisma.Decimal('3'),
          returnedQuantity: new Prisma.Decimal('1'),
          unitCost: new Prisma.Decimal('50.0000'),
          unitPrice: new Prisma.Decimal('90.0000'),
          warrantyCovered: false, // Net qty = 2, cost = 100, charge = 180
        },
        {
          issuedQuantity: new Prisma.Decimal('1'),
          returnedQuantity: new Prisma.Decimal('0'),
          unitCost: new Prisma.Decimal('40.0000'),
          unitPrice: new Prisma.Decimal('70.0000'),
          warrantyCovered: true, // Net qty = 1, cost = 40 (warranty), charge = 0
        },
      ],
      laborEntries: [
        {
          billableHours: new Prisma.Decimal('2'),
          actualHours: new Prisma.Decimal('2.5'),
          laborRate: new Prisma.Decimal('80.0000'),
          internalCostRate: new Prisma.Decimal('30.0000'),
          laborCost: new Prisma.Decimal('75.0000'),
          laborCharge: new Prisma.Decimal('160.0000'),
          warrantyCovered: false, // charge = 160, cost = 75
        },
        {
          billableHours: new Prisma.Decimal('1'),
          actualHours: new Prisma.Decimal('1'),
          laborRate: new Prisma.Decimal('80.0000'),
          internalCostRate: new Prisma.Decimal('30.0000'),
          laborCost: new Prisma.Decimal('30.0000'),
          laborCharge: new Prisma.Decimal('80.0000'),
          warrantyCovered: true, // cost = 30 (warranty), charge = 0
        },
      ],
    });

    const breakdown = await service.calculateCosting(mockOrgId, mockOrderId);

    // Total parts cost = 100 + 40 = 140
    expect(breakdown.partsCost.toString()).toBe('140');
    // Total labor cost = 75 + 30 = 105
    expect(breakdown.laborCost.toString()).toBe('105');
    // Total other cost = 25
    expect(breakdown.otherCost.toString()).toBe('25');
    // Total cost = 140 + 105 + 25 = 270
    expect(breakdown.totalCost.toString()).toBe('270');
    // Warranty cost = 40 (parts) + 30 (labor) = 70
    expect(breakdown.warrantyCost.toString()).toBe('70');
    // Customer charge = 180 (parts) + 160 (labor) = 340
    expect(breakdown.customerCharge.toString()).toBe('340');
    // Service margin = 340 - 270 = 70
    expect(breakdown.serviceMargin.toString()).toBe('70');
    // Margin % = (70 / 340) * 100 = 20.59%
    expect(breakdown.serviceMarginPercentage).toBe(20.59);
  });
});
