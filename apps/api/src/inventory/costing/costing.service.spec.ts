import { Test, TestingModule } from '@nestjs/testing';
import { CostingService } from './costing.service';
import { InventoryValuationService } from './inventory-valuation.service';
import { CogsService } from './cogs.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { ApAccountMappingService } from '../../ap/account-mapping/ap-account-mapping.service';
import {
  Prisma,
  FiscalPeriodStatus,
  JournalEntryStatus,
  StockMovementType,
} from '@prisma/client';

describe('CostingService', () => {
  let service: CostingService;
  let prismaMock: any;
  let eventBusMock: any;
  let numberingMock: any;
  let mappingMock: any;
  let valuationMock: any;
  let cogsMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockUserId = '22222222-2222-2222-2222-222222222222';

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn((cb) => cb(prismaMock)),
      fiscalPeriod: { findFirst: jest.fn() },
      journalEntry: {
        create: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      inventoryValuation: { findFirst: jest.fn() },
    };

    eventBusMock = { publish: jest.fn().mockResolvedValue(undefined) };
    numberingMock = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'JE-000201' }),
    };
    mappingMock = {
      resolveAccount: jest.fn((_orgId, key) => {
        return `${key.toLowerCase()}-acc-id`;
      }),
    };
    valuationMock = {
      processInbound: jest.fn().mockResolvedValue({
        id: 'val-1',
        quantityOnHand: new Prisma.Decimal(10),
        averageCost: new Prisma.Decimal(40),
        totalValue: new Prisma.Decimal(400),
      }),
      processOutbound: jest.fn().mockResolvedValue({
        unitCost: new Prisma.Decimal(40),
        totalCost: new Prisma.Decimal(80),
        quantityIssued: new Prisma.Decimal(2),
        valuation: {
          id: 'val-1',
          quantityOnHand: new Prisma.Decimal(8),
          averageCost: new Prisma.Decimal(40),
          totalValue: new Prisma.Decimal(320),
        },
      }),
      getValuation: jest.fn(),
      getItemCostHistory: jest.fn(),
    };
    cogsMock = {
      recordAndPostCogs: jest.fn(),
      getCogsReport: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CostingService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
        { provide: NumberingService, useValue: numberingMock },
        { provide: ApAccountMappingService, useValue: mappingMock },
        { provide: InventoryValuationService, useValue: valuationMock },
        { provide: CogsService, useValue: cogsMock },
      ],
    }).compile();

    service = module.get<CostingService>(CostingService);
  });

  it('1. should record goods receipt costing and post Debit INVENTORY_ASSET, Credit PURCHASE_CLEARING', async () => {
    prismaMock.fiscalPeriod.findFirst.mockResolvedValue({
      id: 'fp-1',
      status: FiscalPeriodStatus.OPEN,
    });

    prismaMock.journalEntry.create.mockResolvedValue({
      id: 'je-rec-1',
      entryNumber: 'JE-000201',
      status: JournalEntryStatus.POSTED,
    });

    const result = await service.recordReceipt(
      mockOrgId,
      {
        itemId: 'item-1',
        locationId: 'loc-1',
        quantity: 10,
        unitCost: 40,
        sourceDocument: 'GOODS_RECEIPT',
        sourceDocumentId: 'gr-1',
        postToGl: true,
      },
      mockUserId,
    );

    expect(result.totalCost.toString()).toBe('400');
    expect(result.journalEntryId).toBe('je-rec-1');

    expect(prismaMock.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: mockOrgId,
          lines: {
            create: [
              {
                organizationId: mockOrgId,
                accountId: 'inventory_asset-acc-id',
                description: 'Inventory Asset - GOODS_RECEIPT',
                debit: new Prisma.Decimal(400),
                credit: new Prisma.Decimal(0),
                lineNumber: 1,
              },
              {
                organizationId: mockOrgId,
                accountId: 'purchase_clearing-acc-id',
                description: 'Purchase Clearing / AP - GOODS_RECEIPT',
                debit: new Prisma.Decimal(0),
                credit: new Prisma.Decimal(400),
                lineNumber: 2,
              },
            ],
          },
        }),
      }),
    );
  });

  it('2. should record positive inventory adjustment and post Debit INVENTORY_ASSET, Credit INVENTORY_ADJUSTMENT_GAIN', async () => {
    prismaMock.fiscalPeriod.findFirst.mockResolvedValue({
      id: 'fp-1',
      status: FiscalPeriodStatus.OPEN,
    });

    prismaMock.journalEntry.create.mockResolvedValue({
      id: 'je-adj-gain-1',
      entryNumber: 'JE-000202',
      status: JournalEntryStatus.POSTED,
    });

    const result = await service.recordAdjustment(
      mockOrgId,
      {
        itemId: 'item-1',
        locationId: 'loc-1',
        movementType: StockMovementType.ADJUSTMENT_IN,
        quantity: 5,
        unitCost: 40,
        reason: 'Found surplus during cycle count',
        postToGl: true,
      },
      mockUserId,
    );

    expect(result.totalCost.toString()).toBe('200');
    expect(result.journalEntryId).toBe('je-adj-gain-1');

    expect(prismaMock.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lines: {
            create: [
              {
                organizationId: mockOrgId,
                accountId: 'inventory_asset-acc-id',
                description: 'Inventory Asset increase',
                debit: new Prisma.Decimal(200),
                credit: new Prisma.Decimal(0),
                lineNumber: 1,
              },
              {
                organizationId: mockOrgId,
                accountId: 'inventory_adjustment_gain-acc-id',
                description: 'Inventory Adjustment Gain',
                debit: new Prisma.Decimal(0),
                credit: new Prisma.Decimal(200),
                lineNumber: 2,
              },
            ],
          },
        }),
      }),
    );
  });

  it('3. should record negative inventory adjustment and post Debit INVENTORY_ADJUSTMENT_LOSS, Credit INVENTORY_ASSET', async () => {
    prismaMock.fiscalPeriod.findFirst.mockResolvedValue({
      id: 'fp-1',
      status: FiscalPeriodStatus.OPEN,
    });

    prismaMock.journalEntry.create.mockResolvedValue({
      id: 'je-adj-loss-1',
      entryNumber: 'JE-000203',
      status: JournalEntryStatus.POSTED,
    });

    const result = await service.recordAdjustment(
      mockOrgId,
      {
        itemId: 'item-1',
        locationId: 'loc-1',
        movementType: StockMovementType.ADJUSTMENT_OUT,
        quantity: 2,
        reason: 'Damaged in warehouse',
        postToGl: true,
      },
      mockUserId,
    );

    expect(result.totalCost.toString()).toBe('80');
    expect(result.journalEntryId).toBe('je-adj-loss-1');

    expect(prismaMock.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lines: {
            create: [
              {
                organizationId: mockOrgId,
                accountId: 'inventory_adjustment_loss-acc-id',
                description: 'Inventory Adjustment Loss',
                debit: new Prisma.Decimal(80),
                credit: new Prisma.Decimal(0),
                lineNumber: 1,
              },
              {
                organizationId: mockOrgId,
                accountId: 'inventory_asset-acc-id',
                description: 'Inventory Asset reduction',
                debit: new Prisma.Decimal(0),
                credit: new Prisma.Decimal(80),
                lineNumber: 2,
              },
            ],
          },
        }),
      }),
    );
  });

  it('4. should record customer return restock and post Debit INVENTORY_ASSET, Credit COGS', async () => {
    prismaMock.fiscalPeriod.findFirst.mockResolvedValue({
      id: 'fp-1',
      status: FiscalPeriodStatus.OPEN,
    });

    prismaMock.journalEntry.create.mockResolvedValue({
      id: 'je-ret-1',
      entryNumber: 'JE-000204',
      status: JournalEntryStatus.POSTED,
    });

    const result = await service.recordReturnRestock(
      mockOrgId,
      {
        itemId: 'item-1',
        locationId: 'loc-1',
        quantity: 3,
        unitCost: 40,
        reason: 'Customer returned unopened items',
        postToGl: true,
      },
      mockUserId,
    );

    expect(result.totalCost.toString()).toBe('120');
    expect(result.journalEntryId).toBe('je-ret-1');

    expect(prismaMock.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lines: {
            create: [
              {
                organizationId: mockOrgId,
                accountId: 'inventory_asset-acc-id',
                description: 'Inventory Asset restock',
                debit: new Prisma.Decimal(120),
                credit: new Prisma.Decimal(0),
                lineNumber: 1,
              },
              {
                organizationId: mockOrgId,
                accountId: 'cogs-acc-id',
                description: 'COGS reversal from restock',
                debit: new Prisma.Decimal(0),
                credit: new Prisma.Decimal(120),
                lineNumber: 2,
              },
            ],
          },
        }),
      }),
    );
  });
});
