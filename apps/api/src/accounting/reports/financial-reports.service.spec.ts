import { Test, TestingModule } from '@nestjs/testing';
import { FinancialReportsService } from './financial-reports.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { AccountType, Prisma } from '@prisma/client';

describe('FinancialReportsService', () => {
  let service: FinancialReportsService;
  let prismaMock: any;
  let eventBusMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockUserId = '22222222-2222-2222-2222-222222222222';

  beforeEach(async () => {
    prismaMock = {
      account: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      fiscalPeriod: {
        findFirst: jest.fn(),
      },
      journalLine: {
        findMany: jest.fn(),
      },
      paymentAccount: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    eventBusMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialReportsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
      ],
    }).compile();

    service = module.get<FinancialReportsService>(FinancialReportsService);
  });

  it('1. should calculate Trial Balance with debits equal to credits', async () => {
    prismaMock.account.findMany.mockResolvedValue([
      {
        id: 'acc-1',
        code: '1010',
        name: 'Cash',
        type: AccountType.ASSET,
      },
      {
        id: 'acc-2',
        code: '4010',
        name: 'Sales Revenue',
        type: AccountType.REVENUE,
      },
    ]);

    // Opening lines: none
    // Period lines: Debit 1000 to Cash, Credit 1000 to Revenue
    prismaMock.journalLine.findMany
      .mockResolvedValueOnce([]) // openingLines
      .mockResolvedValueOnce([
        {
          accountId: 'acc-1',
          debit: new Prisma.Decimal('1000.0000'),
          credit: new Prisma.Decimal('0.0000'),
        },
        {
          accountId: 'acc-2',
          debit: new Prisma.Decimal('0.0000'),
          credit: new Prisma.Decimal('1000.0000'),
        },
      ]); // periodLines

    const result = await service.getTrialBalance(
      mockOrgId,
      {
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      },
      mockUserId,
    );

    expect(result.summary.isBalanced).toBe(true);
    expect(result.summary.totalClosingDebit).toBe('1000.0000');
    expect(result.summary.totalClosingCredit).toBe('1000.0000');
    expect(result.accounts.length).toBe(2);
    expect(result.accounts[0].netBalance).toBe('1000.0000');
    expect(result.accounts[1].netBalance).toBe('1000.0000');
  });

  it('2. should calculate General Ledger running balance according to account type', async () => {
    prismaMock.account.findFirst.mockResolvedValue({
      id: 'acc-1',
      code: '1010',
      name: 'Cash',
      type: AccountType.ASSET,
    });

    // Opening lines: Prior debit 500
    prismaMock.journalLine.findMany
      .mockResolvedValueOnce([
        {
          debit: new Prisma.Decimal('500.0000'),
          credit: new Prisma.Decimal('0.0000'),
        },
      ]) // priorLines
      .mockResolvedValueOnce([
        {
          id: 'line-1',
          debit: new Prisma.Decimal('300.0000'),
          credit: new Prisma.Decimal('0.0000'),
          lineNumber: 1,
          description: 'Customer Receipt',
          journalEntry: {
            id: 'je-1',
            entryNumber: 'JE-000001',
            entryDate: new Date('2026-08-01'),
            sourceType: 'PAYMENT',
            sourceId: 'pay-1',
            createdAt: new Date(),
          },
          account: {
            id: 'acc-1',
            code: '1010',
            name: 'Cash',
            type: AccountType.ASSET,
          },
        },
        {
          id: 'line-2',
          debit: new Prisma.Decimal('0.0000'),
          credit: new Prisma.Decimal('100.0000'),
          lineNumber: 2,
          description: 'Office Supplies',
          journalEntry: {
            id: 'je-2',
            entryNumber: 'JE-000002',
            entryDate: new Date('2026-08-02'),
            sourceType: 'PAYMENT',
            sourceId: 'pay-2',
            createdAt: new Date(),
          },
          account: {
            id: 'acc-1',
            code: '1010',
            name: 'Cash',
            type: AccountType.ASSET,
          },
        },
      ]); // periodLines

    const result = await service.getGeneralLedger(
      mockOrgId,
      {
        accountId: 'acc-1',
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      },
      mockUserId,
    );

    expect(result.openingBalance).toBe('500.0000');
    expect(result.lines[0].runningBalance).toBe('800.0000'); // 500 + 300
    expect(result.lines[1].runningBalance).toBe('700.0000'); // 800 - 100
    expect(result.closingBalance).toBe('700.0000');
  });

  it('3. should calculate Balance Sheet ensuring Assets = Liabilities + Equity', async () => {
    prismaMock.account.findMany.mockResolvedValue([
      { id: 'acc-asset', code: '1010', name: 'Bank', type: AccountType.ASSET },
      {
        id: 'acc-liab',
        code: '2010',
        name: 'Accounts Payable',
        type: AccountType.LIABILITY,
      },
      {
        id: 'acc-eq',
        code: '3010',
        name: 'Common Stock',
        type: AccountType.EQUITY,
      },
      { id: 'acc-rev', code: '4010', name: 'Sales', type: AccountType.REVENUE },
      { id: 'acc-exp', code: '5010', name: 'Rent', type: AccountType.EXPENSE },
    ]);

    prismaMock.journalLine.findMany.mockResolvedValue([
      {
        accountId: 'acc-asset',
        debit: new Prisma.Decimal('10000.0000'),
        credit: new Prisma.Decimal('0.0000'),
      },
      {
        accountId: 'acc-liab',
        debit: new Prisma.Decimal('0.0000'),
        credit: new Prisma.Decimal('2000.0000'),
      },
      {
        accountId: 'acc-eq',
        debit: new Prisma.Decimal('0.0000'),
        credit: new Prisma.Decimal('5000.0000'),
      },
      {
        accountId: 'acc-rev',
        debit: new Prisma.Decimal('0.0000'),
        credit: new Prisma.Decimal('4000.0000'),
      },
      {
        accountId: 'acc-exp',
        debit: new Prisma.Decimal('1000.0000'),
        credit: new Prisma.Decimal('0.0000'),
      },
    ]);

    const result = await service.getBalanceSheet(
      mockOrgId,
      { asOfDate: '2026-12-31' },
      mockUserId,
    );

    // Assets: 10000
    // Liabilities: 2000
    // Equity accounts: 5000
    // Net income: 4000 (Rev) - 1000 (Exp) = 3000
    // Total Equity: 5000 + 3000 = 8000
    // Liabilities + Equity: 2000 + 8000 = 10000
    expect(result.summary.totalAssets).toBe('10000.0000');
    expect(result.summary.totalLiabilitiesAndEquity).toBe('10000.0000');
    expect(result.summary.isBalanced).toBe(true);
  });

  it('4. should calculate Income Statement (Revenue - Expenses = Net Income)', async () => {
    prismaMock.account.findMany.mockResolvedValue([
      { id: 'acc-rev', code: '4010', name: 'Sales', type: AccountType.REVENUE },
      {
        id: 'acc-exp',
        code: '5010',
        name: 'Salaries',
        type: AccountType.EXPENSE,
      },
    ]);

    prismaMock.journalLine.findMany.mockResolvedValue([
      {
        accountId: 'acc-rev',
        debit: new Prisma.Decimal('0.0000'),
        credit: new Prisma.Decimal('15000.0000'),
      },
      {
        accountId: 'acc-exp',
        debit: new Prisma.Decimal('6000.0000'),
        credit: new Prisma.Decimal('0.0000'),
      },
    ]);

    const result = await service.getIncomeStatement(
      mockOrgId,
      { startDate: '2026-01-01', endDate: '2026-12-31' },
      mockUserId,
    );

    expect(result.summary.totalRevenue).toBe('15000.0000');
    expect(result.summary.totalExpenses).toBe('6000.0000');
    expect(result.summary.netIncome).toBe('9000.0000');
  });

  it('5. should calculate Cash Flow foundation and net change in cash', async () => {
    prismaMock.account.findMany.mockResolvedValue([
      {
        id: 'acc-cash',
        code: '1010',
        name: 'Cash on Hand',
        type: AccountType.ASSET,
      },
    ]);

    prismaMock.paymentAccount.findMany.mockResolvedValue([
      { accountingAccountId: 'acc-cash' },
    ]);

    // Prior lines (Opening cash = 2000)
    // Period lines (Debit 5000 Operating, Credit 1000 Operating)
    prismaMock.journalLine.findMany
      .mockResolvedValueOnce([
        {
          debit: new Prisma.Decimal('2000.0000'),
          credit: new Prisma.Decimal('0.0000'),
        },
      ]) // priorCashLines
      .mockResolvedValueOnce([
        {
          debit: new Prisma.Decimal('5000.0000'),
          credit: new Prisma.Decimal('1000.0000'),
          description: 'Customer Collection',
          journalEntry: {
            entryNumber: 'JE-000010',
            description: 'Daily receipts',
            sourceType: 'PAYMENT',
          },
        },
      ]); // periodCashLines

    const result = await service.getCashFlow(
      mockOrgId,
      { startDate: '2026-08-01', endDate: '2026-08-31' },
      mockUserId,
    );

    expect(result.summary.openingCash).toBe('2000.0000');
    expect(result.summary.netCashChange).toBe('4000.0000');
    expect(result.summary.closingCash).toBe('6000.0000');
  });

  it('6. should calculate Executive Financial KPIs and profitability/liquidity ratios', async () => {
    prismaMock.account.findMany.mockResolvedValue([
      { id: 'acc-cash', code: '1010', name: 'Cash', type: AccountType.ASSET },
      { id: 'acc-rev', code: '4010', name: 'Sales', type: AccountType.REVENUE },
      { id: 'acc-cogs', code: '5010', name: 'COGS', type: AccountType.EXPENSE },
    ]);

    prismaMock.journalLine.findMany
      .mockResolvedValueOnce([
        {
          accountId: 'acc-rev',
          debit: new Prisma.Decimal('0'),
          credit: new Prisma.Decimal('10000'),
        },
        {
          accountId: 'acc-cogs',
          debit: new Prisma.Decimal('4000'),
          credit: new Prisma.Decimal('0'),
        },
      ]) // income statement lines (1 call)
      .mockResolvedValueOnce([]) // bs prior lines (call 2)
      .mockResolvedValueOnce([
        {
          accountId: 'acc-cash',
          debit: new Prisma.Decimal('6000'),
          credit: new Prisma.Decimal('0'),
        },
      ]); // bs period lines (call 3)

    const kpis = await service.getFinancialKpis(
      mockOrgId,
      { startDate: '2026-01-01', endDate: '2026-03-31' },
      mockUserId,
    );

    expect(kpis.profitability.revenue).toBe('10000.00');
    expect(kpis.profitability.cogs).toBe('4000.00');
    expect(kpis.profitability.grossProfit).toBe('6000.00');
    expect(kpis.profitability.grossMarginPercent).toBe('60.00');
  });

  it('7. should create immutable financial report snapshot with SHA-256 checksum', async () => {
    prismaMock.financialReportSnapshot = {
      create: jest
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve({ id: 'snap-1', ...data }),
        ),
      findMany: jest.fn().mockResolvedValue([]),
    };

    const snapshot = await service.createSnapshot(
      mockOrgId,
      {
        reportType: 'TRIAL_BALANCE',
        reportData: { test: 'data' },
      },
      mockUserId,
    );

    expect(snapshot.id).toBe('snap-1');
    expect(snapshot.checksum).toBeDefined();
    expect(snapshot.checksum?.length).toBe(64);
    expect(snapshot.isImmutable).toBe(true);
  });
});
