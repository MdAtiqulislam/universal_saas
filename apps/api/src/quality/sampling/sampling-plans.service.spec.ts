import { Test, TestingModule } from '@nestjs/testing';
import { SamplingPlansService } from './sampling-plans.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { Prisma, SamplingType } from '@prisma/client';

describe('SamplingPlansService', () => {
  let service: SamplingPlansService;
  let prisma: any;
  let eventBus: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';

  beforeEach(async () => {
    prisma = {
      samplingPlan: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SamplingPlansService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
      ],
    }).compile();

    service = module.get<SamplingPlansService>(SamplingPlansService);
  });

  describe('calculateSampleQuantity', () => {
    it('should return totalQuantity for FULL_100_PERCENT', () => {
      const total = new Prisma.Decimal('500');
      const result = service.calculateSampleQuantity(
        { samplingType: SamplingType.FULL_100_PERCENT },
        total,
      );
      expect(result).toEqual(total);
    });

    it('should return fixedSampleQuantity capped at totalQuantity for FIXED_QUANTITY', () => {
      const total = new Prisma.Decimal('50');
      const result = service.calculateSampleQuantity(
        {
          samplingType: SamplingType.FIXED_QUANTITY,
          fixedSampleQuantity: new Prisma.Decimal('10'),
        },
        total,
      );
      expect(result).toEqual(new Prisma.Decimal('10'));

      const smallTotal = new Prisma.Decimal('5');
      const resultSmall = service.calculateSampleQuantity(
        {
          samplingType: SamplingType.FIXED_QUANTITY,
          fixedSampleQuantity: new Prisma.Decimal('10'),
        },
        smallTotal,
      );
      expect(resultSmall).toEqual(new Prisma.Decimal('5'));
    });

    it('should calculate percentage sample quantity correctly', () => {
      const total = new Prisma.Decimal('200');
      const result = service.calculateSampleQuantity(
        {
          samplingType: SamplingType.PERCENTAGE_BASED,
          percentageRate: new Prisma.Decimal('10'),
        },
        total,
      );
      expect(result).toEqual(new Prisma.Decimal('20'));
    });

    it('should resolve lot size lookup ranges correctly', () => {
      const plan = {
        samplingType: SamplingType.LOT_SIZE_BASED,
        lotRangesJson: [
          { minLot: 1, maxLot: 100, sampleSize: 5 },
          { minLot: 101, maxLot: 500, sampleSize: 20 },
          { minLot: 501, maxLot: 1000, sampleSize: 50 },
        ],
      };

      const result1 = service.calculateSampleQuantity(
        plan,
        new Prisma.Decimal('50'),
      );
      expect(result1).toEqual(new Prisma.Decimal('5'));

      const result2 = service.calculateSampleQuantity(
        plan,
        new Prisma.Decimal('250'),
      );
      expect(result2).toEqual(new Prisma.Decimal('20'));
    });
  });

  describe('create', () => {
    it('should create a sampling plan and emit audit event', async () => {
      prisma.samplingPlan.findUnique.mockResolvedValue(null);
      prisma.samplingPlan.create.mockResolvedValue({
        id: 'sp-1',
        organizationId: mockOrgId,
        code: 'SP-10PCT',
        name: '10 Percent Sampling',
        samplingType: SamplingType.PERCENTAGE_BASED,
        percentageRate: new Prisma.Decimal('10'),
        isActive: true,
      });

      const result = await service.create(
        mockOrgId,
        {
          code: 'SP-10PCT',
          name: '10 Percent Sampling',
          samplingType: SamplingType.PERCENTAGE_BASED,
          percentageRate: 10,
        },
        'user-1',
      );

      expect(result.code).toBe('SP-10PCT');
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'SAMPLING_PLAN_CREATED',
          organizationId: mockOrgId,
        }),
      );
    });
  });
});
