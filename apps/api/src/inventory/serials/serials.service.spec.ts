import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { TrackingType, SerialStatus } from '@prisma/client';
import { SerialsService } from './serials.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { BalancesService } from '../balances/balances.service';

describe('SerialsService (M09)', () => {
  let service: SerialsService;
  let prismaMock: any;
  let eventBusMock: any;
  let balancesServiceMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockUserId = '22222222-2222-2222-2222-222222222222';
  const mockItemId = '33333333-3333-3333-3333-333333333333';
  const mockLocationId = '44444444-4444-4444-4444-444444444444';

  beforeEach(async () => {
    prismaMock = {
      item: {
        findFirst: jest.fn(),
      },
      location: {
        findFirst: jest.fn(),
      },
      itemVariant: {
        findFirst: jest.fn(),
      },
      inventorySerial: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    eventBusMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    balancesServiceMock = {
      applyStockMovement: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SerialsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
        { provide: BalancesService, useValue: balancesServiceMock },
      ],
    }).compile();

    service = module.get<SerialsService>(SerialsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('1. should create and auto-receive serial for SERIAL-tracked item', async () => {
    prismaMock.item.findFirst.mockResolvedValue({
      id: mockItemId,
      organizationId: mockOrgId,
      sku: 'PROD-SERIAL',
      trackingType: TrackingType.SERIAL,
    });
    prismaMock.location.findFirst.mockResolvedValue({
      id: mockLocationId,
      organizationId: mockOrgId,
      code: 'WH-1',
    });
    prismaMock.inventorySerial.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'serial-1',
        organizationId: mockOrgId,
        serialNumber: 'SN-100200',
        status: SerialStatus.AVAILABLE,
      });
    prismaMock.inventorySerial.create.mockResolvedValue({
      id: 'serial-1',
      organizationId: mockOrgId,
      itemId: mockItemId,
      locationId: mockLocationId,
      serialNumber: 'SN-100200',
      status: SerialStatus.AVAILABLE,
    });

    const result = await service.create(
      mockOrgId,
      {
        itemId: mockItemId,
        locationId: mockLocationId,
        serialNumber: 'sn-100200',
        autoReceive: true,
      },
      mockUserId,
    );

    expect(result.serialNumber).toBe('SN-100200');
    expect(balancesServiceMock.applyStockMovement).toHaveBeenCalledWith(
      mockOrgId,
      expect.objectContaining({
        serialId: 'serial-1',
        quantity: 1,
      }),
      mockUserId,
    );
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'SERIAL_CREATED',
      }),
    );
  });

  it('2. should reject serial registration for non-SERIAL tracked item', async () => {
    prismaMock.item.findFirst.mockResolvedValue({
      id: mockItemId,
      organizationId: mockOrgId,
      sku: 'PROD-NONE',
      trackingType: TrackingType.NONE,
    });

    await expect(
      service.create(
        mockOrgId,
        {
          itemId: mockItemId,
          locationId: mockLocationId,
          serialNumber: 'SN-1',
        },
        mockUserId,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('3. should reject duplicate serial number in same organization', async () => {
    prismaMock.item.findFirst.mockResolvedValue({
      id: mockItemId,
      organizationId: mockOrgId,
      sku: 'PROD-SERIAL',
      trackingType: TrackingType.SERIAL,
    });
    prismaMock.location.findFirst.mockResolvedValue({
      id: mockLocationId,
      organizationId: mockOrgId,
      code: 'WH-1',
    });
    prismaMock.inventorySerial.findFirst.mockResolvedValue({
      id: 'serial-existing',
      serialNumber: 'SN-DUP',
    });

    await expect(
      service.create(
        mockOrgId,
        {
          itemId: mockItemId,
          locationId: mockLocationId,
          serialNumber: 'SN-DUP',
        },
        mockUserId,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('4. should update serial status and emit SERIAL_STATUS_CHANGED', async () => {
    prismaMock.inventorySerial.findFirst.mockResolvedValue({
      id: 'serial-1',
      organizationId: mockOrgId,
      serialNumber: 'SN-1',
      status: SerialStatus.AVAILABLE,
    });
    prismaMock.inventorySerial.update.mockResolvedValue({
      id: 'serial-1',
      serialNumber: 'SN-1',
      status: SerialStatus.DAMAGED,
    });

    const result = await service.update(
      mockOrgId,
      'serial-1',
      { status: SerialStatus.DAMAGED },
      mockUserId,
    );

    expect(result.status).toBe(SerialStatus.DAMAGED);
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'SERIAL_STATUS_CHANGED',
        details: expect.objectContaining({
          oldStatus: SerialStatus.AVAILABLE,
          newStatus: SerialStatus.DAMAGED,
        }),
      }),
    );
  });

  it('5. should throw NotFoundException when finding non-existent serial', async () => {
    prismaMock.inventorySerial.findFirst.mockResolvedValue(null);

    await expect(service.findOne(mockOrgId, 'missing-serial')).rejects.toThrow(
      NotFoundException,
    );
  });
});
