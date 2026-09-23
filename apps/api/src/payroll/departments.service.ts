import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import {
  CreateDepartmentDto,
  UpdateDepartmentDto,
} from './dto/create-department.dto';

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async create(
    organizationId: string,
    dto: CreateDepartmentDto,
    userId: string,
  ) {
    const existing = await this.prisma.department.findFirst({
      where: { organizationId, code: dto.code },
    });
    if (existing) {
      throw new ConflictException(
        `Department with code "${dto.code}" already exists in this organization.`,
      );
    }

    if (dto.parentDepartmentId) {
      const parent = await this.prisma.department.findFirst({
        where: { id: dto.parentDepartmentId, organizationId },
      });
      if (!parent) {
        throw new NotFoundException(
          `Parent department ${dto.parentDepartmentId} not found.`,
        );
      }
    }

    const dept = await this.prisma.department.create({
      data: {
        organizationId,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        parentDepartmentId: dto.parentDepartmentId ?? null,
        active: dto.active ?? true,
      },
      include: {
        parentDepartment: true,
        childDepartments: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'DEPARTMENT_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'department.created',
      resource: 'department',
      resourceId: dept.id,
      details: {
        code: dept.code,
        name: dept.name,
      },
    });

    return dept;
  }

  async findAll(organizationId: string) {
    return this.prisma.department.findMany({
      where: { organizationId },
      include: {
        parentDepartment: true,
        childDepartments: true,
        _count: { select: { employees: true, jobPositions: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(organizationId: string, id: string) {
    const dept = await this.prisma.department.findFirst({
      where: { id, organizationId },
      include: {
        parentDepartment: true,
        childDepartments: true,
        jobPositions: true,
        employees: {
          where: { deletedAt: null },
          select: {
            id: true,
            employeeNumber: true,
            displayName: true,
            designation: true,
            employmentStatus: true,
          },
        },
      },
    });

    if (!dept) {
      throw new NotFoundException(`Department ${id} not found.`);
    }

    return dept;
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateDepartmentDto,
    userId: string,
  ) {
    const dept = await this.findOne(organizationId, id);

    if (dto.code && dto.code !== dept.code) {
      const existing = await this.prisma.department.findFirst({
        where: { organizationId, code: dto.code, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException(
          `Department with code "${dto.code}" already exists in this organization.`,
        );
      }
    }

    if (dto.parentDepartmentId) {
      if (dto.parentDepartmentId === id) {
        throw new BadRequestException('Department cannot be its own parent.');
      }

      // Check circular hierarchy
      let currentParentId: string | null = dto.parentDepartmentId;
      while (currentParentId) {
        if (currentParentId === id) {
          throw new BadRequestException(
            'Circular department hierarchy detected. A department cannot be a descendant of itself.',
          );
        }
        const parentRecord: { parentDepartmentId: string | null } | null =
          await this.prisma.department.findFirst({
            where: { id: currentParentId, organizationId },
            select: { parentDepartmentId: true },
          });

        if (!parentRecord) {
          throw new NotFoundException(
            `Parent department ${currentParentId} not found.`,
          );
        }
        currentParentId = parentRecord.parentDepartmentId;
      }
    }

    const updated = await this.prisma.department.update({
      where: { id },
      data: {
        ...(dto.code ? { code: dto.code } : {}),
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.parentDepartmentId !== undefined
          ? { parentDepartmentId: dto.parentDepartmentId }
          : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
      include: {
        parentDepartment: true,
        childDepartments: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'DEPARTMENT_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'department.updated',
      resource: 'department',
      resourceId: updated.id,
      details: {
        code: updated.code,
        name: updated.name,
      },
    });

    return updated;
  }

  async delete(organizationId: string, id: string) {
    const dept = await this.findOne(organizationId, id);

    const hasEmployees = await this.prisma.employee.count({
      where: { organizationId, departmentId: id, deletedAt: null },
    });
    if (hasEmployees > 0) {
      throw new BadRequestException(
        'Cannot delete department with active assigned employees.',
      );
    }

    return this.prisma.department.delete({ where: { id: dept.id } });
  }
}
