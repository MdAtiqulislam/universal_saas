import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import {
  PayrollPeriodStatus,
  PayrollRunStatus,
  PaymentType,
  PaymentStatus,
  PayrollPaymentStatus,
} from '@prisma/client';

@Injectable()
export class PayrollPaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
  ) {}

  async pay(
    organizationId: string,
    periodId: string,
    paymentAccountId: string | undefined,
    userId: string,
  ) {
    const period = await this.prisma.payrollPeriod.findFirst({
      where: { id: periodId, organizationId },
      include: {
        payrollRuns: {
          where: { status: PayrollRunStatus.POSTED },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { payrollEmployees: true },
        },
      },
    });

    if (!period) {
      throw new NotFoundException(`Payroll period ${periodId} not found.`);
    }

    if (period.status !== PayrollPeriodStatus.POSTED) {
      throw new BadRequestException(
        `Cannot process payment for payroll period in status ${period.status}. Period must be in POSTED status.`,
      );
    }

    if (!period.payrollRuns || period.payrollRuns.length === 0) {
      throw new BadRequestException(
        'No posted payroll run found for this period.',
      );
    }

    const run = period.payrollRuns[0];

    if (run.paymentId) {
      throw new BadRequestException(
        `Payroll run ${run.runNumber} has already been paid (Payment ID: ${run.paymentId}).`,
      );
    }

    // Resolve payment account (cash / bank)
    let pAccountId = paymentAccountId;
    if (!pAccountId) {
      const defaultPAccount = await this.prisma.paymentAccount.findFirst({
        where: { organizationId, isActive: true, deletedAt: null },
      });
      if (!defaultPAccount) {
        throw new BadRequestException(
          'No active payment account found for salary disbursement.',
        );
      }
      pAccountId = defaultPAccount.id;
    } else {
      const pAccount = await this.prisma.paymentAccount.findFirst({
        where: {
          id: pAccountId,
          organizationId,
          isActive: true,
          deletedAt: null,
        },
      });
      if (!pAccount) {
        throw new NotFoundException(`Payment account ${pAccountId} not found.`);
      }
    }

    const pAccount = await this.prisma.paymentAccount.findUniqueOrThrow({
      where: { id: pAccountId },
    });

    // Generate Payment Number
    const paymentSeq = await this.numberingService.nextNumber(
      organizationId,
      'PAYMENT',
      userId,
    );

    return this.prisma.$transaction(async (tx) => {
      // Create M15 Payment record
      const payment = await tx.payment.create({
        data: {
          organizationId,
          paymentNumber: paymentSeq.formatted,
          type: PaymentType.PAYMENT,
          paymentAccountId: pAccount.id,
          currencyId: pAccount.currencyId,
          paymentDate: period.paymentDate,
          amount: run.netPay,
          allocatedAmount: run.netPay,
          unallocatedAmount: 0,
          reference: `Salary Disbursement: ${period.name} (${run.runNumber})`,
          notes: `Batch payroll salary payment for ${run.employeeCount} employees.`,
          status: PaymentStatus.POSTED,
          createdByUserId: userId,
          postedByUserId: userId,
          postedAt: new Date(),
        },
      });

      // Update PayrollRun
      await tx.payrollRun.update({
        where: { id: run.id },
        data: { paymentId: payment.id },
      });

      // Update PayrollEmployees payment status
      await tx.payrollEmployee.updateMany({
        where: { payrollRunId: run.id, organizationId },
        data: {
          paymentStatus: PayrollPaymentStatus.PAID,
          paymentId: payment.id,
        },
      });

      // Update PayrollPeriod
      const updatedPeriod = await tx.payrollPeriod.update({
        where: { id: period.id },
        data: { status: PayrollPeriodStatus.PAID },
      });

      await this.eventBus.publish({
        eventName: 'PAYROLL_PAID',
        occurredAt: new Date(),
        organizationId,
        actorUserId: userId,
        action: 'payroll.paid',
        resource: 'payroll_period',
        resourceId: updatedPeriod.id,
        details: {
          periodNumber: updatedPeriod.periodNumber,
          runNumber: run.runNumber,
          paymentId: payment.id,
          paymentNumber: payment.paymentNumber,
          netAmount: run.netPay.toFixed(4),
        },
      });

      return {
        period: updatedPeriod,
        payment,
        runId: run.id,
      };
    });
  }
}
