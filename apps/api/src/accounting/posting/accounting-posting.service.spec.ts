import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AccountingPostingService } from './accounting-posting.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { JournalEntryStatus, FiscalPeriodStatus, Prisma } from '@prisma/client';

describe('AccountingPostingService', () => {
  let service: AccountingPostingService;
  let prismaMock: any;
  let eventBusMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockJournalId = '22222222-2222-2222-2222-222222222222';
  const mockUserId = '33333333-3333-3333-3333-333333333333';

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn((callback) => callback(prismaMock)),
      journalEntry: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    eventBusMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountingPostingService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
      ],
    }).compile();

    service = module.get<AccountingPostingService>(AccountingPostingService);
  });

  it('1. should successfully post a balanced journal entry', async () => {
    const mockJournal = {
      id: mockJournalId,
      organizationId: mockOrgId,
      entryNumber: 'JE-000001',
      entryDate: new Date('2026-01-15'),
      status: JournalEntryStatus.DRAFT,
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
          debit: new Prisma.Decimal('1250.5000'),
          credit: new Prisma.Decimal('0.0000'),
          lineNumber: 1,
          account: {
            id: 'acc-1',
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
          credit: new Prisma.Decimal('1250.5000'),
          lineNumber: 2,
          account: {
            id: 'acc-2',
            organizationId: mockOrgId,
            code: '4010',
            name: 'Revenue',
            isActive: true,
            deletedAt: null,
          },
        },
      ],
    };

    prismaMock.journalEntry.findFirst.mockResolvedValue(mockJournal);
    prismaMock.journalEntry.update.mockResolvedValue({
      ...mockJournal,
      status: JournalEntryStatus.POSTED,
      postedAt: new Date(),
      postedByUserId: mockUserId,
    });

    const result = await service.post(mockOrgId, mockJournalId, mockUserId);
    expect(result.status).toBe(JournalEntryStatus.POSTED);
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'JOURNAL_POSTED',
      }),
    );
  });

  it('2. should reject posting an unbalanced journal entry', async () => {
    const unbalancedJournal = {
      id: mockJournalId,
      organizationId: mockOrgId,
      entryNumber: 'JE-000001',
      entryDate: new Date('2026-01-15'),
      status: JournalEntryStatus.DRAFT,
      fiscalPeriod: {
        name: 'FY2026-Q1',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-03-31'),
        status: FiscalPeriodStatus.OPEN,
      },
      lines: [
        {
          debit: new Prisma.Decimal('1000.0000'),
          credit: new Prisma.Decimal('0.0000'),
          lineNumber: 1,
          account: {
            organizationId: mockOrgId,
            isActive: true,
            deletedAt: null,
          },
        },
        {
          debit: new Prisma.Decimal('0.0000'),
          credit: new Prisma.Decimal('950.0000'), // 50 difference!
          lineNumber: 2,
          account: {
            organizationId: mockOrgId,
            isActive: true,
            deletedAt: null,
          },
        },
      ],
    };

    prismaMock.journalEntry.findFirst.mockResolvedValue(unbalancedJournal);

    await expect(
      service.post(mockOrgId, mockJournalId, mockUserId),
    ).rejects.toThrow(BadRequestException);
  });

  it('3. should reject posting an already posted journal entry', async () => {
    prismaMock.journalEntry.findFirst.mockResolvedValue({
      id: mockJournalId,
      entryNumber: 'JE-000001',
      status: JournalEntryStatus.POSTED,
    });

    await expect(
      service.post(mockOrgId, mockJournalId, mockUserId),
    ).rejects.toThrow(BadRequestException);
  });

  it('4. should reject posting into a closed fiscal period', async () => {
    prismaMock.journalEntry.findFirst.mockResolvedValue({
      id: mockJournalId,
      entryNumber: 'JE-000001',
      status: JournalEntryStatus.DRAFT,
      fiscalPeriod: {
        name: 'FY2025-Q4',
        status: FiscalPeriodStatus.CLOSED,
      },
      lines: [
        {
          debit: new Prisma.Decimal('100'),
          credit: new Prisma.Decimal('0'),
          account: {
            organizationId: mockOrgId,
            isActive: true,
            deletedAt: null,
          },
        },
        {
          debit: new Prisma.Decimal('0'),
          credit: new Prisma.Decimal('100'),
          account: {
            organizationId: mockOrgId,
            isActive: true,
            deletedAt: null,
          },
        },
      ],
    });

    await expect(
      service.post(mockOrgId, mockJournalId, mockUserId),
    ).rejects.toThrow(BadRequestException);
  });

  it('5. should reject posting with an inactive account', async () => {
    prismaMock.journalEntry.findFirst.mockResolvedValue({
      id: mockJournalId,
      entryNumber: 'JE-000001',
      entryDate: new Date('2026-01-15'),
      status: JournalEntryStatus.DRAFT,
      fiscalPeriod: {
        name: 'FY2026-Q1',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-03-31'),
        status: FiscalPeriodStatus.OPEN,
      },
      lines: [
        {
          debit: new Prisma.Decimal('100'),
          credit: new Prisma.Decimal('0'),
          account: {
            code: '1010',
            name: 'Inactive Bank',
            organizationId: mockOrgId,
            isActive: false, // Inactive!
            deletedAt: null,
          },
        },
        {
          debit: new Prisma.Decimal('0'),
          credit: new Prisma.Decimal('100'),
          account: {
            organizationId: mockOrgId,
            isActive: true,
            deletedAt: null,
          },
        },
      ],
    });

    await expect(
      service.post(mockOrgId, mockJournalId, mockUserId),
    ).rejects.toThrow(BadRequestException);
  });
});
