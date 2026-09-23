import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AccountsService } from './accounts/accounts.service';
import { FiscalPeriodsService } from './periods/fiscal-periods.service';
import { JournalsService } from './journals/journals.service';
import { AccountingPostingService } from './posting/accounting-posting.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { FiscalPeriodStatus } from '@prisma/client';
import { PeriodCloseEngineService } from './periods/period-close-engine.service';

describe('Tenant Accounting Isolation', () => {
  let accountsService: AccountsService;
  let periodsService: FiscalPeriodsService;
  let journalsService: JournalsService;
  let postingService: AccountingPostingService;
  let prismaMock: any;
  let eventBusMock: any;
  let numberingMock: any;

  const tenantA = '11111111-1111-1111-1111-111111111111';
  const userA = 'user-a';

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn((callback) => callback(prismaMock)),
      account: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      fiscalPeriod: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      journalEntry: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      journalLine: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    eventBusMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    numberingMock = {
      nextNumber: jest.fn().mockResolvedValue({
        sequenceKey: 'JOURNAL_ENTRY',
        number: 1,
        formatted: 'JE-000001',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        FiscalPeriodsService,
        JournalsService,
        AccountingPostingService,
        {
          provide: PeriodCloseEngineService,
          useValue: {
            evaluateAllChecks: jest.fn().mockResolvedValue({
              status: 'PASSED',
              canClose: true,
              checks: [],
            }),
          },
        },
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
        { provide: NumberingService, useValue: numberingMock },
      ],
    }).compile();

    accountsService = module.get<AccountsService>(AccountsService);
    periodsService = module.get<FiscalPeriodsService>(FiscalPeriodsService);
    journalsService = module.get<JournalsService>(JournalsService);
    postingService = module.get<AccountingPostingService>(
      AccountingPostingService,
    );
  });

  it("1. Tenant A cannot see Tenant B's Account", async () => {
    prismaMock.account.findFirst.mockResolvedValue(null);

    await expect(
      accountsService.findOne(tenantA, 'tenant-b-account-id'),
    ).rejects.toThrow(NotFoundException);
  });

  it("2. Tenant A cannot update Tenant B's Account", async () => {
    prismaMock.account.findFirst.mockResolvedValue(null);

    await expect(
      accountsService.update(tenantA, 'tenant-b-account-id', {
        name: 'Hacked Account',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it("3. Tenant A cannot soft-delete Tenant B's Account", async () => {
    prismaMock.account.findFirst.mockResolvedValue(null);

    await expect(
      accountsService.softDelete(tenantA, 'tenant-b-account-id'),
    ).rejects.toThrow(NotFoundException);
  });

  it("4. Tenant A cannot see Tenant B's Fiscal Period", async () => {
    prismaMock.fiscalPeriod.findFirst.mockResolvedValue(null);

    await expect(
      periodsService.findOne(tenantA, 'tenant-b-period-id'),
    ).rejects.toThrow(NotFoundException);
  });

  it("5. Tenant A cannot close Tenant B's Fiscal Period", async () => {
    prismaMock.fiscalPeriod.findFirst.mockResolvedValue(null);

    await expect(
      periodsService.close(tenantA, 'tenant-b-period-id', userA),
    ).rejects.toThrow(NotFoundException);
  });

  it("6. Tenant A cannot create a Journal using Tenant B's Fiscal Period", async () => {
    prismaMock.fiscalPeriod.findFirst.mockResolvedValue(null); // Not found for Tenant A

    await expect(
      journalsService.create(
        tenantA,
        {
          fiscalPeriodId: 'tenant-b-period-id',
          entryDate: '2026-01-15',
          lines: [
            { accountId: 'tenant-a-acc-1', debit: 100 },
            { accountId: 'tenant-a-acc-2', credit: 100 },
          ],
        },
        userA,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it("7. Tenant A cannot create a Journal line targeting Tenant B's Account", async () => {
    prismaMock.fiscalPeriod.findFirst.mockResolvedValue({
      id: 'period-1',
      name: 'FY2026-Q1',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-03-31'),
      status: FiscalPeriodStatus.OPEN,
    });

    prismaMock.account.findFirst.mockResolvedValue(null); // Account not found in Tenant A

    await expect(
      journalsService.create(
        tenantA,
        {
          fiscalPeriodId: 'period-1',
          entryDate: '2026-01-15',
          lines: [
            { accountId: 'tenant-b-account-id', debit: 100 },
            { accountId: 'tenant-a-account-id', credit: 100 },
          ],
        },
        userA,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it("8. Tenant A cannot see Tenant B's Journal Entry", async () => {
    prismaMock.journalEntry.findFirst.mockResolvedValue(null);

    await expect(
      journalsService.findOne(tenantA, 'tenant-b-journal-id'),
    ).rejects.toThrow(NotFoundException);
  });

  it("9. Tenant A cannot post Tenant B's Journal Entry", async () => {
    prismaMock.journalEntry.findFirst.mockResolvedValue(null);

    await expect(
      postingService.post(tenantA, 'tenant-b-journal-id', userA),
    ).rejects.toThrow(NotFoundException);
  });

  it("10. Tenant A cannot reverse Tenant B's Journal Entry", async () => {
    prismaMock.journalEntry.findFirst.mockResolvedValue(null);

    await expect(
      journalsService.reverse(tenantA, 'tenant-b-journal-id', userA),
    ).rejects.toThrow(NotFoundException);
  });
});
