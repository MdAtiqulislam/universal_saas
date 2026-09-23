import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AccountsService } from './accounts/accounts.service';
import { FiscalPeriodsService } from './periods/fiscal-periods.service';
import { JournalsService } from './journals/journals.service';
import { AccountingPostingService } from './posting/accounting-posting.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import {
  AccountType,
  FiscalPeriodStatus,
  JournalEntryStatus,
  Prisma,
} from '@prisma/client';
import { PeriodCloseEngineService } from './periods/period-close-engine.service';

describe('Accounting Integrity & End-to-End Bookkeeping Flows', () => {
  let accountsService: AccountsService;
  let periodsService: FiscalPeriodsService;
  let journalsService: JournalsService;
  let postingService: AccountingPostingService;
  let prismaMock: any;
  let eventBusMock: any;
  let numberingMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockUserId = '22222222-2222-2222-2222-222222222222';

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn((callback) => callback(prismaMock)),
      account: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      fiscalPeriod: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
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

  it('Flow A: Create Accounts -> Create Period -> Create Journal -> Post Journal (End-to-End Success)', async () => {
    const accCashId = 'acc-cash';
    const accRevenueId = 'acc-rev';
    const periodId = 'period-q1';
    const journalId = 'journal-1';

    // 1. Create Accounts
    prismaMock.account.findFirst.mockResolvedValue(null);
    prismaMock.account.create
      .mockResolvedValueOnce({
        id: accCashId,
        organizationId: mockOrgId,
        code: '1010',
        name: 'Cash',
        type: AccountType.ASSET,
      })
      .mockResolvedValueOnce({
        id: accRevenueId,
        organizationId: mockOrgId,
        code: '4010',
        name: 'Sales Revenue',
        type: AccountType.REVENUE,
      });

    const cashAcc = await accountsService.create(mockOrgId, {
      code: '1010',
      name: 'Cash',
      type: AccountType.ASSET,
    });
    const revAcc = await accountsService.create(mockOrgId, {
      code: '4010',
      name: 'Sales Revenue',
      type: AccountType.REVENUE,
    });

    expect(cashAcc.code).toBe('1010');
    expect(revAcc.code).toBe('4010');

    // 2. Create Fiscal Period
    prismaMock.fiscalPeriod.findFirst.mockResolvedValue(null);
    prismaMock.fiscalPeriod.create.mockResolvedValue({
      id: periodId,
      organizationId: mockOrgId,
      name: 'FY2026-Q1',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-03-31'),
      status: FiscalPeriodStatus.OPEN,
    });

    const period = await periodsService.create(mockOrgId, {
      name: 'FY2026-Q1',
      startDate: '2026-01-01',
      endDate: '2026-03-31',
    });
    expect(period.name).toBe('FY2026-Q1');

    // 3. Create Draft Journal
    prismaMock.fiscalPeriod.findFirst.mockResolvedValue(period);
    prismaMock.account.findFirst
      .mockResolvedValueOnce({
        id: accCashId,
        code: '1010',
        name: 'Cash',
        isActive: true,
      })
      .mockResolvedValueOnce({
        id: accRevenueId,
        code: '4010',
        name: 'Sales',
        isActive: true,
      });

    prismaMock.journalEntry.create.mockResolvedValue({
      id: journalId,
      entryNumber: 'JE-000001',
    });
    prismaMock.journalEntry.findUniqueOrThrow.mockResolvedValue({
      id: journalId,
      entryNumber: 'JE-000001',
      status: JournalEntryStatus.DRAFT,
      fiscalPeriod: period,
      lines: [],
    });

    const draft = await journalsService.create(
      mockOrgId,
      {
        fiscalPeriodId: periodId,
        entryDate: '2026-01-15',
        description: 'Invoice payment received',
        lines: [
          { accountId: accCashId, debit: 1200.75, credit: 0 },
          { accountId: accRevenueId, debit: 0, credit: 1200.75 },
        ],
      },
      mockUserId,
    );
    expect(draft.status).toBe(JournalEntryStatus.DRAFT);

    // 4. Post Journal Entry
    prismaMock.journalEntry.findFirst.mockResolvedValue({
      id: journalId,
      organizationId: mockOrgId,
      entryNumber: 'JE-000001',
      entryDate: new Date('2026-01-15'),
      status: JournalEntryStatus.DRAFT,
      fiscalPeriod: period,
      lines: [
        {
          id: 'line-1',
          accountId: accCashId,
          debit: new Prisma.Decimal('1200.7500'),
          credit: new Prisma.Decimal('0.0000'),
          lineNumber: 1,
          account: {
            organizationId: mockOrgId,
            code: '1010',
            name: 'Cash',
            isActive: true,
            deletedAt: null,
          },
        },
        {
          id: 'line-2',
          accountId: accRevenueId,
          debit: new Prisma.Decimal('0.0000'),
          credit: new Prisma.Decimal('1200.7500'),
          lineNumber: 2,
          account: {
            organizationId: mockOrgId,
            code: '4010',
            name: 'Sales',
            isActive: true,
            deletedAt: null,
          },
        },
      ],
    });

    prismaMock.journalEntry.update.mockResolvedValue({
      id: journalId,
      entryNumber: 'JE-000001',
      status: JournalEntryStatus.POSTED,
      postedAt: new Date(),
      postedByUserId: mockUserId,
      fiscalPeriod: period,
      lines: [],
    });

    const posted = await postingService.post(mockOrgId, journalId, mockUserId);
    expect(posted.status).toBe(JournalEntryStatus.POSTED);
  });

  it('Flow B: Attempt Unbalanced Multi-Line Posting -> Expect BadRequestException', async () => {
    const journalId = 'unbalanced-journal';

    prismaMock.journalEntry.findFirst.mockResolvedValue({
      id: journalId,
      organizationId: mockOrgId,
      entryNumber: 'JE-000002',
      entryDate: new Date('2026-01-15'),
      status: JournalEntryStatus.DRAFT,
      fiscalPeriod: {
        id: 'p1',
        name: 'FY2026-Q1',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-03-31'),
        status: FiscalPeriodStatus.OPEN,
      },
      lines: [
        {
          debit: new Prisma.Decimal('100.0000'),
          credit: new Prisma.Decimal('0.0000'),
          account: {
            organizationId: mockOrgId,
            isActive: true,
            deletedAt: null,
          },
        },
        {
          debit: new Prisma.Decimal('0.0000'),
          credit: new Prisma.Decimal('50.0000'),
          account: {
            organizationId: mockOrgId,
            isActive: true,
            deletedAt: null,
          },
        },
        {
          debit: new Prisma.Decimal('0.0000'),
          credit: new Prisma.Decimal('40.0000'), // 50 + 40 = 90 != 100
          account: {
            organizationId: mockOrgId,
            isActive: true,
            deletedAt: null,
          },
        },
      ],
    });

    await expect(
      postingService.post(mockOrgId, journalId, mockUserId),
    ).rejects.toThrow(BadRequestException);
  });

  it('Flow C: Multi-Line Exact Decimal Parity Check (1 Debit = Multiple Credits)', async () => {
    const journalId = 'multi-line-journal';

    // 1 Debit line: 100.3333, 3 Credit lines: 33.4444 + 33.4444 + 33.4445 = 100.3333
    prismaMock.journalEntry.findFirst.mockResolvedValue({
      id: journalId,
      organizationId: mockOrgId,
      entryNumber: 'JE-000003',
      entryDate: new Date('2026-01-15'),
      status: JournalEntryStatus.DRAFT,
      fiscalPeriod: {
        id: 'p1',
        name: 'FY2026-Q1',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-03-31'),
        status: FiscalPeriodStatus.OPEN,
      },
      lines: [
        {
          debit: new Prisma.Decimal('100.3333'),
          credit: new Prisma.Decimal('0.0000'),
          account: {
            organizationId: mockOrgId,
            isActive: true,
            deletedAt: null,
          },
        },
        {
          debit: new Prisma.Decimal('0.0000'),
          credit: new Prisma.Decimal('33.4444'),
          account: {
            organizationId: mockOrgId,
            isActive: true,
            deletedAt: null,
          },
        },
        {
          debit: new Prisma.Decimal('0.0000'),
          credit: new Prisma.Decimal('33.4444'),
          account: {
            organizationId: mockOrgId,
            isActive: true,
            deletedAt: null,
          },
        },
        {
          debit: new Prisma.Decimal('0.0000'),
          credit: new Prisma.Decimal('33.4445'),
          account: {
            organizationId: mockOrgId,
            isActive: true,
            deletedAt: null,
          },
        },
      ],
    });

    prismaMock.journalEntry.update.mockResolvedValue({
      id: journalId,
      status: JournalEntryStatus.POSTED,
      fiscalPeriod: { name: 'FY2026-Q1' },
      lines: [],
    });

    const posted = await postingService.post(mockOrgId, journalId, mockUserId);
    expect(posted.status).toBe(JournalEntryStatus.POSTED);
  });
});
