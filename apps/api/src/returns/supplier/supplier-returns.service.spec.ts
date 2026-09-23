import { Test, TestingModule } from '@nestjs/testing';
import { SupplierReturnsService } from './supplier-returns.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('SupplierReturnsService', () => {
  let service: SupplierReturnsService;
  let prisma: PrismaService;

  const mockOrgId = 'org-111';
  const mockSupplierId = 'supp-111';
  const mockItemId = 'item-111';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupplierReturnsService,
        {
          provide: PrismaService,
          useValue: {
            supplier: { findFirst: jest.fn() },
            purchaseOrder: { findFirst: jest.fn() },
            purchaseOrderLine: { findFirst: jest.fn() },
            goodsReceipt: { findFirst: jest.fn() },
            goodsReceiptLine: { findFirst: jest.fn() },
            item: { findFirst: jest.fn() },
            returnRequestLine: { findMany: jest.fn() },
          },
        },
      ],
    }).compile();

    service = module.get<SupplierReturnsService>(SupplierReturnsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should throw NotFoundException if supplier does not exist', async () => {
    (prisma.supplier.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.validateEligibility(mockOrgId, {
        supplierId: 'invalid-supp',
        lines: [{ itemId: mockItemId, requestedQuantity: 5 }],
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should validate supplier return eligibility against purchase order receipts', async () => {
    (prisma.supplier.findFirst as jest.Mock).mockResolvedValue({
      id: mockSupplierId,
      organizationId: mockOrgId,
      name: 'Global Parts Ltd',
      isActive: true,
    });

    (prisma.purchaseOrder.findFirst as jest.Mock).mockResolvedValue({
      id: 'po-1',
      organizationId: mockOrgId,
      supplierId: mockSupplierId,
    });

    (prisma.item.findFirst as jest.Mock).mockResolvedValue({
      id: mockItemId,
      sku: 'RAW-001',
    });

    (prisma.purchaseOrderLine.findFirst as jest.Mock).mockResolvedValue({
      id: 'pol-1',
      receivedQuantity: new Prisma.Decimal('100.0000'),
      unitPrice: new Prisma.Decimal('50.0000'),
      taxAmount: new Prisma.Decimal('0.0000'),
    });

    (prisma.returnRequestLine.findMany as jest.Mock).mockResolvedValue([]);

    const result = await service.validateEligibility(mockOrgId, {
      supplierId: mockSupplierId,
      purchaseOrderId: 'po-1',
      lines: [{ itemId: mockItemId, requestedQuantity: 30 }],
    });

    expect(result.isValid).toBe(true);
    expect(result.validatedLines[0].requestedQuantity).toEqual(
      new Prisma.Decimal(30),
    );
    expect(result.validatedLines[0].receivedQuantity).toEqual(
      new Prisma.Decimal('100.0000'),
    );
  });
});
