import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { ReservationStatus, SalesOrderStatus, Prisma } from '@prisma/client';

describe('ReservationsService', () => {
  let service: ReservationsService;
  let prismaMock: any;
  let eventBusMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockReservationId = '22222222-2222-2222-2222-222222222222';
  const mockOrderId = '33333333-3333-3333-3333-333333333333';
  const mockLineId = '44444444-4444-4444-4444-444444444444';
  const mockLocationId = '55555555-5555-5555-5555-555555555555';
  const mockItemId = '66666666-6666-6666-6666-666666666666';
  const mockUserId = '77777777-7777-7777-7777-777777777777';

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn((callback) => callback(prismaMock)),
      inventoryReservation: {
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      inventoryBalance: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      salesOrderLine: {
        update: jest.fn(),
      },
      salesOrder: {
        update: jest.fn(),
      },
    };

    eventBusMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
      ],
    }).compile();

    service = module.get<ReservationsService>(ReservationsService);
  });

  it('1. should list reservations with pagination', async () => {
    prismaMock.inventoryReservation.count.mockResolvedValue(1);
    prismaMock.inventoryReservation.findMany.mockResolvedValue([
      {
        id: mockReservationId,
        quantity: new Prisma.Decimal('10.0000'),
        status: ReservationStatus.ACTIVE,
      },
    ]);

    const result = await service.findAll(mockOrgId, { page: 1, limit: 10 });
    expect(result.reservations).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('2. should release active reservation and adjust balances', async () => {
    prismaMock.inventoryReservation.findFirst.mockResolvedValue({
      id: mockReservationId,
      organizationId: mockOrgId,
      salesOrderId: mockOrderId,
      salesOrderLineId: mockLineId,
      locationId: mockLocationId,
      itemId: mockItemId,
      variantId: null,
      quantity: new Prisma.Decimal('5.0000'),
      status: ReservationStatus.ACTIVE,
    });

    prismaMock.inventoryBalance.findFirst.mockResolvedValue({
      id: 'bal-1',
      quantityReserved: new Prisma.Decimal('5.0000'),
    });

    prismaMock.inventoryReservation.update.mockResolvedValue({
      id: mockReservationId,
      status: ReservationStatus.RELEASED,
    });

    prismaMock.inventoryReservation.findMany.mockResolvedValue([]); // No remaining active reservations

    const result = await service.release(
      mockOrgId,
      mockReservationId,
      mockUserId,
    );
    expect(result.status).toBe(ReservationStatus.RELEASED);
    expect(prismaMock.inventoryBalance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          quantityReserved: { decrement: new Prisma.Decimal('5.0000') },
        },
      }),
    );
    expect(prismaMock.salesOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: mockOrderId },
        data: { status: SalesOrderStatus.CONFIRMED },
      }),
    );
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'INVENTORY_RESERVATION_RELEASED',
      }),
    );
  });

  it('3. should reject releasing already released reservation', async () => {
    prismaMock.inventoryReservation.findFirst.mockResolvedValue({
      id: mockReservationId,
      status: ReservationStatus.RELEASED,
    });

    await expect(
      service.release(mockOrgId, mockReservationId, mockUserId),
    ).rejects.toThrow(BadRequestException);
  });
});
