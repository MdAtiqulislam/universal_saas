import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeeQueryDto } from './dto/employee-query.dto';
import { Prisma, EmploymentStatus } from '@prisma/client';

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async create(organizationId: string, dto: CreateEmployeeDto, userId: string) {
    const hireDate = new Date(dto.hireDate);
    const terminationDate = dto.terminationDate
      ? new Date(dto.terminationDate)
      : null;

    if (terminationDate && terminationDate < hireDate) {
      throw new BadRequestException(
        'Termination date cannot precede hire date.',
      );
    }

    // Auto-generate employeeNumber if omitted
    let employeeNumber = dto.employeeNumber;
    if (!employeeNumber) {
      const count = await this.prisma.employee.count({
        where: { organizationId },
      });
      employeeNumber = `EMP-${String(count + 1).padStart(5, '0')}`;
    }

    // Check unique employeeNumber in org
    const existing = await this.prisma.employee.findFirst({
      where: { organizationId, employeeNumber, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException(
        `Employee number "${employeeNumber}" already exists in this organization.`,
      );
    }

    // Validate relations in same organization
    if (dto.departmentId) {
      const dept = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, organizationId },
      });
      if (!dept) {
        throw new NotFoundException(
          `Department ${dto.departmentId} not found.`,
        );
      }
    }

    if (dto.jobPositionId) {
      const pos = await this.prisma.jobPosition.findFirst({
        where: { id: dto.jobPositionId, organizationId },
      });
      if (!pos) {
        throw new NotFoundException(
          `Job position ${dto.jobPositionId} not found.`,
        );
      }
    }

    if (dto.managerEmployeeId) {
      const mgr = await this.prisma.employee.findFirst({
        where: { id: dto.managerEmployeeId, organizationId, deletedAt: null },
      });
      if (!mgr) {
        throw new NotFoundException(
          `Manager employee ${dto.managerEmployeeId} not found.`,
        );
      }
    }

    const displayName =
      dto.displayName || `${dto.firstName} ${dto.lastName}`.trim();

    const employee = await this.prisma.employee.create({
      data: {
        organizationId,
        employeeNumber,
        firstName: dto.firstName,
        lastName: dto.lastName,
        displayName,
        email: dto.email,
        phone: dto.phone,
        nationalIdReference: dto.nationalIdReference,
        hireDate,
        terminationDate,
        employmentStatus: dto.employmentStatus ?? EmploymentStatus.ACTIVE,
        employmentType: dto.employmentType ?? 'FULL_TIME',
        departmentId: dto.departmentId ?? null,
        jobPositionId: dto.jobPositionId ?? null,
        designation: dto.designation ?? null,
        managerEmployeeId: dto.managerEmployeeId ?? null,
        defaultPaymentAccountId: dto.defaultPaymentAccountId ?? null,
        payrollCurrencyId: dto.payrollCurrencyId ?? null,
      },
      include: {
        department: true,
        jobPosition: true,
        manager: {
          select: { id: true, employeeNumber: true, displayName: true },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'EMPLOYEE_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'employee.created',
      resource: 'employee',
      resourceId: employee.id,
      details: {
        employeeNumber: employee.employeeNumber,
        displayName: employee.displayName,
        employmentStatus: employee.employmentStatus,
      },
    });

    return employee;
  }

  async findAll(organizationId: string, query: EmployeeQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Prisma.EmployeeWhereInput = {
      organizationId,
      deletedAt: null,
      ...(query.status ? { employmentStatus: query.status } : {}),
      ...(query.type ? { employmentType: query.type } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { displayName: { contains: query.search, mode: 'insensitive' } },
              {
                employeeNumber: { contains: query.search, mode: 'insensitive' },
              },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        include: {
          department: true,
          jobPosition: true,
          manager: {
            select: { id: true, employeeNumber: true, displayName: true },
          },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.employee.count({ where }),
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
    const employee = await this.prisma.employee.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        department: true,
        jobPosition: true,
        manager: {
          select: { id: true, employeeNumber: true, displayName: true },
        },
        directReports: {
          where: { deletedAt: null },
          select: {
            id: true,
            employeeNumber: true,
            displayName: true,
            employmentStatus: true,
          },
        },
        compensations: {
          orderBy: { effectiveFrom: 'desc' },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException(`Employee ${id} not found.`);
    }

    return employee;
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateEmployeeDto,
    userId: string,
  ) {
    const employee = await this.findOne(organizationId, id);

    // Prevent self as manager
    if (dto.managerEmployeeId && dto.managerEmployeeId === id) {
      throw new BadRequestException('Employee cannot be their own manager.');
    }

    if (dto.managerEmployeeId) {
      const mgr = await this.prisma.employee.findFirst({
        where: { id: dto.managerEmployeeId, organizationId, deletedAt: null },
      });
      if (!mgr) {
        throw new NotFoundException(
          `Manager employee ${dto.managerEmployeeId} not found.`,
        );
      }
    }

    const hireDate = dto.hireDate ? new Date(dto.hireDate) : employee.hireDate;
    const terminationDate =
      dto.terminationDate !== undefined
        ? dto.terminationDate
          ? new Date(dto.terminationDate)
          : null
        : employee.terminationDate;

    if (terminationDate && terminationDate < hireDate) {
      throw new BadRequestException(
        'Termination date cannot precede hire date.',
      );
    }

    const updated = await this.prisma.employee.update({
      where: { id: employee.id },
      data: {
        ...(dto.firstName ? { firstName: dto.firstName } : {}),
        ...(dto.lastName ? { lastName: dto.lastName } : {}),
        ...(dto.displayName ? { displayName: dto.displayName } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.nationalIdReference !== undefined
          ? { nationalIdReference: dto.nationalIdReference }
          : {}),
        ...(dto.hireDate ? { hireDate } : {}),
        ...(dto.terminationDate !== undefined ? { terminationDate } : {}),
        ...(dto.employmentStatus
          ? { employmentStatus: dto.employmentStatus }
          : {}),
        ...(dto.employmentType ? { employmentType: dto.employmentType } : {}),
        ...(dto.departmentId !== undefined
          ? { departmentId: dto.departmentId }
          : {}),
        ...(dto.jobPositionId !== undefined
          ? { jobPositionId: dto.jobPositionId }
          : {}),
        ...(dto.designation !== undefined
          ? { designation: dto.designation }
          : {}),
        ...(dto.managerEmployeeId !== undefined
          ? { managerEmployeeId: dto.managerEmployeeId }
          : {}),
        ...(dto.defaultPaymentAccountId !== undefined
          ? { defaultPaymentAccountId: dto.defaultPaymentAccountId }
          : {}),
        ...(dto.payrollCurrencyId !== undefined
          ? { payrollCurrencyId: dto.payrollCurrencyId }
          : {}),
      },
      include: {
        department: true,
        jobPosition: true,
        manager: {
          select: { id: true, employeeNumber: true, displayName: true },
        },
      },
    });

    const isTerminated =
      updated.employmentStatus === EmploymentStatus.TERMINATED ||
      (employee.employmentStatus !== EmploymentStatus.TERMINATED &&
        dto.employmentStatus === EmploymentStatus.TERMINATED);

    await this.eventBus.publish({
      eventName: isTerminated ? 'EMPLOYEE_TERMINATED' : 'EMPLOYEE_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: isTerminated ? 'employee.terminated' : 'employee.updated',
      resource: 'employee',
      resourceId: updated.id,
      details: {
        employeeNumber: updated.employeeNumber,
        displayName: updated.displayName,
        employmentStatus: updated.employmentStatus,
      },
    });

    return updated;
  }

  async delete(organizationId: string, id: string, userId: string) {
    const employee = await this.findOne(organizationId, id);

    const updated = await this.prisma.employee.update({
      where: { id: employee.id },
      data: {
        employmentStatus: EmploymentStatus.TERMINATED,
        deletedAt: new Date(),
      },
    });

    await this.eventBus.publish({
      eventName: 'EMPLOYEE_TERMINATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'employee.deleted',
      resource: 'employee',
      resourceId: updated.id,
      details: {
        employeeNumber: updated.employeeNumber,
      },
    });

    return updated;
  }
}
