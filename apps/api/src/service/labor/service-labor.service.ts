import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import {
  RecordServiceLaborDto,
  UpdateServiceLaborDto,
} from '../dto/service-labor.dto';
import {
  ServiceLaborEntry,
  ServiceOrderStatus,
  EmploymentStatus,
  Prisma,
} from '@prisma/client';

@Injectable()
export class ServiceLaborService {
  private readonly logger = new Logger(ServiceLaborService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async findByServiceOrder(
    organizationId: string,
    serviceOrderId: string,
  ): Promise<ServiceLaborEntry[]> {
    return this.prisma.serviceLaborEntry.findMany({
      where: { organizationId, serviceOrderId },
      include: { employee: true },
      orderBy: { workDate: 'asc' },
    });
  }

  async recordLabor(
    organizationId: string,
    serviceOrderId: string,
    dto: RecordServiceLaborDto,
    userId: string,
  ): Promise<ServiceLaborEntry> {
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id: serviceOrderId, organizationId },
    });
    if (!order) {
      throw new NotFoundException(
        `Service order with ID ${serviceOrderId} not found in this organization.`,
      );
    }

    if (
      order.status === ServiceOrderStatus.CLOSED ||
      order.status === ServiceOrderStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot record labor for service order in status: ${order.status}.`,
      );
    }

    const employee = await this.prisma.employee.findFirst({
      where: {
        id: dto.employeeId,
        organizationId,
        employmentStatus: EmploymentStatus.ACTIVE,
      },
    });
    if (!employee) {
      throw new BadRequestException(
        `Employee with ID ${dto.employeeId} is not active in this organization.`,
      );
    }

    const config = await this.prisma.serviceConfiguration.findFirst({
      where: { organizationId },
    });
    const defaultLaborRate = config?.defaultLaborRate ?? new Prisma.Decimal(75);

    const billableHours = new Prisma.Decimal(dto.billableHours);
    const actualHours = new Prisma.Decimal(dto.actualHours);
    const laborRate =
      dto.laborRate !== undefined
        ? new Prisma.Decimal(dto.laborRate)
        : defaultLaborRate;
    const internalCostRate = new Prisma.Decimal(dto.internalCostRate || 0);

    if (billableHours.lt(0) || actualHours.lt(0)) {
      throw new BadRequestException('Labor hours cannot be negative.');
    }
    if (laborRate.lt(0) || internalCostRate.lt(0)) {
      throw new BadRequestException('Labor rates cannot be negative.');
    }

    const laborCost = actualHours.mul(internalCostRate);
    const laborCharge = billableHours.mul(laborRate);

    const isFinalized = dto.isFinalized ?? false;
    const now = new Date();

    const laborEntry = await this.prisma.$transaction(async (tx) => {
      const entry = await tx.serviceLaborEntry.create({
        data: {
          organizationId,
          serviceOrderId: order.id,
          employeeId: employee.id,
          workDate: new Date(dto.workDate),
          billableHours,
          actualHours,
          laborRate,
          internalCostRate,
          laborCost,
          laborCharge,
          warrantyCovered: dto.warrantyCovered ?? false,
          description: dto.description.trim(),
          isFinalized,
          finalizedAt: isFinalized ? now : null,
        },
        include: { employee: true },
      });

      // Update ServiceOrder laborCost, totalCost, warrantyCost or customerCharge
      const newLaborCost = order.laborCost.plus(laborCost);
      const newTotalCost = order.totalCost.plus(laborCost);
      let newWarrantyCost = order.warrantyCost;
      let newCustomerCharge = order.customerCharge;

      if (dto.warrantyCovered) {
        newWarrantyCost = newWarrantyCost.plus(laborCost);
      } else {
        newCustomerCharge = newCustomerCharge.plus(laborCharge);
      }

      await tx.serviceOrder.update({
        where: { id: serviceOrderId },
        data: {
          laborCost: newLaborCost,
          totalCost: newTotalCost,
          warrantyCost: newWarrantyCost,
          customerCharge: newCustomerCharge,
          status:
            order.status === ServiceOrderStatus.RELEASED
              ? ServiceOrderStatus.IN_PROGRESS
              : order.status,
        },
      });

      return entry;
    });

    await this.eventBus.publish({
      eventName: 'SERVICE_LABOR_RECORDED',
      occurredAt: now,
      organizationId,
      actorUserId: userId,
      action: 'record_labor',
      resource: 'service_labor_entry',
      resourceId: laborEntry.id,
      details: {
        serviceOrderId,
        employeeId: employee.id,
        billableHours: billableHours.toString(),
        actualHours: actualHours.toString(),
        laborCost: laborCost.toString(),
      },
    });

    return laborEntry;
  }

  async updateLabor(
    organizationId: string,
    serviceOrderId: string,
    laborId: string,
    dto: UpdateServiceLaborDto,
    userId: string,
  ): Promise<ServiceLaborEntry> {
    const entry = await this.prisma.serviceLaborEntry.findFirst({
      where: { id: laborId, serviceOrderId, organizationId },
    });

    if (!entry) {
      throw new NotFoundException(
        `Labor entry with ID ${laborId} not found for this service order.`,
      );
    }

    if (entry.isFinalized) {
      throw new BadRequestException(
        'Cannot modify a finalized labor entry. Historical records are immutable.',
      );
    }

    const billableHours =
      dto.billableHours !== undefined
        ? new Prisma.Decimal(dto.billableHours)
        : entry.billableHours;
    const actualHours =
      dto.actualHours !== undefined
        ? new Prisma.Decimal(dto.actualHours)
        : entry.actualHours;
    const laborRate =
      dto.laborRate !== undefined
        ? new Prisma.Decimal(dto.laborRate)
        : entry.laborRate;

    const laborCost = actualHours.mul(entry.internalCostRate);
    const laborCharge = billableHours.mul(laborRate);
    const isFinalized = dto.isFinalized ?? entry.isFinalized;
    const now = new Date();

    return this.prisma.serviceLaborEntry.update({
      where: { id: entry.id },
      data: {
        billableHours,
        actualHours,
        laborRate,
        laborCost,
        laborCharge,
        warrantyCovered: dto.warrantyCovered ?? entry.warrantyCovered,
        description: dto.description
          ? dto.description.trim()
          : entry.description,
        isFinalized,
        finalizedAt: isFinalized ? now : entry.finalizedAt,
      },
      include: { employee: true },
    });
  }

  async finalizeLabor(
    organizationId: string,
    serviceOrderId: string,
    laborId: string,
    userId: string,
  ): Promise<ServiceLaborEntry> {
    const entry = await this.prisma.serviceLaborEntry.findFirst({
      where: { id: laborId, serviceOrderId, organizationId },
    });

    if (!entry) {
      throw new NotFoundException(
        `Labor entry with ID ${laborId} not found for this service order.`,
      );
    }

    if (entry.isFinalized) {
      return entry;
    }

    return this.prisma.serviceLaborEntry.update({
      where: { id: entry.id },
      data: {
        isFinalized: true,
        finalizedAt: new Date(),
      },
      include: { employee: true },
    });
  }
}
