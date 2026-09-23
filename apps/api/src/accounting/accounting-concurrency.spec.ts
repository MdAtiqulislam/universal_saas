import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AccountingPostingService } from './posting/accounting-posting.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { JournalEntryStatus, FiscalPeriodStatus, Prisma } from '@prisma/client';

describe('Accounting Concurrency', () => {
  let postingService: AccountingPostingService;
  let numberingService: NumberingService;
  let prismaMock: any;
  let eventBusMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockJournalId = '22222222-2222-2222-2222-222222222222';
  const mockUserId = '33333333-3333-3333-3333-333333333333';

  // In-memory atomic state to simulate PostgreSQL row-level locks
  let atomicCounter = 1;
  const lock = {
    locked: false,
    async acquire<T>(fn: () => Promise<T>): Promise<T> {
      while (this.locked) {
        await new Promise((r) => setTimeout(r, 1));
      }
      this.locked = true;
      try {
        return await fn();
      } finally {
        this.locked = false;
      }
    },
  };

  beforeEach(async () => {
    atomicCounter = 1;

    prismaMock = {
      $transaction: jest.fn().mockImplementation(async (cb: any) => {
        return lock.acquire(async () => {
          const current = atomicCounter++;
          const txMock = {
            $queryRaw: jest.fn().mockResolvedValue([
              {
                allocated_number: current,
                prefix: 'JE-',
                padding: 6,
              },
            ]),
            journalEntry: {
              findFirst: prismaMock.journalEntry?.findFirst,
              update: prismaMock.journalEntry?.update,
            },
          };
          return (await cb(txMock)) as unknown;
        });
      }),
      journalEntry: {
        findFirst: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    };

    eventBusMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountingPostingService,
        NumberingService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
      ],
    }).compile();

    postingService = module.get<AccountingPostingService>(
      AccountingPostingService,
    );
    numberingService = module.get<NumberingService>(NumberingService);
  });

  it('1. 100 parallel journal number generations should produce 100 unique sequential numbers without duplicates', async () => {
    const tasks = Array.from({ length: 100 }, () =>
      numberingService.nextNumber(mockOrgId, 'JOURNAL_ENTRY', mockUserId),
    );

    const results = await Promise.all(tasks);
    const formattedNumbers = results.map((r) => r.formatted);
    const uniqueNumbers = new Set(formattedNumbers);

    expect(results.length).toBe(100);
    expect(uniqueNumbers.size).toBe(100);
    expect(formattedNumbers[0]).toBe('JE-000001');
    expect(formattedNumbers[99]).toBe('JE-000100');
  });

  it('2. 100 parallel attempts to post the same journal entry should result in exactly 1 success and 99 failures', async () => {
    let hasBeenPosted = false;

    const baseJournal = {
      id: mockJournalId,
      organizationId: mockOrgId,
      entryNumber: 'JE-000001',
      entryDate: new Date('2026-01-15'),
      get status() {
        return hasBeenPosted
          ? JournalEntryStatus.POSTED
          : JournalEntryStatus.DRAFT;
      },
      fiscalPeriod: {
        id: 'period-1',
        name: 'FY2026-Q1',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-03-31'),
        status: FiscalPeriodStatus.OPEN,
      },
      lines: [
        {
          id: 'line-1',
          accountId: 'acc-1',
          debit: new Prisma.Decimal('100.0000'),
          credit: new Prisma.Decimal('0.0000'),
          lineNumber: 1,
          account: {
            organizationId: mockOrgId,
            code: '1010',
            name: 'Bank',
            isActive: true,
            deletedAt: null,
          },
        },
        {
          id: 'line-2',
          accountId: 'acc-2',
          debit: new Prisma.Decimal('0.0000'),
          credit: new Prisma.Decimal('100.0000'),
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
    };

    prismaMock.journalEntry.findFirst = jest.fn().mockImplementation(() => {
      return Promise.resolve({
        ...baseJournal,
        status: hasBeenPosted
          ? JournalEntryStatus.POSTED
          : JournalEntryStatus.DRAFT,
      });
    });

    prismaMock.journalEntry.update = jest.fn().mockImplementation(() => {
      if (hasBeenPosted) {
        throw new BadRequestException('Double update prevented');
      }
      hasBeenPosted = true;
      return Promise.resolve({
        ...baseJournal,
        status: JournalEntryStatus.POSTED,
        postedAt: new Date(),
        postedByUserId: mockUserId,
      });
    });

    const attempts = Array.from({ length: 100 }, () =>
      postingService
        .post(mockOrgId, mockJournalId, mockUserId)
        .then(() => ({ success: true, error: null as any }))
        .catch((err) => ({ success: false, error: err })),
    );

    const outcomes = await Promise.all(attempts);
    const successes = outcomes.filter((o) => o.success);
    const failures = outcomes.filter((o) => !o.success);

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(99);
    failures.forEach((f) => {
      expect(f.error).toBeInstanceOf(BadRequestException);
    });
  });
});
