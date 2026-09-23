import { Test, TestingModule } from '@nestjs/testing';
import { ReceivablesService } from './receivables.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { CustomerInvoiceStatus, Prisma } from '@prisma/client';

describe('ReceivablesService', () => {
  let service: ReceivablesService;
  let prismaMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockCustomerId = '22222222-2222-2222-2222-222222222222';

  beforeEach(async () => {
    prismaMock = {
      customer: { findFirst: jest.fn() },
      customerInvoice: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReceivablesService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<ReceivablesService>(ReceivablesService);
  });

  it('1. should compute customer AR balance with exact totals and overdue balances', async () => {
    prismaMock.customer.findFirst.mockResolvedValue({
      id: mockCustomerId,
      code: 'CUST-001',
      name: 'Acme Client',
      currencyId: 'curr-usd',
      currency: { code: 'USD', symbol: '$' },
    });

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 10);

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);

    prismaMock.customerInvoice.findMany.mockResolvedValue([
      {
        id: 'inv-1',
        status: CustomerInvoiceStatus.ISSUED,
        grandTotal: new Prisma.Decimal('1000.0000'),
        amountPaid: new Prisma.Decimal('0.0000'),
        amountDue: new Prisma.Decimal('1000.0000'),
        dueDate: pastDate, // Overdue
      },
      {
        id: 'inv-2',
        status: CustomerInvoiceStatus.PARTIALLY_PAID,
        grandTotal: new Prisma.Decimal('500.0000'),
        amountPaid: new Prisma.Decimal('200.0000'),
        amountDue: new Prisma.Decimal('300.0000'),
        dueDate: futureDate, // Current
      },
      {
        id: 'inv-3',
        status: CustomerInvoiceStatus.PAID,
        grandTotal: new Prisma.Decimal('400.0000'),
        amountPaid: new Prisma.Decimal('400.0000'),
        amountDue: new Prisma.Decimal('0.0000'),
        dueDate: pastDate, // Paid
      },
    ]);

    const result = await service.getCustomerBalance(mockOrgId, mockCustomerId);

    expect(result.customerCode).toBe('CUST-001');
    expect(result.totalInvoiced).toBe(1900);
    expect(result.totalPaid).toBe(600);
    expect(result.totalDue).toBe(1300);
    expect(result.overdueAmount).toBe(1000);
    expect(result.openInvoiceCount).toBe(2);
  });

  it('2. should generate AR aging report correctly bucketing outstanding balances', async () => {
    const now = new Date();

    const dateCurrent = new Date(now);
    dateCurrent.setDate(dateCurrent.getDate() + 5);

    const date15Days = new Date(now);
    date15Days.setDate(date15Days.getDate() - 15);

    const date45Days = new Date(now);
    date45Days.setDate(date45Days.getDate() - 45);

    const date75Days = new Date(now);
    date75Days.setDate(date75Days.getDate() - 75);

    const date120Days = new Date(now);
    date120Days.setDate(date120Days.getDate() - 120);

    prismaMock.customerInvoice.findMany.mockResolvedValue([
      {
        customerId: 'cust-1',
        customer: { id: 'cust-1', code: 'C1', name: 'Client 1' },
        amountDue: new Prisma.Decimal('1000.0000'),
        dueDate: dateCurrent,
      },
      {
        customerId: 'cust-1',
        customer: { id: 'cust-1', code: 'C1', name: 'Client 1' },
        amountDue: new Prisma.Decimal('500.0000'),
        dueDate: date15Days,
      },
      {
        customerId: 'cust-2',
        customer: { id: 'cust-2', code: 'C2', name: 'Client 2' },
        amountDue: new Prisma.Decimal('300.0000'),
        dueDate: date45Days,
      },
      {
        customerId: 'cust-2',
        customer: { id: 'cust-2', code: 'C2', name: 'Client 2' },
        amountDue: new Prisma.Decimal('200.0000'),
        dueDate: date75Days,
      },
      {
        customerId: 'cust-2',
        customer: { id: 'cust-2', code: 'C2', name: 'Client 2' },
        amountDue: new Prisma.Decimal('100.0000'),
        dueDate: date120Days,
      },
    ]);

    const report = await service.getAgingReport(mockOrgId);

    expect(report.summary.totalCurrent).toBe(1000);
    expect(report.summary.totalDays1to30).toBe(500);
    expect(report.summary.totalDays31to60).toBe(300);
    expect(report.summary.totalDays61to90).toBe(200);
    expect(report.summary.totalDays90Plus).toBe(100);
    expect(report.summary.totalOutstanding).toBe(2100);

    expect(report.customers).toHaveLength(2);
    const c1 = report.customers.find((c) => c.customerId === 'cust-1')!;
    expect(c1.current).toBe(1000);
    expect(c1.days1to30).toBe(500);
    expect(c1.totalDue).toBe(1500);
  });

  it('3. should throw NotFoundException when customer is not in organization', async () => {
    prismaMock.customer.findFirst.mockResolvedValue(null);

    await expect(
      service.getCustomerBalance(mockOrgId, 'invalid-cust'),
    ).rejects.toThrow(NotFoundException);
  });
});
