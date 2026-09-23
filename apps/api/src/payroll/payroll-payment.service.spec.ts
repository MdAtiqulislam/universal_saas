import { Test, TestingModule } from '@nestjs/testing';
import { PayrollPaymentService } from './payroll-payment.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { BadRequestException } from '@nestjs/common';
import {
  Prisma,
  PayrollPeriodStatus,
  PayrollRunStatus,
  PaymentType,
  PaymentStatus,
} from '@prisma/client';

describe('PayrollPaymentService', () => {
  let service: PayrollPaymentService;
  let prisma: {
    payrollPeriod: { findFirst: jest.Mock; update: jest.Mock };
    paymentAccount: { findFirst: jest.Mock; findUniqueOrThrow: jest.Mock };
    payment: { create: jest.Mock };
    payrollRun: { update: jest.Mock };
    payrollEmployee: { updateMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let eventBus: { publish: jest.Mock };
  let numberingService: { nextNumber: jest.Mock };

  const orgId = 'org-101';
  const userId = 'user-101';
  const periodId = 'period-101';

  beforeEach(async () => {
    prisma = {
      payrollPeriod: { findFirst: jest.fn(), update: jest.fn() },
      paymentAccount: { findFirst: jest.fn(), findUniqueOrThrow: jest.fn() },
      payment: { create: jest.fn() },
      payrollRun: { update: jest.fn() },
      payrollEmployee: { updateMany: jest.fn() },
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
    };

    eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    numberingService = {
      nextNumber: jest
        .fn()
        .mockResolvedValue({ formatted: 'PAY-000001', sequenceNumber: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayrollPaymentService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
        { provide: NumberingService, useValue: numberingService },
      ],
    }).compile();

    service = module.get<PayrollPaymentService>(PayrollPaymentService);
  });

  it('should disburse salary payments and update period status to PAID', async () => {
    prisma.payrollPeriod.findFirst.mockResolvedValue({
      id: periodId,
      organizationId: orgId,
      periodNumber: 'PR-000001',
      name: 'January 2026 Payroll',
      paymentDate: new Date('2026-01-31'),
      status: PayrollPeriodStatus.POSTED,
      payrollRuns: [
        {
          id: 'run-1',
          runNumber: 'PRUN-000001',
          status: PayrollRunStatus.POSTED,
          netPay: new Prisma.Decimal(5300),
          employeeCount: 1,
          paymentId: null,
        },
      ],
    });

    prisma.paymentAccount.findFirst.mockResolvedValue({
      id: 'pa-1',
      organizationId: orgId,
      currencyId: 'cur-usd',
      isActive: true,
    });
    prisma.paymentAccount.findUniqueOrThrow.mockResolvedValue({
      id: 'pa-1',
      organizationId: orgId,
      currencyId: 'cur-usd',
    });

    prisma.payment.create.mockResolvedValue({
      id: 'pay-rec-1',
      paymentNumber: 'PAY-000001',
      type: PaymentType.PAYMENT,
      status: PaymentStatus.POSTED,
    });

    prisma.payrollPeriod.update.mockResolvedValue({
      id: periodId,
      status: PayrollPeriodStatus.PAID,
    });

    const res = await service.pay(orgId, periodId, undefined, userId);

    expect(res.period.status).toBe(PayrollPeriodStatus.PAID);
    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: PaymentType.PAYMENT,
          amount: new Prisma.Decimal(5300),
        }),
      }),
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'PAYROLL_PAID' }),
    );
  });

  it('should prevent duplicate payments on already paid run', async () => {
    prisma.payrollPeriod.findFirst.mockResolvedValue({
      id: periodId,
      organizationId: orgId,
      status: PayrollPeriodStatus.POSTED,
      payrollRuns: [
        {
          id: 'run-1',
          paymentId: 'existing-payment-id',
        },
      ],
    });

    await expect(
      service.pay(orgId, periodId, undefined, userId),
    ).rejects.toThrow(BadRequestException);
  });
});
