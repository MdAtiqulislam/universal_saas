import { Test, TestingModule } from '@nestjs/testing';
import { PricingService } from './pricing.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('PricingService', () => {
  let service: PricingService;
  let prismaMock: any;
  let eventBusMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockCurrencyId = '22222222-2222-2222-2222-222222222222';
  const mockUserId = '33333333-3333-3333-3333-333333333333';
  const mockTierId = '44444444-4444-4444-4444-444444444444';
  const mockItemId = '55555555-5555-5555-5555-555555555555';
  const mockVariantId = '66666666-6666-6666-6666-666666666666';

  beforeEach(async () => {
    prismaMock = {
      pricingTier: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      itemPrice: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      currency: {
        findFirst: jest.fn(),
      },
      item: {
        findFirst: jest.fn(),
      },
      itemVariant: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => {
        if (typeof cb === 'function') {
          return cb(prismaMock);
        }
        return Promise.all(cb);
      }),
    };

    eventBusMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PricingService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
      ],
    }).compile();

    service = module.get<PricingService>(PricingService);
  });

  describe('Pricing Tiers', () => {
    it('1. should create a valid pricing tier and emit PRICING_TIER_CREATED', async () => {
      prismaMock.pricingTier.findFirst.mockResolvedValue(null);
      prismaMock.currency.findFirst.mockResolvedValue({
        id: mockCurrencyId,
        code: 'USD',
        isActive: true,
      });
      prismaMock.pricingTier.create.mockResolvedValue({
        id: mockTierId,
        organizationId: mockOrgId,
        code: 'RETAIL',
        name: 'Retail Price',
        currencyId: mockCurrencyId,
        isDefault: true,
        isActive: true,
      });

      const result = await service.createPricingTier(
        mockOrgId,
        {
          code: 'retail',
          name: 'Retail Price',
          currencyId: mockCurrencyId,
          isDefault: true,
        },
        mockUserId,
      );

      expect(result.code).toBe('RETAIL');
      expect(eventBusMock.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'PRICING_TIER_CREATED',
          organizationId: mockOrgId,
        }),
      );
    });

    it('2. should reject duplicate pricing tier code in same organization', async () => {
      prismaMock.pricingTier.findFirst.mockResolvedValue({
        id: mockTierId,
        code: 'RETAIL',
      });

      await expect(
        service.createPricingTier(
          mockOrgId,
          {
            code: 'RETAIL',
            name: 'Retail 2',
            currencyId: mockCurrencyId,
          },
          mockUserId,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('3. should reject pricing tier creation with invalid currency', async () => {
      prismaMock.pricingTier.findFirst.mockResolvedValue(null);
      prismaMock.currency.findFirst.mockResolvedValue(null);

      await expect(
        service.createPricingTier(
          mockOrgId,
          {
            code: 'WHOLESALE',
            name: 'Wholesale',
            currencyId: 'invalid-currency',
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('3b. should throw NotFoundException when finding non-existent pricing tier', async () => {
      prismaMock.pricingTier.findFirst.mockResolvedValue(null);

      await expect(
        service.findOnePricingTier(mockOrgId, 'tier-999'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Item & Variant Prices', () => {
    it('4. should create a valid item price for an item and emit PRICE_CREATED', async () => {
      prismaMock.item.findFirst.mockResolvedValue({
        id: mockItemId,
        organizationId: mockOrgId,
      });
      prismaMock.pricingTier.findFirst.mockResolvedValue({
        id: mockTierId,
        organizationId: mockOrgId,
        isActive: true,
      });
      prismaMock.itemPrice.create.mockResolvedValue({
        id: 'price-1',
        organizationId: mockOrgId,
        itemId: mockItemId,
        variantId: null,
        pricingTierId: mockTierId,
        amount: new Prisma.Decimal('199.9900'),
        minQuantity: new Prisma.Decimal('1.0000'),
        isActive: true,
      });

      const result = await service.createPrice(
        mockOrgId,
        { itemId: mockItemId },
        { pricingTierId: mockTierId, amount: 199.99, minQuantity: 1 },
        mockUserId,
      );

      expect(result.amount.toString()).toBe('199.99');
      expect(eventBusMock.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'PRICE_CREATED',
          organizationId: mockOrgId,
        }),
      );
    });

    it('5. should create a valid variant price for a variant', async () => {
      prismaMock.itemVariant.findFirst.mockResolvedValue({
        id: mockVariantId,
        organizationId: mockOrgId,
      });
      prismaMock.pricingTier.findFirst.mockResolvedValue({
        id: mockTierId,
        organizationId: mockOrgId,
        isActive: true,
      });
      prismaMock.itemPrice.create.mockResolvedValue({
        id: 'price-2',
        organizationId: mockOrgId,
        itemId: null,
        variantId: mockVariantId,
        pricingTierId: mockTierId,
        amount: new Prisma.Decimal('249.9900'),
        minQuantity: new Prisma.Decimal('1.0000'),
        isActive: true,
      });

      const result = await service.createPrice(
        mockOrgId,
        { variantId: mockVariantId },
        { pricingTierId: mockTierId, amount: 249.99, minQuantity: 1 },
        mockUserId,
      );

      expect(result.amount.toString()).toBe('249.99');
    });

    it('6. should reject price with both itemId and variantId (XOR violation)', async () => {
      await expect(
        service.createPrice(
          mockOrgId,
          { itemId: mockItemId, variantId: mockVariantId },
          { pricingTierId: mockTierId, amount: 100 },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('7. should reject price with neither itemId nor variantId (XOR violation)', async () => {
      await expect(
        service.createPrice(
          mockOrgId,
          {},
          { pricingTierId: mockTierId, amount: 100 },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('8. should reject non-positive amount or minQuantity', async () => {
      await expect(
        service.createPrice(
          mockOrgId,
          { itemId: mockItemId },
          { pricingTierId: mockTierId, amount: -10 },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createPrice(
          mockOrgId,
          { itemId: mockItemId },
          { pricingTierId: mockTierId, amount: 100, minQuantity: 0 },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('9. should reject price creation with inactive pricing tier', async () => {
      prismaMock.item.findFirst.mockResolvedValue({ id: mockItemId });
      prismaMock.pricingTier.findFirst.mockResolvedValue({
        id: mockTierId,
        code: 'OLD_TIER',
        isActive: false,
      });

      await expect(
        service.createPrice(
          mockOrgId,
          { itemId: mockItemId },
          { pricingTierId: mockTierId, amount: 50 },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('10. should delete price and emit PRICE_DELETED', async () => {
      prismaMock.itemPrice.findFirst.mockResolvedValue({
        id: 'price-1',
        organizationId: mockOrgId,
        itemId: mockItemId,
        pricingTierId: mockTierId,
      });
      prismaMock.itemPrice.delete.mockResolvedValue({ id: 'price-1' });

      const result = await service.deletePrice(
        mockOrgId,
        'price-1',
        mockUserId,
      );
      expect(result.success).toBe(true);
      expect(eventBusMock.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'PRICE_DELETED',
          organizationId: mockOrgId,
        }),
      );
    });
  });
});
