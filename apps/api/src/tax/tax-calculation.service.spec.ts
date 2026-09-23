import { Test, TestingModule } from '@nestjs/testing';
import { TaxCalculationService } from './tax-calculation.service';
import { TaxCodesService } from './tax-codes.service';
import { TaxRatesService } from './tax-rates.service';
import { TaxRulesService } from './tax-rules.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { Prisma, TaxRuleTransactionType } from '@prisma/client';

describe('TaxCalculationService', () => {
  let service: TaxCalculationService;
  let prismaMock: any;
  let codesMock: any;
  let ratesMock: any;
  let rulesMock: any;
  let eventBusMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';

  beforeEach(async () => {
    prismaMock = {
      item: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'item-1', categoryId: 'cat-1' }]),
      },
      taxCode: {
        findFirst: jest.fn(),
      },
    };

    eventBusMock = { publish: jest.fn().mockResolvedValue(undefined) };
    codesMock = {};
    ratesMock = { findEffectiveRate: jest.fn() };
    rulesMock = { findMatchingRule: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaxCalculationService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
        { provide: TaxCodesService, useValue: codesMock },
        { provide: TaxRatesService, useValue: ratesMock },
        { provide: TaxRulesService, useValue: rulesMock },
      ],
    }).compile();

    service = module.get<TaxCalculationService>(TaxCalculationService);
  });

  it('1. should calculate exclusive tax accurately with exact Decimal precision (10 x 100 @ 15% = 150 tax, 1150 total)', async () => {
    prismaMock.taxCode.findFirst.mockResolvedValue({
      id: 'code-std',
      code: 'STANDARD_VAT',
    });

    ratesMock.findEffectiveRate.mockResolvedValue({
      rate: new Prisma.Decimal('0.1500'),
      isInclusive: false,
    });

    const result = await service.calculate(mockOrgId, {
      transactionDate: '2026-08-28',
      transactionType: TaxRuleTransactionType.SALES,
      lines: [
        {
          itemId: 'item-1',
          quantity: 10,
          unitPrice: 100,
          discount: 0,
        },
      ],
    });

    expect(result.subtotal.toString()).toBe('1000');
    expect(result.taxableTotal.toString()).toBe('1000');
    expect(result.taxTotal.toString()).toBe('150');
    expect(result.grandTotal.toString()).toBe('1150');

    const line = result.lines[0];
    expect(line.taxRate.toString()).toBe('0.15');
    expect(line.taxAmount.toString()).toBe('150');
    expect(line.lineTotal.toString()).toBe('1150');
  });

  it('2. should calculate inclusive tax accurately (Line 1150 @ 15% inclusive = 1000 taxable, 150 tax, 1150 total)', async () => {
    prismaMock.taxCode.findFirst.mockResolvedValue({
      id: 'code-std',
      code: 'STANDARD_VAT',
    });

    ratesMock.findEffectiveRate.mockResolvedValue({
      rate: new Prisma.Decimal('0.1500'),
      isInclusive: true,
    });

    const result = await service.calculate(mockOrgId, {
      transactionDate: '2026-08-28',
      transactionType: TaxRuleTransactionType.SALES,
      lines: [
        {
          itemId: 'item-1',
          quantity: 1,
          unitPrice: 1150,
          discount: 0,
        },
      ],
    });

    expect(result.taxableTotal.toString()).toBe('1000');
    expect(result.taxTotal.toString()).toBe('150');
    expect(result.grandTotal.toString()).toBe('1150');
    expect(result.lines[0].isInclusive).toBe(true);
  });

  it('3. should respect direct taxCodeOverride over rules and defaults', async () => {
    prismaMock.taxCode.findFirst.mockImplementation((args: any) => {
      if (
        args.where.OR?.[0]?.id === 'ZERO_RATED' ||
        args.where.OR?.[1]?.code === 'ZERO_RATED'
      ) {
        return Promise.resolve({
          id: 'code-zero',
          code: 'ZERO_RATED',
        });
      }
      return Promise.resolve(null);
    });

    ratesMock.findEffectiveRate.mockResolvedValue({
      rate: new Prisma.Decimal('0.0000'),
      isInclusive: false,
    });

    const result = await service.calculate(mockOrgId, {
      transactionDate: '2026-08-28',
      transactionType: TaxRuleTransactionType.SALES,
      lines: [
        {
          itemId: 'item-1',
          quantity: 5,
          unitPrice: 200,
          discount: 0,
          taxCodeOverride: 'ZERO_RATED',
        },
      ],
    });

    expect(result.taxableTotal.toString()).toBe('1000');
    expect(result.taxTotal.toString()).toBe('0');
    expect(result.grandTotal.toString()).toBe('1000');
    expect(result.lines[0].calculationSource).toBe('OVERRIDE');
  });
});
