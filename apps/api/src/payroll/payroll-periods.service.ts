import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import {
  CreatePayrollPeriodDto,
  PayrollPeriodQueryDto,
} from './dto/create-payroll-period.dto';
import { CreatePayrollInputDto } from './dto/create-payroll-input.dto';
import { Prisma, PayrollPeriodStatus } from '@prisma/client';

@Injectable()
export class PayrollPeriodsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async create(
    organizationId: string,
    dto: CreatePayrollPeriodDto,
    userId: string,
  ) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    const paymentDate = new Date(dto.paymentDate);

    if (endDate <= startDate) {
      throw new BadRequestException('End date must be after start date.');
    }

    // Auto-generate periodNumber if not provided
    let periodNumber = dto.periodNumber;
    if (!periodNumber) {
      const count = await this.prisma.payrollPeriod.count({
        where: { organizationId },
      });
      periodNumber = `PR-${String(count + 1).padStart(6, '0')}`;
    }

    const existingNumber = await this.prisma.payrollPeriod.findFirst({
      where: { organizationId, periodNumber },
    });
    if (existingNumber) {
      throw new ConflictException(
        `Payroll period with number "${periodNumber}" already exists in this organization.`,
      );
    }

    // Check non-overlapping active periods
    const overlapping = await this.prisma.payrollPeriod.findFirst({
      where: {
        organizationId,
        status: { notIn: [PayrollPeriodStatus.CANCELLED] },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    });

    if (overlapping) {
      throw new BadRequestException(
        `Payroll period dates (${dto.startDate} to ${dto.endDate}) overlap with existing period "${overlapping.name}" (${overlapping.startDate.toISOString().slice(0, 10)} to ${overlapping.endDate.toISOString().slice(0, 10)}).`,
      );
    }

    const period = await this.prisma.payrollPeriod.create({
      data: {
        organizationId,
        periodNumber,
        name: dto.name,
        startDate,
        endDate,
        paymentDate,
        status: PayrollPeriodStatus.DRAFT,
      },
    });

    await this.eventBus.publish({
      eventName: 'PAYROLL_PERIOD_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'payroll_period.created',
      resource: 'payroll_period',
      resourceId: period.id,
      details: {
        periodNumber: period.periodNumber,
        name: period.name,
      },
    });

    return period;
  }

  async findAll(organizationId: string, query: PayrollPeriodQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Prisma.PayrollPeriodWhereInput = {
      organizationId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.startDate || query.endDate
        ? {
            startDate: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.payrollPeriod.findMany({
        where,
        include: {
          payrollRuns: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          _count: { select: { payrollInputs: true } },
        },
        orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.payrollPeriod.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(organizationId: string, id: string) {
    const period = await this.prisma.payrollPeriod.findFirst({
      where: { id, organizationId },
      include: {
        payrollRuns: {
          include: {
            journalEntry: true,
            payment: true,
            payrollEmployees: {
              include: {
                employee: {
                  select: {
                    id: true,
                    employeeNumber: true,
                    displayName: true,
                    department: true,
                    jobPosition: true,
                  },
                },
              },
            },
          },
        },
        payrollInputs: {
          include: {
            employee: {
              select: { id: true, employeeNumber: true, displayName: true },
            },
          },
        },
      },
    });

    if (!period) {
      throw new NotFoundException(`Payroll period ${id} not found.`);
    }

    return period;
  }

  async addInput(organizationId: string, dto: CreatePayrollInputDto) {
    const period = await this.findOne(organizationId, dto.payrollPeriodId);

    if (
      period.status !== PayrollPeriodStatus.DRAFT &&
      period.status !== PayrollPeriodStatus.OPEN &&
      period.status !== PayrollPeriodStatus.CALCULATED
    ) {
      throw new BadRequestException(
        `Cannot add payroll input to period in status ${period.status}. Inputs can only be added to DRAFT, OPEN, or CALCULATED periods.`,
      );
    }

    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, organizationId, deletedAt: null },
    });
    if (!employee) {
      throw new NotFoundException(`Employee ${dto.employeeId} not found.`);
    }

    return this.prisma.payrollInput.create({
      data: {
        organizationId,
        payrollPeriodId: dto.payrollPeriodId,
        employeeId: dto.employeeId,
        inputType: dto.inputType,
        quantity: new Prisma.Decimal(dto.quantity ?? 0),
        amount: new Prisma.Decimal(dto.amount),
        description: dto.description,
        sourceReference: dto.sourceReference,
      },
      include: {
        employee: {
          select: { id: true, employeeNumber: true, displayName: true },
        },
      },
    });
  }

  async cancel(organizationId: string, id: string, userId: string) {
    const period = await this.findOne(organizationId, id);

    if (
      period.status === PayrollPeriodStatus.POSTED ||
      period.status === PayrollPeriodStatus.PAID ||
      period.status === PayrollPeriodStatus.CLOSED
    ) {
      throw new BadRequestException(
        `Cannot cancel payroll period in status ${period.status}.`,
      );
    }

    const updated = await this.prisma.payrollPeriod.update({
      where: { id },
      data: { status: PayrollPeriodStatus.CANCELLED },
    });

    await this.eventBus.publish({
      eventName: 'PAYROLL_CANCELLED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'payroll_period.cancelled',
      resource: 'payroll_period',
      resourceId: updated.id,
      details: { periodNumber: updated.periodNumber },
    });

    return updated;
  }

  async close(organizationId: string, id: string, userId: string) {
    const period = await this.findOne(organizationId, id);

    if (
      period.status !== PayrollPeriodStatus.POSTED &&
      period.status !== PayrollPeriodStatus.PAID
    ) {
      throw new BadRequestException(
        `Cannot close payroll period in status ${period.status}. Only POSTED or PAID periods can be closed.`,
      );
    }

    const updated = await this.prisma.payrollPeriod.update({
      where: { id },
      data: {
        status: PayrollPeriodStatus.CLOSED,
        closedAt: new Date(),
      },
    });

    await this.eventBus.publish({
      eventName: 'PAYROLL_CLOSED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'payroll_period.closed',
      resource: 'payroll_period',
      resourceId: updated.id,
      details: { periodNumber: updated.periodNumber },
    });

    return updated;
  }
}
