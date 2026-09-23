import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SalesOrdersService } from './sales-orders.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { CustomerInvoicesService } from '../../ar/invoices/customer-invoices.service';
import { SalesOrderStatus, Prisma } from '@prisma/client';

describe('SalesOrderApprovalWorkflow', () => {
  let service: SalesOrdersService;
  let prismaMock: any;
  let eventBusMock: any;
  let numberingMock: any;
  let invoicesServiceMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockCustomerId = '22222222-2222-2222-2222-222222222222';
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
      customer: { findFirst: jest.fn() },
      customerInvoice: { findMany: jest.fn().mockResolvedValue([]) },
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

  describe('Submit Sales Order', () => {
    it('should transition DRAFT sales order to SUBMITTED', async () => {
      prismaMock.salesOrder.findFirst.mockResolvedValue({
        id: mockOrderId,
        orderNumber: 'SO-000001',
        status: SalesOrderStatus.DRAFT,
        lines: [{ id: 'line-1', quantity: new Prisma.Decimal(10) }],
      });
      prismaMock.salesOrder.update.mockResolvedValue({
        id: mockOrderId,
        orderNumber: 'SO-000001',
        status: SalesOrderStatus.SUBMITTED,
      });

      const res = await service.submit(mockOrgId, mockOrderId, mockUserId);
      expect(res.status).toBe(SalesOrderStatus.SUBMITTED);
      expect(eventBusMock.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'SALES_ORDER_SUBMITTED' }),
      );
    });

    it('should reject submitting sales order without lines', async () => {
      prismaMock.salesOrder.findFirst.mockResolvedValue({
        id: mockOrderId,
        status: SalesOrderStatus.DRAFT,
        lines: [],
      });

      await expect(
        service.submit(mockOrgId, mockOrderId, mockUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject submitting non-draft sales order', async () => {
      prismaMock.salesOrder.findFirst.mockResolvedValue({
        id: mockOrderId,
        status: SalesOrderStatus.APPROVED,
        lines: [{ id: 'line-1' }],
      });

      await expect(
        service.submit(mockOrgId, mockOrderId, mockUserId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Approve Sales Order', () => {
    it('should approve SUBMITTED sales order with active customer and valid lines', async () => {
      prismaMock.salesOrder.findFirst.mockResolvedValue({
        id: mockOrderId,
        orderNumber: 'SO-000001',
        status: SalesOrderStatus.SUBMITTED,
        customerId: mockCustomerId,
        grandTotal: new Prisma.Decimal(500),
        customer: {
          id: mockCustomerId,
          name: 'Acme Corp',
          isActive: true,
          deletedAt: null,
          creditLimit: new Prisma.Decimal(10000),
        },
        lines: [
          {
            id: 'line-1',
            quantity: new Prisma.Decimal(5),
            unitPrice: new Prisma.Decimal(100),
            item: { sku: 'ITEM-1' },
          },
        ],
      });

      prismaMock.salesOrder.findUniqueOrThrow.mockResolvedValue({
        id: mockOrderId,
        orderNumber: 'SO-000001',
        status: SalesOrderStatus.APPROVED,
      });

      const res = await service.approve(mockOrgId, mockOrderId, mockUserId);
      expect(res.status).toBe(SalesOrderStatus.APPROVED);
      expect(prismaMock.salesOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockOrderId },
          data: expect.objectContaining({
            status: SalesOrderStatus.APPROVED,
            approvedByUserId: mockUserId,
          }),
        }),
      );
      expect(eventBusMock.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'SALES_ORDER_APPROVED' }),
      );
    });

    it('should reject approving sales order if customer is deactivated', async () => {
      prismaMock.salesOrder.findFirst.mockResolvedValue({
        id: mockOrderId,
        status: SalesOrderStatus.SUBMITTED,
        customer: {
          name: 'Inactive Customer',
          isActive: false,
          deletedAt: null,
        },
        lines: [{ quantity: new Prisma.Decimal(5) }],
      });

      await expect(
        service.approve(mockOrgId, mockOrderId, mockUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject approving sales order if line quantities are invalid', async () => {
      prismaMock.salesOrder.findFirst.mockResolvedValue({
        id: mockOrderId,
        status: SalesOrderStatus.SUBMITTED,
        customer: { name: 'Customer', isActive: true, deletedAt: null },
        lines: [{ quantity: new Prisma.Decimal(0) }],
      });

      await expect(
        service.approve(mockOrgId, mockOrderId, mockUserId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Reject Sales Order', () => {
    it('should transition SUBMITTED sales order to REJECTED with reason', async () => {
      prismaMock.salesOrder.findFirst.mockResolvedValue({
        id: mockOrderId,
        orderNumber: 'SO-000001',
        status: SalesOrderStatus.SUBMITTED,
      });
      prismaMock.salesOrder.update.mockResolvedValue({
        id: mockOrderId,
        orderNumber: 'SO-000001',
        status: SalesOrderStatus.REJECTED,
        rejectionReason: 'Exceeded seasonal quota',
      });

      const res = await service.reject(
        mockOrgId,
        mockOrderId,
        'Exceeded seasonal quota',
        mockUserId,
      );

      expect(res.status).toBe(SalesOrderStatus.REJECTED);
      expect(eventBusMock.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'SALES_ORDER_REJECTED' }),
      );
    });
  });
});
