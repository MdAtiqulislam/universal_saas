import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import {
  CreateCompensationDto,
  UpdateCompensationDto,
} from './dto/create-compensation.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class CompensationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async create(
    organizationId: string,
    dto: CreateCompensationDto,
    userId: string,
  ) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, organizationId, deletedAt: null },
    });
    if (!employee) {
      throw new NotFoundException(`Employee ${dto.employeeId} not found.`);
    }

    const effectiveFrom = new Date(dto.effectiveFrom);
    const effectiveUntil = dto.effectiveUntil
      ? new Date(dto.effectiveUntil)
      : null;

    if (effectiveUntil && effectiveUntil < effectiveFrom) {
      throw new BadRequestException(
        'Effective until date cannot precede effective from date.',
      );
    }

    // Check for overlapping compensation records for this employee
    await this.validateNoOverlap(
      organizationId,
      dto.employeeId,
      effectiveFrom,
      effectiveUntil,
    );

    const baseSalary = new Prisma.Decimal(dto.baseSalary);
    const housingAllowance = new Prisma.Decimal(dto.housingAllowance ?? 0);
    const transportAllowance = new Prisma.Decimal(dto.transportAllowance ?? 0);
    const medicalAllowance = new Prisma.Decimal(dto.medicalAllowance ?? 0);
    const otherAllowance = new Prisma.Decimal(dto.otherAllowance ?? 0);
    const overtimeRate = new Prisma.Decimal(dto.overtimeRate ?? 0);

    const comp = await this.prisma.employeeCompensation.create({
      data: {
        organizationId,
        employeeId: dto.employeeId,
        effectiveFrom,
        effectiveUntil,
        baseSalary,
        housingAllowance,
        transportAllowance,
        medicalAllowance,
        otherAllowance,
        overtimeRate,
        paymentAccountId: dto.paymentAccountId ?? null,
        currencyId: dto.currencyId ?? null,
        active: dto.active ?? true,
      },
      include: {
        employee: {
          select: { id: true, employeeNumber: true, displayName: true },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'COMPENSATION_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'compensation.created',
      resource: 'employee_compensation',
      resourceId: comp.id,
      details: {
        employeeId: comp.employeeId,
        effectiveFrom: comp.effectiveFrom.toISOString().slice(0, 10),
        effectiveUntil: comp.effectiveUntil
          ? comp.effectiveUntil.toISOString().slice(0, 10)
          : null,
      },
    });

    return comp;
  }

  async findByEmployee(organizationId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organizationId, deletedAt: null },
    });
    if (!employee) {
      throw new NotFoundException(`Employee ${employeeId} not found.`);
    }

    return this.prisma.employeeCompensation.findMany({
      where: { organizationId, employeeId },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  async findEffective(organizationId: string, employeeId: string, date: Date) {
    return this.prisma.employeeCompensation.findFirst({
      where: {
        organizationId,
        employeeId,
        active: true,
        effectiveFrom: { lte: date },
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: date } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateCompensationDto,
    userId: string,
  ) {
    const existing = await this.prisma.employeeCompensation.findFirst({
      where: { id, organizationId },
    });
    if (!existing) {
      throw new NotFoundException(`Compensation record ${id} not found.`);
    }

    const effectiveFrom = dto.effectiveFrom
      ? new Date(dto.effectiveFrom)
      : existing.effectiveFrom;
    const effectiveUntil =
      dto.effectiveUntil !== undefined
        ? dto.effectiveUntil
          ? new Date(dto.effectiveUntil)
          : null
        : existing.effectiveUntil;

    if (effectiveUntil && effectiveUntil < effectiveFrom) {
      throw new BadRequestException(
        'Effective until date cannot precede effective from date.',
      );
    }

    await this.validateNoOverlap(
      organizationId,
      existing.employeeId,
      effectiveFrom,
      effectiveUntil,
      id,
    );

    const updated = await this.prisma.employeeCompensation.update({
      where: { id },
      data: {
        ...(dto.effectiveFrom ? { effectiveFrom } : {}),
        ...(dto.effectiveUntil !== undefined ? { effectiveUntil } : {}),
        ...(dto.baseSalary !== undefined
          ? { baseSalary: new Prisma.Decimal(dto.baseSalary) }
          : {}),
        ...(dto.housingAllowance !== undefined
          ? { housingAllowance: new Prisma.Decimal(dto.housingAllowance) }
          : {}),
        ...(dto.transportAllowance !== undefined
          ? { transportAllowance: new Prisma.Decimal(dto.transportAllowance) }
          : {}),
        ...(dto.medicalAllowance !== undefined
          ? { medicalAllowance: new Prisma.Decimal(dto.medicalAllowance) }
          : {}),
        ...(dto.otherAllowance !== undefined
          ? { otherAllowance: new Prisma.Decimal(dto.otherAllowance) }
          : {}),
        ...(dto.overtimeRate !== undefined
          ? { overtimeRate: new Prisma.Decimal(dto.overtimeRate) }
          : {}),
        ...(dto.paymentAccountId !== undefined
          ? { paymentAccountId: dto.paymentAccountId }
          : {}),
        ...(dto.currencyId !== undefined ? { currencyId: dto.currencyId } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });

    await this.eventBus.publish({
      eventName: 'COMPENSATION_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'compensation.updated',
      resource: 'employee_compensation',
      resourceId: updated.id,
      details: {
        employeeId: updated.employeeId,
        effectiveFrom: updated.effectiveFrom.toISOString().slice(0, 10),
      },
    });

    return updated;
  }

  private async validateNoOverlap(
    organizationId: string,
    employeeId: string,
    from: Date,
    until: Date | null,
    excludeId?: string,
  ) {
    const existingRecords = await this.prisma.employeeCompensation.findMany({
      where: {
        organizationId,
        employeeId,
        active: true,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });

    for (const rec of existingRecords) {
      const recStart = rec.effectiveFrom;
      const recEnd = rec.effectiveUntil;

      // Two ranges [A_start, A_end] and [B_start, B_end] overlap if:
      // A_start <= B_end && B_start <= A_end (treating null end as infinity)
      const aEnd = until ? until.getTime() : Infinity;
      const bEnd = recEnd ? recEnd.getTime() : Infinity;

      const overlap = from.getTime() <= bEnd && recStart.getTime() <= aEnd;
      if (overlap) {
        throw new BadRequestException(
          `Compensation date range (${from.toISOString().slice(0, 10)} to ${until ? until.toISOString().slice(0, 10) : 'ongoing'}) overlaps with existing record (${recStart.toISOString().slice(0, 10)} to ${recEnd ? recEnd.toISOString().slice(0, 10) : 'ongoing'}).`,
        );
      }
    }
  }
}
