import { Test, TestingModule } from '@nestjs/testing';
import { AccountsPayableMatchingService } from './accounts-payable-matching.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('AccountsPayableMatchingService', () => {
  let service: AccountsPayableMatchingService;
  let prismaMock: any;
  let eventBusMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockInvoiceId = '22222222-2222-2222-2222-222222222222';
  const mockPoId = '33333333-3333-3333-3333-333333333333';
  const mockPoLineId = '44444444-4444-4444-4444-444444444444';
  const mockItemId = '55555555-5555-5555-5555-555555555555';
  const mockUserId = '66666666-6666-6666-6666-666666666666';

  beforeEach(async () => {
    prismaMock = {
      supplierInvoice: {
        findFirst: jest.fn(),
      },
      supplierInvoiceLine: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    eventBusMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsPayableMatchingService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
      ],
    }).compile();

    service = module.get<AccountsPayableMatchingService>(
      AccountsPayableMatchingService,
    );
  });

  it('1. should return MATCHED when invoiced quantity and price match PO & GR lines perfectly', async () => {
    prismaMock.supplierInvoice.findFirst.mockResolvedValue({
      id: mockInvoiceId,
      organizationId: mockOrgId,
      invoiceNumber: 'SI-000001',
      purchaseOrderId: mockPoId,
      goodsReceiptId: 'gr-1',
      lines: [
        {
          id: 'line-1',
          itemId: mockItemId,
          quantity: new Prisma.Decimal('100.0000'),
          unitPrice: new Prisma.Decimal('50.0000'),
          purchaseOrderLineId: mockPoLineId,
          goodsReceiptLineId: 'gr-line-1',
          item: { id: mockItemId, sku: 'ITEM-100', name: 'Steel Tube' },
          purchaseOrderLine: {
            id: mockPoLineId,
            quantity: new Prisma.Decimal('100.0000'),
            unitPrice: new Prisma.Decimal('50.0000'),
            receivedQuantity: new Prisma.Decimal('100.0000'),
          },
          goodsReceiptLine: {
            id: 'gr-line-1',
            quantity: new Prisma.Decimal('100.0000'),
            unitCost: new Prisma.Decimal('50.0000'),
          },
        },
      ],
    });

    const report = await service.matchInvoice(
      mockOrgId,
      mockInvoiceId,
      mockUserId,
    );

    expect(report.overallStatus).toBe('MATCHED');
    expect(report.canApprove).toBe(true);
    expect(report.lines[0].status).toBe('MATCHED');
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'AP_MATCHING_PERFORMED',
      }),
    );
  });

  it('2. should detect QUANTITY_VARIANCE when invoiced quantity exceeds received quantity', async () => {
    prismaMock.supplierInvoice.findFirst.mockResolvedValue({
      id: mockInvoiceId,
      organizationId: mockOrgId,
      invoiceNumber: 'SI-000001',
      purchaseOrderId: mockPoId,
      lines: [
        {
          id: 'line-1',
          itemId: mockItemId,
          quantity: new Prisma.Decimal('100.0000'),
          unitPrice: new Prisma.Decimal('50.0000'),
          purchaseOrderLineId: mockPoLineId,
          item: { id: mockItemId, sku: 'ITEM-100', name: 'Steel Tube' },
          purchaseOrderLine: {
            id: mockPoLineId,
            quantity: new Prisma.Decimal('100.0000'),
            unitPrice: new Prisma.Decimal('50.0000'),
            receivedQuantity: new Prisma.Decimal('80.0000'),
          },
          goodsReceiptLine: null,
        },
      ],
    });

    const report = await service.matchInvoice(
      mockOrgId,
      mockInvoiceId,
      mockUserId,
    );

    expect(report.overallStatus).toBe('OVER_INVOICED');
    expect(report.canApprove).toBe(false);
  });

  it('3. should detect OVER_INVOICED when cumulative invoice quantity exceeds ordered quantity', async () => {
    prismaMock.supplierInvoice.findFirst.mockResolvedValue({
      id: mockInvoiceId,
      organizationId: mockOrgId,
      invoiceNumber: 'SI-000002',
      purchaseOrderId: mockPoId,
      lines: [
        {
          id: 'line-2',
          itemId: mockItemId,
          quantity: new Prisma.Decimal('60.0000'),
          unitPrice: new Prisma.Decimal('50.0000'),
          purchaseOrderLineId: mockPoLineId,
          item: { id: mockItemId, sku: 'ITEM-100', name: 'Steel Tube' },
          purchaseOrderLine: {
            id: mockPoLineId,
            quantity: new Prisma.Decimal('100.0000'),
            unitPrice: new Prisma.Decimal('50.0000'),
            receivedQuantity: new Prisma.Decimal('100.0000'),
          },
        },
      ],
    });

    // Previous invoice already took 50 units
    prismaMock.supplierInvoiceLine.findMany.mockResolvedValue([
      { quantity: new Prisma.Decimal('50.0000') },
    ]);

    const report = await service.matchInvoice(
      mockOrgId,
      mockInvoiceId,
      mockUserId,
    );

    expect(report.overallStatus).toBe('OVER_INVOICED');
    expect(report.canApprove).toBe(false);
    expect(report.lines[0].status).toBe('OVER_INVOICED');
  });

  it('4. should detect PRICE_VARIANCE when invoice unit price differs from PO unit price', async () => {
    prismaMock.supplierInvoice.findFirst.mockResolvedValue({
      id: mockInvoiceId,
      organizationId: mockOrgId,
      invoiceNumber: 'SI-000001',
      purchaseOrderId: mockPoId,
      lines: [
        {
          id: 'line-1',
          itemId: mockItemId,
          quantity: new Prisma.Decimal('10.0000'),
          unitPrice: new Prisma.Decimal('55.0000'), // Differs from PO price 50.00
          purchaseOrderLineId: mockPoLineId,
          item: { id: mockItemId, sku: 'ITEM-100', name: 'Steel Tube' },
          purchaseOrderLine: {
            id: mockPoLineId,
            quantity: new Prisma.Decimal('100.0000'),
            unitPrice: new Prisma.Decimal('50.0000'),
            receivedQuantity: new Prisma.Decimal('100.0000'),
          },
        },
      ],
    });

    const report = await service.matchInvoice(
      mockOrgId,
      mockInvoiceId,
      mockUserId,
    );

    expect(report.overallStatus).toBe('PRICE_VARIANCE');
    expect(report.lines[0].status).toBe('PRICE_VARIANCE');
    expect(report.lines[0].priceVariance).toBe(5);
  });

  it('5. should flag UNLINKED when invoice line has no PO line reference', async () => {
    prismaMock.supplierInvoice.findFirst.mockResolvedValue({
      id: mockInvoiceId,
      organizationId: mockOrgId,
      invoiceNumber: 'SI-000001',
      lines: [
        {
          id: 'line-1',
          itemId: mockItemId,
          quantity: new Prisma.Decimal('10.0000'),
          unitPrice: new Prisma.Decimal('50.0000'),
          purchaseOrderLineId: null,
          item: { id: mockItemId, sku: 'ITEM-100', name: 'Steel Tube' },
        },
      ],
    });

    const report = await service.matchInvoice(
      mockOrgId,
      mockInvoiceId,
      mockUserId,
    );

    expect(report.overallStatus).toBe('UNLINKED');
    expect(report.lines[0].status).toBe('UNLINKED');
  });

  it('6. should throw NotFoundException if invoice is not found in organization', async () => {
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(null);

    await expect(
      service.matchInvoice(mockOrgId, mockInvoiceId, mockUserId),
    ).rejects.toThrow(NotFoundException);
  });
});
