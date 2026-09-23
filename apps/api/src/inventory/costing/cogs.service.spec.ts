import { Test, TestingModule } from '@nestjs/testing';
import { CogsService } from './cogs.service';
import { InventoryValuationService } from './inventory-valuation.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { ApAccountMappingService } from '../../ap/account-mapping/ap-account-mapping.service';
import { Prisma, FiscalPeriodStatus, JournalEntryStatus } from '@prisma/client';

describe('CogsService', () => {
  let service: CogsService;
  let prismaMock: any;
  let eventBusMock: any;
  let numberingMock: any;
  let mappingMock: any;
  let valuationMock: any;

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
      costOfGoodsSoldRecord: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({
          _sum: {
            quantity: new Prisma.Decimal(0),
            totalCost: new Prisma.Decimal(0),
          },
        }),
      },
    };

    eventBusMock = { publish: jest.fn().mockResolvedValue(undefined) };
    numberingMock = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'JE-000101' }),
    };
    mappingMock = {
      resolveAccount: jest.fn((_orgId, key) => {
        if (key === 'COGS') return 'cogs-acc-id';
        if (key === 'INVENTORY_ASSET') return 'inventory-asset-acc-id';
        return 'fallback-acc-id';
      }),
    };
    valuationMock = {
      processOutbound: jest.fn().mockResolvedValue({
        unitCost: new Prisma.Decimal(50),
        totalCost: new Prisma.Decimal(250),
        quantityIssued: new Prisma.Decimal(5),
        valuation: {},
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CogsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
        { provide: NumberingService, useValue: numberingMock },
        { provide: ApAccountMappingService, useValue: mappingMock },
        { provide: InventoryValuationService, useValue: valuationMock },
      ],
    }).compile();

    service = module.get<CogsService>(CogsService);
  });

  it('1. should record COGS and post double-entry General Ledger journal', async () => {
    prismaMock.fiscalPeriod.findFirst.mockResolvedValue({
      id: 'fp-1',
      status: FiscalPeriodStatus.OPEN,
    });

    prismaMock.journalEntry.create.mockResolvedValue({
      id: 'je-1',
      entryNumber: 'JE-000101',
      status: JournalEntryStatus.POSTED,
    });

    prismaMock.costOfGoodsSoldRecord.create.mockImplementation((args: any) => ({
      id: 'cogs-1',
      ...args.data,
    }));

    const result = await service.recordAndPostCogs(
      mockOrgId,
      {
        itemId: 'item-1',
        locationId: 'loc-1',
        quantity: 5,
        sourceDocument: 'DELIVERY_ORDER',
        sourceDocumentId: 'do-100',
        postToGl: true,
      },
      mockUserId,
    );

    expect(result.cogsRecord.id).toBe('cogs-1');
    expect(result.totalCost.toString()).toBe('250');
    expect(result.unitCost.toString()).toBe('50');

    // Verify journal entry lines: Debit COGS $250, Credit INVENTORY_ASSET $250
    expect(prismaMock.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: mockOrgId,
          fiscalPeriodId: 'fp-1',
          lines: {
            create: [
              {
                organizationId: mockOrgId,
                accountId: 'cogs-acc-id',
                description: 'COGS - DELIVERY_ORDER',
                debit: new Prisma.Decimal(250),
                credit: new Prisma.Decimal(0),
                lineNumber: 1,
              },
              {
                organizationId: mockOrgId,
                accountId: 'inventory-asset-acc-id',
                description: 'Inventory Asset reduction - DELIVERY_ORDER',
                debit: new Prisma.Decimal(0),
                credit: new Prisma.Decimal(250),
                lineNumber: 2,
              },
            ],
          },
        }),
      }),
    );
  });
});
