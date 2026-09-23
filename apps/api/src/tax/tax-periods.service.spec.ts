import { Test, TestingModule } from '@nestjs/testing';
import { TaxPeriodsService } from './tax-periods.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { BadRequestException } from '@nestjs/common';
import { TaxPeriodStatus, Prisma } from '@prisma/client';

describe('TaxPeriodsService', () => {
  let service: TaxPeriodsService;
  let prismaMock: any;
  let eventBusMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockUserId = '22222222-2222-2222-2222-222222222222';

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn((cb) => cb(prismaMock)),
      taxPeriod: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      taxTransaction: {
        aggregate: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    eventBusMock = { publish: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaxPeriodsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
      ],
    }).compile();

    service = module.get<TaxPeriodsService>(TaxPeriodsService);
  });

  it('1. should create and prepare a tax period calculating net payable (Output $500 - Input $300 = $200)', async () => {
    prismaMock.taxPeriod.findFirst.mockResolvedValue({
      id: 'period-1',
      organizationId: mockOrgId,
      name: '2026-07',
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-07-31'),
      status: TaxPeriodStatus.OPEN,
    });

    // Output aggregation: taxable $2500, tax $500
    // Input aggregation: taxable $1500, tax $300
    prismaMock.taxTransaction.aggregate
      .mockResolvedValueOnce({
        _sum: {
          taxableAmount: new Prisma.Decimal(2500),
          taxAmount: new Prisma.Decimal(500),
        },
      })
      .mockResolvedValueOnce({
        _sum: {
          taxableAmount: new Prisma.Decimal(1500),
          taxAmount: new Prisma.Decimal(300),
        },
      });

    prismaMock.taxTransaction.updateMany.mockResolvedValue({ count: 10 });
    prismaMock.taxPeriod.update.mockImplementation((args: any) => ({
      id: 'period-1',
      ...args.data,
    }));

    const result = await service.prepare(mockOrgId, 'period-1', mockUserId);

    expect(result.status).toBe(TaxPeriodStatus.PREPARED);
    expect(result.totalOutputTax.toString()).toBe('500');
    expect(result.totalInputTax.toString()).toBe('300');
    expect(result.netTaxPayable.toString()).toBe('200');
  });

  it('2. should lock tax period and prevent preparing an already locked period', async () => {
    prismaMock.taxPeriod.findFirst.mockResolvedValue({
      id: 'period-locked',
      organizationId: mockOrgId,
      name: '2026-07',
      status: TaxPeriodStatus.LOCKED,
    });

    await expect(
      service.prepare(mockOrgId, 'period-locked', mockUserId),
    ).rejects.toThrow(BadRequestException);
  });
});
