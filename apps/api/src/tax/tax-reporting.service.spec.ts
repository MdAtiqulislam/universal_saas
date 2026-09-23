import { Test, TestingModule } from '@nestjs/testing';
import { TaxReportingService } from './tax-reporting.service';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

describe('TaxReportingService', () => {
  let service: TaxReportingService;
  let prismaMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';

  beforeEach(async () => {
    prismaMock = {
      taxTransaction: {
        aggregate: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      taxCode: { findMany: jest.fn() },
      taxJurisdiction: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaxReportingService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<TaxReportingService>(TaxReportingService);
  });

  it('1. should calculate executive summary report', async () => {
    prismaMock.taxTransaction.aggregate
      .mockResolvedValueOnce({
        _sum: {
          taxableAmount: new Prisma.Decimal(5000),
          taxAmount: new Prisma.Decimal(1000),
        },
      })
      .mockResolvedValueOnce({
        _sum: {
          taxableAmount: new Prisma.Decimal(3000),
          taxAmount: new Prisma.Decimal(600),
        },
      });

    const report = await service.getSummary(mockOrgId, {});

    expect(report.summary.totalTaxableSales.toString()).toBe('5000');
    expect(report.summary.totalOutputTax.toString()).toBe('1000');
    expect(report.summary.totalTaxablePurchases.toString()).toBe('3000');
    expect(report.summary.totalInputTax.toString()).toBe('600');
    expect(report.summary.netTaxPayable.toString()).toBe('400');
  });

  it('2. should generate breakdown by tax code', async () => {
    prismaMock.taxCode.findMany.mockResolvedValue([
      {
        id: 'code-1',
        code: 'STANDARD_VAT',
        name: 'Standard VAT 20%',
        taxType: 'VAT',
        taxTransactions: [
          {
            taxableAmount: new Prisma.Decimal(1000),
            taxAmount: new Prisma.Decimal(200),
          },
        ],
      },
    ]);

    const report = await service.getReportByTaxCode(mockOrgId, {});

    expect(report.breakdown.length).toBe(1);
    expect(report.breakdown[0].code).toBe('STANDARD_VAT');
    expect(report.breakdown[0].totalTaxAmount.toString()).toBe('200');
  });
});
