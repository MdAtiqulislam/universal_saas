import { Test, TestingModule } from '@nestjs/testing';
import { ProductionOrdersService } from './production-orders.service';
import { ManufacturingConfigService } from './manufacturing-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { BadRequestException } from '@nestjs/common';
import { ProductionOrderStatus, Prisma } from '@prisma/client';

describe('ProductionOrdersService', () => {
  let service: ProductionOrdersService;
  let prisma: any;
  let eventBus: any;
  let numberingService: any;
  let configService: any;

  const mockOrgId = 'org-123';
  const mockUserId = 'user-123';
  const mockItemId = 'item-finished-1';
  const mockLocationId = 'loc-warehouse-1';
  const mockBomId = 'bom-1';

  beforeEach(async () => {
    prisma = {
      item: { findFirst: jest.fn() },
      location: { findFirst: jest.fn() },
      billOfMaterial: { findFirst: jest.fn() },
      productionOrder: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      inventoryBalance: { findFirst: jest.fn() },
      manufacturingConfiguration: { findUnique: jest.fn() },
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
    };

    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    numberingService = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'MO-000001' }),
    };

    configService = {
      getConfig: jest.fn().mockResolvedValue({ allowReleaseOnShortage: false }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductionOrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
        { provide: NumberingService, useValue: numberingService },
        { provide: ManufacturingConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<ProductionOrdersService>(ProductionOrdersService);
  });

  describe('create', () => {
    it('should create production order and expand BOM lines accurately', async () => {
      prisma.item.findFirst.mockResolvedValue({
        id: mockItemId,
        organizationId: mockOrgId,
      });
      prisma.location.findFirst.mockResolvedValue({
        id: mockLocationId,
        organizationId: mockOrgId,
      });
      prisma.billOfMaterial.findFirst.mockResolvedValue({
        id: mockBomId,
        organizationId: mockOrgId,
        itemId: mockItemId,
        quantity: new Prisma.Decimal(1),
        lines: [
          {
            itemId: 'raw-1',
            quantity: new Prisma.Decimal(2),
            scrapPercentage: new Prisma.Decimal(10), // 10% scrap
            uomId: 'uom-1',
          },
        ],
      });
      prisma.productionOrder.findUnique.mockResolvedValue(null);

      const mockCreatedOrder = {
        id: 'mo-1',
        orderNumber: 'MO-000001',
        plannedQuantity: new Prisma.Decimal(10),
        status: ProductionOrderStatus.DRAFT,
        lines: [
          {
            itemId: 'raw-1',
            requiredQuantity: new Prisma.Decimal(22), // 2 * 10 * 1.1 = 22
          },
        ],
      };

      prisma.productionOrder.create.mockResolvedValue(mockCreatedOrder);

      const result = await service.create(
        mockOrgId,
        {
          itemId: mockItemId,
          bomId: mockBomId,
          locationId: mockLocationId,
          plannedQuantity: 10,
          plannedStartDate: '2026-09-01',
          plannedCompletionDate: '2026-09-10',
        },
        mockUserId,
      );

      expect(result).toBeDefined();
      expect(result.orderNumber).toBe('MO-000001');
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'PRODUCTION_ORDER_CREATED' }),
      );
    });

    it('should reject creation if planned start date is after planned completion date', async () => {
      await expect(
        service.create(
          mockOrgId,
          {
            itemId: mockItemId,
            bomId: mockBomId,
            locationId: mockLocationId,
            plannedQuantity: 10,
            plannedStartDate: '2026-09-15',
            plannedCompletionDate: '2026-09-10',
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('material availability and release', () => {
    it('should return shortage when stock is insufficient', async () => {
      prisma.productionOrder.findFirst.mockResolvedValue({
        id: 'mo-1',
        orderNumber: 'MO-000001',
        locationId: mockLocationId,
        lines: [
          {
            itemId: 'raw-1',
            requiredQuantity: new Prisma.Decimal(100),
            issuedQuantity: new Prisma.Decimal(0),
            item: { sku: 'RAW-001', name: 'Raw Material 1' },
          },
        ],
      });

      prisma.inventoryBalance.findFirst.mockResolvedValue({
        quantityOnHand: new Prisma.Decimal(40),
        quantityReserved: new Prisma.Decimal(10), // Available = 30
      });

      const availability = await service.checkMaterialAvailability(
        mockOrgId,
        'mo-1',
      );
      expect(availability.isAllAvailable).toBe(false);
      expect(availability.components[0].availableQuantity).toBe(30);
      expect(availability.components[0].shortageQuantity).toBe(70);
      expect(availability.components[0].isSufficient).toBe(false);
    });

    it('should block release when shortage exists and allowReleaseOnShortage is false', async () => {
      prisma.productionOrder.findFirst.mockResolvedValue({
        id: 'mo-1',
        status: ProductionOrderStatus.DRAFT,
        locationId: mockLocationId,
        lines: [
          {
            itemId: 'raw-1',
            requiredQuantity: new Prisma.Decimal(100),
            item: { sku: 'RAW-001', name: 'Raw Material 1' },
          },
        ],
      });

      prisma.manufacturingConfiguration.findUnique.mockResolvedValue({
        allowReleaseOnShortage: false,
      });

      prisma.inventoryBalance.findFirst.mockResolvedValue({
        quantityOnHand: new Prisma.Decimal(50),
        quantityReserved: new Prisma.Decimal(0),
      });

      await expect(
        service.release(mockOrgId, 'mo-1', mockUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow release when stock is sufficient', async () => {
      prisma.productionOrder.findFirst.mockResolvedValue({
        id: 'mo-1',
        status: ProductionOrderStatus.DRAFT,
        locationId: mockLocationId,
        lines: [
          {
            itemId: 'raw-1',
            requiredQuantity: new Prisma.Decimal(100),
            item: { sku: 'RAW-001', name: 'Raw Material 1' },
          },
        ],
      });

      prisma.manufacturingConfiguration.findUnique.mockResolvedValue({
        allowReleaseOnShortage: false,
      });

      prisma.inventoryBalance.findFirst.mockResolvedValue({
        quantityOnHand: new Prisma.Decimal(150),
        quantityReserved: new Prisma.Decimal(10), // Available = 140 >= 100
      });

      prisma.productionOrder.update.mockResolvedValue({
        id: 'mo-1',
        status: ProductionOrderStatus.RELEASED,
        orderNumber: 'MO-000001',
      });

      const released = await service.release(mockOrgId, 'mo-1', mockUserId);
      expect(released.status).toBe(ProductionOrderStatus.RELEASED);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'PRODUCTION_ORDER_RELEASED' }),
      );
    });
  });
});
