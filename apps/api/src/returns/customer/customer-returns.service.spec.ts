import { Test, TestingModule } from '@nestjs/testing';
import { CustomerReturnsService } from './customer-returns.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('CustomerReturnsService', () => {
  let service: CustomerReturnsService;
  let prisma: PrismaService;

  const mockOrgId = 'org-111';
  const mockCustomerId = 'cust-111';
  const mockItemId = 'item-111';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerReturnsService,
        {
          provide: PrismaService,
          useValue: {
            customer: { findFirst: jest.fn() },
            salesOrder: { findFirst: jest.fn() },
            salesOrderLine: { findFirst: jest.fn() },
            deliveryOrder: { findFirst: jest.fn() },
            deliveryOrderLine: { findFirst: jest.fn() },
            shipment: { findFirst: jest.fn() },
            item: { findFirst: jest.fn() },
            returnRequestLine: { findMany: jest.fn() },
          },
        },
      ],
    }).compile();

    service = module.get<CustomerReturnsService>(CustomerReturnsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should throw NotFoundException if customer does not exist in tenant', async () => {
    (prisma.customer.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.validateEligibility(mockOrgId, {
        customerId: 'invalid-cust',
        lines: [{ itemId: mockItemId, requestedQuantity: 5 }],
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should validate customer return eligibility successfully against sales order delivery', async () => {
    (prisma.customer.findFirst as jest.Mock).mockResolvedValue({
      id: mockCustomerId,
      organizationId: mockOrgId,
      name: 'Acme Corp',
      isActive: true,
    });

    (prisma.salesOrder.findFirst as jest.Mock).mockResolvedValue({
      id: 'so-1',
      organizationId: mockOrgId,
      customerId: mockCustomerId,
    });

    (prisma.item.findFirst as jest.Mock).mockResolvedValue({
      id: mockItemId,
      sku: 'SKU-001',
    });

    (prisma.salesOrderLine.findFirst as jest.Mock).mockResolvedValue({
      id: 'sol-1',
      quantityDelivered: new Prisma.Decimal('20.0000'),
      unitPrice: new Prisma.Decimal('100.0000'),
      taxAmount: new Prisma.Decimal('10.0000'),
    });

    (prisma.returnRequestLine.findMany as jest.Mock).mockResolvedValue([
      {
        requestedQuantity: new Prisma.Decimal('5.0000'),
        authorizedQuantity: new Prisma.Decimal('5.0000'),
      },
    ]);

    const result = await service.validateEligibility(mockOrgId, {
      customerId: mockCustomerId,
      salesOrderId: 'so-1',
      lines: [{ itemId: mockItemId, requestedQuantity: 10 }],
    });

    expect(result.isValid).toBe(true);
    expect(result.validatedLines[0].requestedQuantity).toEqual(
      new Prisma.Decimal(10),
    );
    expect(result.validatedLines[0].deliveredQuantity).toEqual(
      new Prisma.Decimal('20.0000'),
    );
    expect(result.validatedLines[0].previouslyReturnedQuantity).toEqual(
      new Prisma.Decimal('5.0000'),
    );
  });

  it('should throw BadRequestException if return quantity exceeds delivered quantity minus prior returns', async () => {
    (prisma.customer.findFirst as jest.Mock).mockResolvedValue({
      id: mockCustomerId,
      organizationId: mockOrgId,
      name: 'Acme Corp',
      isActive: true,
    });

    (prisma.salesOrder.findFirst as jest.Mock).mockResolvedValue({
      id: 'so-1',
      organizationId: mockOrgId,
      customerId: mockCustomerId,
    });

    (prisma.item.findFirst as jest.Mock).mockResolvedValue({
      id: mockItemId,
      sku: 'SKU-001',
    });

    (prisma.salesOrderLine.findFirst as jest.Mock).mockResolvedValue({
      id: 'sol-1',
      quantityDelivered: new Prisma.Decimal('10.0000'),
      unitPrice: new Prisma.Decimal('100.0000'),
      taxAmount: new Prisma.Decimal('0.0000'),
    });

    (prisma.returnRequestLine.findMany as jest.Mock).mockResolvedValue([
      {
        requestedQuantity: new Prisma.Decimal('8.0000'),
        authorizedQuantity: new Prisma.Decimal('8.0000'),
      },
    ]);

    await expect(
      service.validateEligibility(mockOrgId, {
        customerId: mockCustomerId,
        salesOrderId: 'so-1',
        lines: [{ itemId: mockItemId, requestedQuantity: 5 }], // 5 > 10 - 8 (2)
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
