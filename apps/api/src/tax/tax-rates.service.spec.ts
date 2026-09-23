import { Test, TestingModule } from '@nestjs/testing';
import { TaxRatesService } from './tax-rates.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('TaxRatesService', () => {
  let service: TaxRatesService;
  let prismaMock: any;
  let eventBusMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';

  beforeEach(async () => {
    prismaMock = {
      taxCode: { findFirst: jest.fn() },
      effectiveTaxRate: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    eventBusMock = { publish: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaxRatesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
      ],
    }).compile();

    service = module.get<TaxRatesService>(TaxRatesService);
  });

  it('1. should create an effective-dated tax rate successfully', async () => {
    prismaMock.taxCode.findFirst.mockResolvedValue({
      id: 'code-1',
      organizationId: mockOrgId,
    });
    prismaMock.effectiveTaxRate.findMany.mockResolvedValue([]);
    prismaMock.effectiveTaxRate.create.mockImplementation((args: any) => ({
      id: 'rate-1',
      ...args.data,
    }));

    const result = await service.create(mockOrgId, {
      taxCodeId: 'code-1',
      rate: 0.2,
      effectiveFrom: '2026-01-01',
      effectiveTo: '2026-12-31',
      isInclusive: false,
    });

    expect(result.id).toBe('rate-1');
    expect(result.rate.toString()).toBe('0.2');
  });

  it('2. should reject overlapping effective rate date ranges for the same tax code', async () => {
    prismaMock.taxCode.findFirst.mockResolvedValue({
      id: 'code-1',
      organizationId: mockOrgId,
    });
    prismaMock.effectiveTaxRate.findMany.mockResolvedValue([
      {
        id: 'rate-existing',
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: new Date('2026-12-31'),
      },
    ]);

    await expect(
      service.create(mockOrgId, {
        taxCodeId: 'code-1',
        rate: 0.22,
        effectiveFrom: '2026-06-01',
        effectiveTo: '2027-05-31',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('3. should resolve effective rate active on a transaction date', async () => {
    prismaMock.effectiveTaxRate.findFirst.mockResolvedValue({
      id: 'rate-2026',
      rate: new Prisma.Decimal('0.2000'),
      effectiveFrom: new Date('2026-01-01'),
      effectiveTo: new Date('2026-12-31'),
    });

    const result = await service.findEffectiveRate(
      mockOrgId,
      'code-1',
      new Date('2026-08-28'),
    );

    expect(result).toBeDefined();
    expect(result?.rate.toString()).toBe('0.2');
  });
});
