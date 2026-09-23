import { Test, TestingModule } from '@nestjs/testing';
import { TaxCalculationService } from './tax-calculation.service';
import { TaxCodesService } from './tax-codes.service';
import { TaxRatesService } from './tax-rates.service';
import { TaxRulesService } from './tax-rules.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { Prisma, TaxRuleTransactionType } from '@prisma/client';

describe('Tax Calculation Concurrency (100 Parallel Requests)', () => {
  let service: TaxCalculationService;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';

  beforeEach(async () => {
    const prismaMock: any = {
      item: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'item-concurrent', categoryId: 'cat-concurrent' },
          ]),
      },
      taxCode: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'code-concurrent',
          code: 'VAT_20',
        }),
      },
    };

    const ratesMock = {
      findEffectiveRate: jest.fn().mockResolvedValue({
        rate: new Prisma.Decimal('0.2000'),
        isInclusive: false,
      }),
    };

    const rulesMock = { findMatchingRule: jest.fn().mockResolvedValue(null) };
    const eventBusMock = { publish: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaxCalculationService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
        { provide: TaxCodesService, useValue: {} },
        { provide: TaxRatesService, useValue: ratesMock },
        { provide: TaxRulesService, useValue: rulesMock },
      ],
    }).compile();

    service = module.get<TaxCalculationService>(TaxCalculationService);
  });

  it('should process 100 concurrent parallel tax calculations with exact deterministic output', async () => {
    const tasks = Array.from({ length: 100 }, (_, i) =>
      service.calculate(mockOrgId, {
        transactionDate: '2026-08-28',
        transactionType: TaxRuleTransactionType.SALES,
        lines: [
          {
            itemId: 'item-concurrent',
            quantity: 10,
            unitPrice: 100 + i,
            discount: 0,
          },
        ],
      }),
    );

    const results = await Promise.all(tasks);
    expect(results.length).toBe(100);

    // Verify first result: 10 * 100 = 1000, 20% tax = 200, grand = 1200
    expect(results[0].subtotal.toString()).toBe('1000');
    expect(results[0].taxTotal.toString()).toBe('200');
    expect(results[0].grandTotal.toString()).toBe('1200');

    // Verify 100th result: 10 * 199 = 1990, 20% tax = 398, grand = 2388
    expect(results[99].subtotal.toString()).toBe('1990');
    expect(results[99].taxTotal.toString()).toBe('398');
    expect(results[99].grandTotal.toString()).toBe('2388');
  });
});
