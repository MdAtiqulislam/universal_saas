import { Test, TestingModule } from '@nestjs/testing';
import { QualityHoldsService } from './quality-holds.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { QualityHoldStatus, Prisma } from '@prisma/client';

describe('QualityHoldsService', () => {
  let service: QualityHoldsService;
  let prisma: any;
  let eventBus: any;
  let numberingService: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';

  beforeEach(async () => {
    prisma = {
      item: { findFirst: jest.fn() },
      location: { findFirst: jest.fn() },
      qualityHold: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    numberingService = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'QHD-000001' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QualityHoldsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
        { provide: NumberingService, useValue: numberingService },
      ],
    }).compile();

    service = module.get<QualityHoldsService>(QualityHoldsService);
  });

  it('should create quality hold correctly', async () => {
    prisma.item.findFirst.mockResolvedValue({
      id: 'item-1',
      organizationId: mockOrgId,
    });
    prisma.location.findFirst.mockResolvedValue({
      id: 'loc-1',
      organizationId: mockOrgId,
    });
    prisma.qualityHold.create.mockResolvedValue({
      id: 'hold-1',
      organizationId: mockOrgId,
      holdNumber: 'QHD-000001',
      holdQuantity: new Prisma.Decimal(50),
      status: QualityHoldStatus.ACTIVE,
      reason: 'Failed visual inspection',
    });

    const result = await service.create(
      mockOrgId,
      {
        itemId: 'item-1',
        warehouseId: 'wh-1',
        locationId: 'loc-1',
        holdQuantity: 50,
        reason: 'Failed visual inspection',
      },
      'user-1',
    );

    expect(result.holdNumber).toBe('QHD-000001');
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'QUALITY_HOLD_CREATED',
        organizationId: mockOrgId,
      }),
    );
  });

  it('should release quality hold correctly', async () => {
    prisma.qualityHold.findFirst.mockResolvedValue({
      id: 'hold-1',
      organizationId: mockOrgId,
      holdNumber: 'QHD-000001',
      status: QualityHoldStatus.ACTIVE,
    });
    prisma.qualityHold.update.mockResolvedValue({
      id: 'hold-1',
      organizationId: mockOrgId,
      holdNumber: 'QHD-000001',
      status: QualityHoldStatus.RELEASED,
    });

    const result = await service.release(
      mockOrgId,
      'hold-1',
      { releaseNotes: 'Re-inspection passed' },
      'user-1',
    );

    expect(result.status).toBe(QualityHoldStatus.RELEASED);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'QUALITY_HOLD_RELEASED',
        organizationId: mockOrgId,
      }),
    );
  });
});
