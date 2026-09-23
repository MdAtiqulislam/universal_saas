import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CustomerPricingService } from './customer-pricing.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { Prisma } from '@prisma/client';

describe('CustomerPricingService', () => {
  let service: CustomerPricingService;
  let prismaMock: any;
  let eventBusMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockCustomerId = '22222222-2222-2222-2222-222222222222';
  const mockGroupId = '33333333-3333-3333-3333-333333333333';
  const mockItemId = '44444444-4444-4444-4444-444444444444';
  const mockVariantId = '55555555-5555-5555-5555-555555555555';
  const mockCurrencyId = '66666666-6666-6666-6666-666666666666';
  const mockPriceId = '77777777-7777-7777-7777-777777777777';

  beforeEach(async () => {
    prismaMock = {
      customerPrice: {
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      customer: { findFirst: jest.fn() },
      customerGroup: { findFirst: jest.fn() },
      item: { findFirst: jest.fn() },
      itemVariant: { findFirst: jest.fn() },
      currency: { findFirst: jest.fn() },
    };

    eventBusMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerPricingService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
      ],
    }).compile();

    service = module.get<CustomerPricingService>(CustomerPricingService);
  });

  it('1. should create pricing rule for specific Customer and Item', async () => {
    prismaMock.customer.findFirst.mockResolvedValue({ id: mockCustomerId });
    prismaMock.item.findFirst.mockResolvedValue({ id: mockItemId });
    prismaMock.currency.findFirst.mockResolvedValue({ id: mockCurrencyId });
    prismaMock.customerPrice.create.mockResolvedValue({
      id: mockPriceId,
      organizationId: mockOrgId,
      customerId: mockCustomerId,
      itemId: mockItemId,
      unitPrice: new Prisma.Decimal('85.5000'),
      minQuantity: new Prisma.Decimal('10.0000'),
      isActive: true,
    });

    const result = await service.create(mockOrgId, {
      customerId: mockCustomerId,
      itemId: mockItemId,
      currencyId: mockCurrencyId,
      unitPrice: 85.5,
      minQuantity: 10,
    });

    expect(result.unitPrice.toString()).toBe('85.5');
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'CUSTOMER_PRICE_CREATED',
      }),
    );
  });

  it('2. should create pricing rule for Customer Group and Item Variant', async () => {
    prismaMock.customerGroup.findFirst.mockResolvedValue({ id: mockGroupId });
    prismaMock.itemVariant.findFirst.mockResolvedValue({ id: mockVariantId });
    prismaMock.currency.findFirst.mockResolvedValue({ id: mockCurrencyId });
    prismaMock.customerPrice.create.mockResolvedValue({
      id: mockPriceId,
      organizationId: mockOrgId,
      customerGroupId: mockGroupId,
      variantId: mockVariantId,
      unitPrice: new Prisma.Decimal('75.0000'),
      minQuantity: new Prisma.Decimal('1.0000'),
      isActive: true,
    });

    const result = await service.create(mockOrgId, {
      customerGroupId: mockGroupId,
      variantId: mockVariantId,
      currencyId: mockCurrencyId,
      unitPrice: 75,
    });

    expect(result.unitPrice.toString()).toBe('75');
  });

  it('3. should reject when both customerId and customerGroupId are provided (XOR violation)', async () => {
    await expect(
      service.create(mockOrgId, {
        customerId: mockCustomerId,
        customerGroupId: mockGroupId,
        itemId: mockItemId,
        currencyId: mockCurrencyId,
        unitPrice: 50,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('4. should reject when neither customerId nor customerGroupId is provided', async () => {
    await expect(
      service.create(mockOrgId, {
        itemId: mockItemId,
        currencyId: mockCurrencyId,
        unitPrice: 50,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('5. should reject when both itemId and variantId are provided (XOR violation)', async () => {
    await expect(
      service.create(mockOrgId, {
        customerId: mockCustomerId,
        itemId: mockItemId,
        variantId: mockVariantId,
        currencyId: mockCurrencyId,
        unitPrice: 50,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('6. should reject invalid date ranges (validFrom > validUntil)', async () => {
    prismaMock.customer.findFirst.mockResolvedValue({ id: mockCustomerId });
    prismaMock.item.findFirst.mockResolvedValue({ id: mockItemId });
    prismaMock.currency.findFirst.mockResolvedValue({ id: mockCurrencyId });

    await expect(
      service.create(mockOrgId, {
        customerId: mockCustomerId,
        itemId: mockItemId,
        currencyId: mockCurrencyId,
        unitPrice: 50,
        validFrom: '2028-01-01',
        validUntil: '2027-01-01',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('7. should update price rule', async () => {
    prismaMock.customerPrice.findFirst.mockResolvedValue({
      id: mockPriceId,
      unitPrice: new Prisma.Decimal('85.5000'),
    });
    prismaMock.customerPrice.update.mockResolvedValue({
      id: mockPriceId,
      unitPrice: new Prisma.Decimal('90.0000'),
    });

    const result = await service.update(mockOrgId, mockPriceId, {
      unitPrice: 90,
    });

    expect(result.unitPrice.toString()).toBe('90');
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'CUSTOMER_PRICE_UPDATED',
      }),
    );
  });

  it('8. should delete price rule', async () => {
    prismaMock.customerPrice.findFirst.mockResolvedValue({ id: mockPriceId });
    prismaMock.customerPrice.delete.mockResolvedValue({});

    const result = await service.remove(mockOrgId, mockPriceId);
    expect(result.success).toBe(true);
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'CUSTOMER_PRICE_DELETED',
      }),
    );
  });
});
