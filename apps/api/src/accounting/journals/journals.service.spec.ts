import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { JournalsService } from './journals.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { JournalEntryStatus, FiscalPeriodStatus, Prisma } from '@prisma/client';

describe('JournalsService', () => {
  let service: JournalsService;
  let prismaMock: any;
  let eventBusMock: any;
  let numberingMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockPeriodId = '22222222-2222-2222-2222-222222222222';
  const mockJournalId = '33333333-3333-3333-3333-333333333333';
  const mockAccountDebitId = '44444444-4444-4444-4444-444444444444';
  const mockAccountCreditId = '55555555-5555-5555-5555-555555555555';
  const mockUserId = '66666666-6666-6666-6666-666666666666';

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn((callback) => callback(prismaMock)),
      journalEntry: {
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      journalLine: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      fiscalPeriod: {
        findFirst: jest.fn(),
      },
      account: {
        findFirst: jest.fn(),
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
        JournalsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
        { provide: NumberingService, useValue: numberingMock },
      ],
    }).compile();

    service = module.get<JournalsService>(JournalsService);
  });

  it('1. should create draft journal entry with auto-numbering', async () => {
    prismaMock.fiscalPeriod.findFirst.mockResolvedValue({
      id: mockPeriodId,
      name: 'FY2026-Q1',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-03-31'),
      status: FiscalPeriodStatus.OPEN,
    });

    prismaMock.account.findFirst
      .mockResolvedValueOnce({
        id: mockAccountDebitId,
        code: '1010',
        name: 'Cash',
        isActive: true,
      })
      .mockResolvedValueOnce({
        id: mockAccountCreditId,
        code: '4010',
        name: 'Sales',
        isActive: true,
      });

    prismaMock.journalEntry.create.mockResolvedValue({
      id: mockJournalId,
      entryNumber: 'JE-000001',
    });

    prismaMock.journalEntry.findUniqueOrThrow.mockResolvedValue({
      id: mockJournalId,
      entryNumber: 'JE-000001',
      status: JournalEntryStatus.DRAFT,
      fiscalPeriod: { name: 'FY2026-Q1' },
      lines: [],
    });

    const result = await service.create(
      mockOrgId,
      {
        fiscalPeriodId: mockPeriodId,
        entryDate: '2026-01-15',
        description: 'Customer payment',
        lines: [
          { accountId: mockAccountDebitId, debit: 500, credit: 0 },
          { accountId: mockAccountCreditId, debit: 0, credit: 500 },
        ],
      },
      mockUserId,
    );

    expect(result.entryNumber).toBe('JE-000001');
    expect(result.status).toBe(JournalEntryStatus.DRAFT);
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'JOURNAL_CREATED',
      }),
    );
  });

  it('2. should reject journal creation in a closed fiscal period', async () => {
    prismaMock.fiscalPeriod.findFirst.mockResolvedValue({
      id: mockPeriodId,
      name: 'FY2025-Q4',
      status: FiscalPeriodStatus.CLOSED,
    });

    await expect(
      service.create(
        mockOrgId,
        {
          fiscalPeriodId: mockPeriodId,
          entryDate: '2025-12-31',
          lines: [
            { accountId: mockAccountDebitId, debit: 100 },
            { accountId: mockAccountCreditId, credit: 100 },
          ],
        },
        mockUserId,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('3. should reject journal creation with date outside period bounds', async () => {
    prismaMock.fiscalPeriod.findFirst.mockResolvedValue({
      id: mockPeriodId,
      name: 'FY2026-Q1',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-03-31'),
      status: FiscalPeriodStatus.OPEN,
    });

    await expect(
      service.create(
        mockOrgId,
        {
          fiscalPeriodId: mockPeriodId,
          entryDate: '2026-04-15', // Outside Q1
          lines: [
            { accountId: mockAccountDebitId, debit: 100 },
            { accountId: mockAccountCreditId, credit: 100 },
          ],
        },
        mockUserId,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('4. should reject journal line with both debit and credit > 0 (XOR violation)', async () => {
    prismaMock.fiscalPeriod.findFirst.mockResolvedValue({
      id: mockPeriodId,
      name: 'FY2026-Q1',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-03-31'),
      status: FiscalPeriodStatus.OPEN,
    });

    await expect(
      service.create(
        mockOrgId,
        {
          fiscalPeriodId: mockPeriodId,
          entryDate: '2026-01-15',
          lines: [
            { accountId: mockAccountDebitId, debit: 100, credit: 50 }, // Invalid!
            { accountId: mockAccountCreditId, credit: 50 },
          ],
        },
        mockUserId,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('5. should reject journal line with both debit and credit == 0', async () => {
    prismaMock.fiscalPeriod.findFirst.mockResolvedValue({
      id: mockPeriodId,
      name: 'FY2026-Q1',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-03-31'),
      status: FiscalPeriodStatus.OPEN,
    });

    await expect(
      service.create(
        mockOrgId,
        {
          fiscalPeriodId: mockPeriodId,
          entryDate: '2026-01-15',
          lines: [
            { accountId: mockAccountDebitId, debit: 0, credit: 0 },
            { accountId: mockAccountCreditId, credit: 100 },
          ],
        },
        mockUserId,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('6. should reject journal entry with fewer than 2 lines', async () => {
    prismaMock.fiscalPeriod.findFirst.mockResolvedValue({
      id: mockPeriodId,
      name: 'FY2026-Q1',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-03-31'),
      status: FiscalPeriodStatus.OPEN,
    });

    await expect(
      service.create(
        mockOrgId,
        {
          fiscalPeriodId: mockPeriodId,
          entryDate: '2026-01-15',
          lines: [{ accountId: mockAccountDebitId, debit: 100 }],
        },
        mockUserId,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('7. should reject updating a non-draft journal entry', async () => {
    prismaMock.journalEntry.findFirst.mockResolvedValue({
      id: mockJournalId,
      status: JournalEntryStatus.POSTED,
    });

    await expect(
      service.update(
        mockOrgId,
        mockJournalId,
        { description: 'Modified description' },
        mockUserId,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('8. should reverse a posted journal entry by creating a compensating entry with flipped lines', async () => {
    numberingMock.nextNumber.mockResolvedValue({
      sequenceKey: 'JOURNAL_ENTRY',
      number: 2,
      formatted: 'JE-000002',
    });

    prismaMock.fiscalPeriod.findFirst.mockResolvedValue({
      id: mockPeriodId,
      name: 'FY2026-Q1',
      status: FiscalPeriodStatus.OPEN,
    });

    prismaMock.journalEntry.findFirst.mockResolvedValue({
      id: mockJournalId,
      organizationId: mockOrgId,
      entryNumber: 'JE-000001',
      status: JournalEntryStatus.POSTED,
      fiscalPeriodId: mockPeriodId,
      description: 'Original Payment',
      fiscalPeriod: {
        id: mockPeriodId,
        name: 'FY2026-Q1',
        status: FiscalPeriodStatus.OPEN,
      },
      lines: [
        {
          id: 'line-1',
          accountId: mockAccountDebitId,
          debit: new Prisma.Decimal('500.0000'),
          credit: new Prisma.Decimal('0.0000'),
          lineNumber: 1,
          description: 'Cash',
        },
        {
          id: 'line-2',
          accountId: mockAccountCreditId,
          debit: new Prisma.Decimal('0.0000'),
          credit: new Prisma.Decimal('500.0000'),
          lineNumber: 2,
          description: 'Revenue',
        },
      ],
    });

    prismaMock.journalEntry.create.mockResolvedValue({
      id: 'reversal-journal-id',
      entryNumber: 'JE-000002',
    });

    prismaMock.journalEntry.findUniqueOrThrow.mockResolvedValue({
      id: 'reversal-journal-id',
      entryNumber: 'JE-000002',
      status: JournalEntryStatus.POSTED,
      sourceType: 'REVERSAL',
      sourceId: mockJournalId,
    });

    const result = await service.reverse(mockOrgId, mockJournalId, mockUserId);
    expect(result.entryNumber).toBe('JE-000002');
    expect(result.status).toBe(JournalEntryStatus.POSTED);

    // Verify original journal was marked VOIDED
    expect(prismaMock.journalEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: mockJournalId },
        data: { status: JournalEntryStatus.VOIDED },
      }),
    );

    // Verify compensating lines had flipped debits/credits
    expect(prismaMock.journalLine.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            accountId: mockAccountDebitId,
            debit: new Prisma.Decimal('0.0000'), // Swapped from 500 debit
            credit: new Prisma.Decimal('500.0000'), // Swapped to 500 credit
          }),
          expect.objectContaining({
            accountId: mockAccountCreditId,
            debit: new Prisma.Decimal('500.0000'), // Swapped from 500 credit
            credit: new Prisma.Decimal('0.0000'), // Swapped to 0 credit
          }),
        ]),
      }),
    );

    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'JOURNAL_REVERSED',
      }),
    );
  });
});
