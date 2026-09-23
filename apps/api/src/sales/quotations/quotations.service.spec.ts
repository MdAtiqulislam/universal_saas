import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { QuotationsService } from './quotations.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import {
  QuotationStatus,
  SalesOrderStatus,
  Prisma,
  TrackingType,
} from '@prisma/client';

describe('QuotationsService', () => {
  let service: QuotationsService;
  let prismaMock: any;
  let eventBusMock: any;
  let numberingMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockCustomerId = '22222222-2222-2222-2222-222222222222';
  const mockLocationId = '33333333-3333-3333-3333-333333333333';
  const mockCurrencyId = '44444444-4444-4444-4444-444444444444';
  const mockItemId = '55555555-5555-5555-5555-555555555555';
  const mockQuotationId = '66666666-6666-6666-6666-666666666666';
  const mockUserId = '77777777-7777-7777-7777-777777777777';

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn((callback) => callback(prismaMock)),
      quotation: {
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      quotationLine: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      salesOrder: {
        count: jest.fn(),
        create: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      salesOrderLine: {
        createMany: jest.fn(),
      },
      customer: { findFirst: jest.fn() },
      location: { findFirst: jest.fn() },
      currency: { findFirst: jest.fn() },
      item: { findFirst: jest.fn() },
      itemVariant: { findFirst: jest.fn() },
    };

    eventBusMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    numberingMock = {
      nextNumber: jest.fn().mockResolvedValue({
        sequenceKey: 'QUOTATION',
        number: 1,
        formatted: 'QT-000001',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuotationsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
        { provide: NumberingService, useValue: numberingMock },
      ],
    }).compile();

    service = module.get<QuotationsService>(QuotationsService);
  });

  it('1. should create draft quotation with precise decimal calculations', async () => {
    prismaMock.customer.findFirst.mockResolvedValue({ id: mockCustomerId });
    prismaMock.location.findFirst.mockResolvedValue({ id: mockLocationId });
    prismaMock.currency.findFirst.mockResolvedValue({ id: mockCurrencyId });
    prismaMock.item.findFirst.mockResolvedValue({
      id: mockItemId,
      sku: 'PROD-1',
      trackingType: TrackingType.NONE,
    });

    prismaMock.quotation.create.mockResolvedValue({
      id: mockQuotationId,
      quotationNumber: 'QT-000001',
    });

    prismaMock.quotation.findUniqueOrThrow.mockResolvedValue({
      id: mockQuotationId,
      quotationNumber: 'QT-000001',
      subtotal: new Prisma.Decimal('200.0000'),
      discountTotal: new Prisma.Decimal('20.0000'),
      taxTotal: new Prisma.Decimal('9.0000'),
      shippingTotal: new Prisma.Decimal('10.0000'),
      grandTotal: new Prisma.Decimal('199.0000'),
      status: QuotationStatus.DRAFT,
    });

    const result = await service.create(
      mockOrgId,
      {
        customerId: mockCustomerId,
        locationId: mockLocationId,
        currencyId: mockCurrencyId,
        shippingTotal: 10,
        lines: [
          {
            itemId: mockItemId,
            quantity: 2,
            unitPrice: 100,
            discountAmount: 20,
            taxRate: 0.05,
          },
        ],
      },
      mockUserId,
    );

    expect(result.quotationNumber).toBe('QT-000001');
    expect(result.grandTotal.toString()).toBe('199');
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'QUOTATION_CREATED',
      }),
    );
  });

  it('2. should reject quotation line with 0 or negative quantity', async () => {
    prismaMock.customer.findFirst.mockResolvedValue({ id: mockCustomerId });
    prismaMock.location.findFirst.mockResolvedValue({ id: mockLocationId });
    prismaMock.currency.findFirst.mockResolvedValue({ id: mockCurrencyId });
    prismaMock.item.findFirst.mockResolvedValue({ id: mockItemId });

    await expect(
      service.create(
        mockOrgId,
        {
          customerId: mockCustomerId,
          locationId: mockLocationId,
          currencyId: mockCurrencyId,
          lines: [{ itemId: mockItemId, quantity: 0, unitPrice: 50 }],
        },
        mockUserId,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('3. should send quotation (DRAFT -> SENT)', async () => {
    prismaMock.quotation.findFirst.mockResolvedValue({
      id: mockQuotationId,
      status: QuotationStatus.DRAFT,
      quotationNumber: 'QT-000001',
    });
    prismaMock.quotation.update.mockResolvedValue({
      id: mockQuotationId,
      status: QuotationStatus.SENT,
      quotationNumber: 'QT-000001',
    });

    const result = await service.send(mockOrgId, mockQuotationId, mockUserId);
    expect(result.status).toBe(QuotationStatus.SENT);
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'QUOTATION_SENT',
      }),
    );
  });

  it('4. should accept quotation (SENT -> ACCEPTED)', async () => {
    prismaMock.quotation.findFirst.mockResolvedValue({
      id: mockQuotationId,
      status: QuotationStatus.SENT,
      quotationNumber: 'QT-000001',
    });
    prismaMock.quotation.update.mockResolvedValue({
      id: mockQuotationId,
      status: QuotationStatus.ACCEPTED,
      quotationNumber: 'QT-000001',
    });

    const result = await service.accept(mockOrgId, mockQuotationId, mockUserId);
    expect(result.status).toBe(QuotationStatus.ACCEPTED);
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'QUOTATION_ACCEPTED',
      }),
    );
  });

  it('5. should reject quotation (SENT -> REJECTED)', async () => {
    prismaMock.quotation.findFirst.mockResolvedValue({
      id: mockQuotationId,
      status: QuotationStatus.SENT,
      quotationNumber: 'QT-000001',
    });
    prismaMock.quotation.update.mockResolvedValue({
      id: mockQuotationId,
      status: QuotationStatus.REJECTED,
      quotationNumber: 'QT-000001',
    });

    const result = await service.reject(mockOrgId, mockQuotationId, mockUserId);
    expect(result.status).toBe(QuotationStatus.REJECTED);
  });

  it('6. should convert accepted quotation to Sales Order (ACCEPTED -> CONVERTED)', async () => {
    numberingMock.nextNumber.mockResolvedValue({
      sequenceKey: 'SALES_ORDER',
      number: 1,
      formatted: 'SO-000001',
    });

    prismaMock.quotation.findFirst.mockResolvedValue({
      id: mockQuotationId,
      quotationNumber: 'QT-000001',
      status: QuotationStatus.ACCEPTED,
      customerId: mockCustomerId,
      currencyId: mockCurrencyId,
      locationId: mockLocationId,
      subtotal: new Prisma.Decimal('100.0000'),
      discountTotal: new Prisma.Decimal('0.0000'),
      taxTotal: new Prisma.Decimal('0.0000'),
      shippingTotal: new Prisma.Decimal('0.0000'),
      grandTotal: new Prisma.Decimal('100.0000'),
      customer: { paymentTermsDays: 30 },
      lines: [
        {
          id: 'q-line-1',
          itemId: mockItemId,
          variantId: null,
          description: null,
          quantity: new Prisma.Decimal('1.0000'),
          unitPrice: new Prisma.Decimal('100.0000'),
          discountAmount: new Prisma.Decimal('0.0000'),
          taxRate: new Prisma.Decimal('0.0000'),
          taxAmount: new Prisma.Decimal('0.0000'),
          lineTotal: new Prisma.Decimal('100.0000'),
        },
      ],
    });

    prismaMock.salesOrder.create.mockResolvedValue({
      id: 'so-id-1',
      orderNumber: 'SO-000001',
    });

    prismaMock.salesOrder.findUniqueOrThrow.mockResolvedValue({
      id: 'so-id-1',
      orderNumber: 'SO-000001',
      status: SalesOrderStatus.DRAFT,
      grandTotal: new Prisma.Decimal('100.0000'),
    });

    const result = await service.convert(
      mockOrgId,
      mockQuotationId,
      mockUserId,
    );
    expect(result.orderNumber).toBe('SO-000001');
    expect(prismaMock.quotation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: QuotationStatus.CONVERTED },
      }),
    );
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'QUOTATION_CONVERTED',
      }),
    );
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'SALES_ORDER_CREATED',
      }),
    );
  });

  it('7. should reject converting a non-accepted quotation (e.g. DRAFT or already CONVERTED)', async () => {
    prismaMock.quotation.findFirst.mockResolvedValue({
      id: mockQuotationId,
      status: QuotationStatus.CONVERTED,
    });

    await expect(
      service.convert(mockOrgId, mockQuotationId, mockUserId),
    ).rejects.toThrow(BadRequestException);
  });
});
