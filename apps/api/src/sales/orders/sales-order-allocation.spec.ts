import { Test, TestingModule } from '@nestjs/testing';
import { SalesOrdersService } from './sales-orders.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { CustomerInvoicesService } from '../../ar/invoices/customer-invoices.service';
import { SalesOrderStatus, ReservationStatus, Prisma } from '@prisma/client';

describe('SalesOrderAllocationWorkflow', () => {
  let service: SalesOrdersService;
  let prismaMock: any;
  let eventBusMock: any;
  let numberingMock: any;
  let invoicesServiceMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockLocationId = '33333333-3333-3333-3333-333333333333';
  const mockItemId = '55555555-5555-5555-5555-555555555555';
  const mockOrderId = '66666666-6666-6666-6666-666666666666';
  const mockUserId = '88888888-8888-8888-8888-888888888888';

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn((callback) => callback(prismaMock)),
      salesOrder: {
        findFirst: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
      salesOrderLine: {
        update: jest.fn(),
      },
      inventoryReservation: {
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      inventoryBalance: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    eventBusMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    numberingMock = {
      nextNumber: jest.fn(),
    };

    invoicesServiceMock = {
      createFromSalesOrder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesOrdersService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
        { provide: NumberingService, useValue: numberingMock },
        { provide: CustomerInvoicesService, useValue: invoicesServiceMock },
      ],
    }).compile();

    service = module.get<SalesOrdersService>(SalesOrdersService);
  });

  describe('Check Availability (Read-Only)', () => {
    it('should compute available, shortage and fulfillable stock without mutating tables', async () => {
      prismaMock.salesOrder.findFirst.mockResolvedValue({
        id: mockOrderId,
        orderNumber: 'SO-000001',
        locationId: mockLocationId,
        lines: [
          {
            id: 'line-1',
            itemId: mockItemId,
            variantId: null,
            quantity: new Prisma.Decimal(100),
            quantityDelivered: new Prisma.Decimal(0),
            item: { sku: 'SKU-1', name: 'Item 1' },
          },
        ],
      });

      // Stock balance: 75 on hand, 25 already reserved -> 50 available
      prismaMock.inventoryBalance.findFirst.mockResolvedValue({
        quantityOnHand: new Prisma.Decimal(75),
        quantityReserved: new Prisma.Decimal(25),
      });

      const availability = await service.checkAvailability(
        mockOrgId,
        mockOrderId,
      );

      expect(availability.isFullyFulfillable).toBe(false);
      expect(availability.lines[0].ordered).toBe(100);
      expect(availability.lines[0].onHand).toBe(75);
      expect(availability.lines[0].alreadyReserved).toBe(25);
      expect(availability.lines[0].available).toBe(50);
      expect(availability.lines[0].fulfillable).toBe(50);
      expect(availability.lines[0].shortage).toBe(50);

      // Verify no DB mutations occurred
      expect(prismaMock.inventoryBalance.update).not.toHaveBeenCalled();
      expect(prismaMock.inventoryReservation.create).not.toHaveBeenCalled();
    });
  });

  describe('Allocate Inventory', () => {
    it('should fully allocate inventory and transition status to ALLOCATED', async () => {
      prismaMock.salesOrder.findFirst.mockResolvedValue({
        id: mockOrderId,
        orderNumber: 'SO-000001',
        status: SalesOrderStatus.APPROVED,
        locationId: mockLocationId,
        lines: [
          {
            id: 'line-1',
            itemId: mockItemId,
            variantId: null,
            quantity: new Prisma.Decimal(50),
            quantityReserved: new Prisma.Decimal(0),
            quantityDelivered: new Prisma.Decimal(0),
          },
        ],
      });

      prismaMock.inventoryBalance.findFirst.mockResolvedValue({
        id: 'bal-1',
        quantityOnHand: new Prisma.Decimal(100),
        quantityReserved: new Prisma.Decimal(10),
      });

      prismaMock.salesOrder.findUniqueOrThrow.mockResolvedValue({
        id: mockOrderId,
        orderNumber: 'SO-000001',
        status: SalesOrderStatus.ALLOCATED,
      });

      const allocated = await service.allocate(
        mockOrgId,
        mockOrderId,
        mockUserId,
      );

      expect(allocated.status).toBe(SalesOrderStatus.ALLOCATED);
      expect(prismaMock.inventoryReservation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            quantity: new Prisma.Decimal(50),
            status: ReservationStatus.ACTIVE,
          }),
        }),
      );
      expect(prismaMock.inventoryBalance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'bal-1' },
          data: { quantityReserved: { increment: new Prisma.Decimal(50) } },
        }),
      );
      expect(eventBusMock.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'SALES_ORDER_ALLOCATED' }),
      );
    });

    it('should partially allocate when available stock is less than required', async () => {
      prismaMock.salesOrder.findFirst.mockResolvedValue({
        id: mockOrderId,
        orderNumber: 'SO-000001',
        status: SalesOrderStatus.APPROVED,
        locationId: mockLocationId,
        lines: [
          {
            id: 'line-1',
            itemId: mockItemId,
            variantId: null,
            quantity: new Prisma.Decimal(100),
            quantityReserved: new Prisma.Decimal(0),
            quantityDelivered: new Prisma.Decimal(0),
          },
        ],
      });

      prismaMock.inventoryBalance.findFirst.mockResolvedValue({
        id: 'bal-1',
        quantityOnHand: new Prisma.Decimal(60),
        quantityReserved: new Prisma.Decimal(0),
      });

      prismaMock.salesOrder.findUniqueOrThrow.mockResolvedValue({
        id: mockOrderId,
        orderNumber: 'SO-000001',
        status: SalesOrderStatus.PARTIALLY_RESERVED,
      });

      const allocated = await service.allocate(
        mockOrgId,
        mockOrderId,
        mockUserId,
      );
      expect(allocated.status).toBe(SalesOrderStatus.PARTIALLY_RESERVED);
      expect(prismaMock.inventoryReservation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            quantity: new Prisma.Decimal(60),
          }),
        }),
      );
    });
  });

  describe('Release Allocation', () => {
    it('should release all active reservations and restore available stock', async () => {
      prismaMock.salesOrder.findFirst.mockResolvedValue({
        id: mockOrderId,
        status: SalesOrderStatus.ALLOCATED,
        locationId: mockLocationId,
        lines: [],
      });

      prismaMock.inventoryReservation.findMany.mockResolvedValue([
        {
          id: 'res-1',
          salesOrderLineId: 'line-1',
          locationId: mockLocationId,
          itemId: mockItemId,
          variantId: null,
          quantity: new Prisma.Decimal(50),
        },
      ]);

      prismaMock.inventoryBalance.findFirst.mockResolvedValue({
        id: 'bal-1',
        quantityReserved: new Prisma.Decimal(50),
      });

      prismaMock.salesOrder.findUniqueOrThrow.mockResolvedValue({
        id: mockOrderId,
        orderNumber: 'SO-000001',
        status: SalesOrderStatus.APPROVED,
      });

      const res = await service.releaseAllocation(
        mockOrgId,
        mockOrderId,
        mockUserId,
      );
      expect(res.status).toBe(SalesOrderStatus.APPROVED);
      expect(prismaMock.inventoryBalance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'bal-1' },
          data: { quantityReserved: { decrement: new Prisma.Decimal(50) } },
        }),
      );
      expect(prismaMock.inventoryReservation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'res-1' },
          data: expect.objectContaining({ status: ReservationStatus.RELEASED }),
        }),
      );
      expect(eventBusMock.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'SALES_ORDER_ALLOCATION_RELEASED',
        }),
      );
    });
  });
});
