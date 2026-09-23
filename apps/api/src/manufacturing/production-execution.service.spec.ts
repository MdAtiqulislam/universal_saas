import { Test, TestingModule } from '@nestjs/testing';
import { ProductionExecutionService } from './production-execution.service';
import { ManufacturingConfigService } from './manufacturing-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { BalancesService } from '../inventory/balances/balances.service';
import { InventoryCostLayersService } from '../inventory/costing/inventory-cost-layers.service';
import {
  ProductionOrderStatus,
  StockMovementType,
  FiscalPeriodStatus,
  Prisma,
} from '@prisma/client';

describe('ProductionExecutionService', () => {
  let service: ProductionExecutionService;
  let prisma: any;
  let eventBus: any;
  let numberingService: any;
  let balancesService: any;
  let costLayersService: any;

  const mockOrgId = 'org-123';
  const mockUserId = 'user-123';
  const mockOrderId = 'mo-1';
  const mockLineId = 'mol-1';
  const mockItemId = 'item-finished-1';
  const mockRawItemId = 'item-raw-1';
  const mockLocationId = 'loc-1';

  beforeEach(async () => {
    prisma = {
      productionOrder: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      productionOrderLine: {
        update: jest.fn(),
      },
      productionMaterialIssue: {
        create: jest.fn(),
      },
      productionOutput: {
        create: jest.fn(),
      },
      inventorySerial: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      inventoryBatch: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      manufacturingConfiguration: {
        findUnique: jest.fn(),
      },
      fiscalPeriod: {
        findFirst: jest.fn(),
      },
      journalEntry: {
        create: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
    };

    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    numberingService = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'JE-000001' }),
    };

    balancesService = {
      applyStockMovement: jest.fn().mockResolvedValue({
        movement: { id: 'sm-1' },
      }),
    };

    costLayersService = {
      consumeFifo: jest.fn().mockResolvedValue({
        totalCost: new Prisma.Decimal(500),
      }),
      createLayer: jest.fn().mockResolvedValue({ id: 'layer-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductionExecutionService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
        { provide: NumberingService, useValue: numberingService },
        { provide: BalancesService, useValue: balancesService },
        { provide: InventoryCostLayersService, useValue: costLayersService },
        { provide: ManufacturingConfigService, useValue: {} },
      ],
    }).compile();

    service = module.get<ProductionExecutionService>(
      ProductionExecutionService,
    );
  });

  describe('issueMaterial', () => {
    it('should issue material, reduce inventory, consume FIFO layers, and post WIP journal', async () => {
      prisma.productionOrder.findFirst.mockResolvedValue({
        id: mockOrderId,
        orderNumber: 'MO-000001',
        status: ProductionOrderStatus.RELEASED,
        locationId: mockLocationId,
        materialCost: new Prisma.Decimal(0),
        laborCost: new Prisma.Decimal(0),
        overheadCost: new Prisma.Decimal(0),
        totalCost: new Prisma.Decimal(0),
        lines: [
          {
            id: mockLineId,
            itemId: mockRawItemId,
            requiredQuantity: new Prisma.Decimal(10),
            issuedQuantity: new Prisma.Decimal(0),
            consumedQuantity: new Prisma.Decimal(0),
            unitCost: new Prisma.Decimal(50),
            totalCost: new Prisma.Decimal(0),
          },
        ],
      });

      prisma.manufacturingConfiguration.findUnique.mockResolvedValue({
        wipAccountId: 'acc-wip',
        rawMaterialAccountId: 'acc-raw',
      });

      prisma.fiscalPeriod.findFirst.mockResolvedValue({
        id: 'fp-1',
        status: FiscalPeriodStatus.OPEN,
      });

      prisma.journalEntry.create.mockResolvedValue({ id: 'je-wip-1' });
      prisma.productionMaterialIssue.create.mockResolvedValue({ id: 'pmi-1' });
      prisma.productionOrder.update.mockResolvedValue({
        id: mockOrderId,
        status: ProductionOrderStatus.IN_PROGRESS,
        materialCost: new Prisma.Decimal(500),
      });

      const result = await service.issueMaterial(
        mockOrgId,
        mockOrderId,
        {
          productionOrderLineId: mockLineId,
          quantity: 10,
        },
        mockUserId,
      );

      expect(result).toBeDefined();
      expect(balancesService.applyStockMovement).toHaveBeenCalledWith(
        mockOrgId,
        expect.objectContaining({
          itemId: mockRawItemId,
          movementType: StockMovementType.ISSUE,
          quantity: 10,
        }),
        mockUserId,
        expect.anything(),
      );
      expect(costLayersService.consumeFifo).toHaveBeenCalled();
      expect(prisma.journalEntry.create).toHaveBeenCalled();
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'PRODUCTION_MATERIAL_ISSUED' }),
      );
    });
  });

  describe('complete', () => {
    it('should receive finished goods, create cost layer, and post completion journal', async () => {
      prisma.productionOrder.findFirst.mockResolvedValue({
        id: mockOrderId,
        orderNumber: 'MO-000001',
        itemId: mockItemId,
        locationId: mockLocationId,
        status: ProductionOrderStatus.IN_PROGRESS,
        plannedQuantity: new Prisma.Decimal(5),
        producedQuantity: new Prisma.Decimal(0),
        scrapQuantity: new Prisma.Decimal(0),
        materialCost: new Prisma.Decimal(500),
        laborCost: new Prisma.Decimal(0),
        overheadCost: new Prisma.Decimal(0),
        totalCost: new Prisma.Decimal(500),
        lines: [],
        outputs: [],
      });

      prisma.manufacturingConfiguration.findUnique.mockResolvedValue({
        finishedGoodsAccountId: 'acc-fg',
        wipAccountId: 'acc-wip',
        laborAccountId: 'acc-labor',
        overheadAccountId: 'acc-overhead',
      });

      prisma.fiscalPeriod.findFirst.mockResolvedValue({
        id: 'fp-1',
        status: FiscalPeriodStatus.OPEN,
      });

      prisma.journalEntry.create.mockResolvedValue({ id: 'je-comp-1' });
      prisma.productionOutput.create.mockResolvedValue({ id: 'out-1' });
      prisma.productionOrder.update.mockResolvedValue({
        id: mockOrderId,
        status: ProductionOrderStatus.COMPLETED,
        producedQuantity: new Prisma.Decimal(5),
      });

      const result = await service.complete(
        mockOrgId,
        mockOrderId,
        {
          quantity: 5,
          laborCost: 100,
          overheadCost: 50,
        },
        mockUserId,
      );

      expect(result).toBeDefined();
      expect(balancesService.applyStockMovement).toHaveBeenCalledWith(
        mockOrgId,
        expect.objectContaining({
          itemId: mockItemId,
          movementType: StockMovementType.RECEIPT,
          quantity: 5,
        }),
        mockUserId,
        expect.anything(),
      );
      expect(costLayersService.createLayer).toHaveBeenCalled();
      expect(prisma.journalEntry.create).toHaveBeenCalled();
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'PRODUCTION_COMPLETED' }),
      );
    });
  });

  describe('close', () => {
    it('should close completed production order and record any variance', async () => {
      prisma.productionOrder.findFirst.mockResolvedValue({
        id: mockOrderId,
        orderNumber: 'MO-000001',
        status: ProductionOrderStatus.COMPLETED,
        totalCost: new Prisma.Decimal(650),
        outputs: [{ totalCost: new Prisma.Decimal(600) }], // Variance = 50
        lines: [],
      });

      prisma.manufacturingConfiguration.findUnique.mockResolvedValue({
        varianceAccountId: 'acc-var',
        wipAccountId: 'acc-wip',
      });

      prisma.fiscalPeriod.findFirst.mockResolvedValue({
        id: 'fp-1',
        status: FiscalPeriodStatus.OPEN,
      });

      prisma.journalEntry.create.mockResolvedValue({ id: 'je-var-1' });
      prisma.productionOrder.update.mockResolvedValue({
        id: mockOrderId,
        status: ProductionOrderStatus.CLOSED,
      });

      const closed = await service.close(mockOrgId, mockOrderId, mockUserId);
      expect(closed.status).toBe(ProductionOrderStatus.CLOSED);
      expect(prisma.journalEntry.create).toHaveBeenCalled();
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'PRODUCTION_CLOSED' }),
      );
    });
  });
});
