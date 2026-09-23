import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import {
  CreateJobPositionDto,
  UpdateJobPositionDto,
} from './dto/create-job-position.dto';

@Injectable()
export class JobPositionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async create(
    organizationId: string,
    dto: CreateJobPositionDto,
    userId: string,
  ) {
    const existing = await this.prisma.jobPosition.findFirst({
      where: { organizationId, code: dto.code },
    });
    if (existing) {
      throw new ConflictException(
        `Job position with code "${dto.code}" already exists in this organization.`,
      );
    }

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

    const pos = await this.prisma.jobPosition.create({
      data: {
        organizationId,
        code: dto.code,
        title: dto.title,
        description: dto.description,
        departmentId: dto.departmentId ?? null,
        active: dto.active ?? true,
      },
      include: { department: true },
    });

    await this.eventBus.publish({
      eventName: 'JOB_POSITION_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'job_position.created',
      resource: 'job_position',
      resourceId: pos.id,
      details: {
        code: pos.code,
        title: pos.title,
      },
    });

    return pos;
  }

  async findAll(organizationId: string, departmentId?: string) {
    return this.prisma.jobPosition.findMany({
      where: {
        organizationId,
        ...(departmentId ? { departmentId } : {}),
      },
      include: {
        department: true,
        _count: { select: { employees: true } },
      },
      orderBy: { title: 'asc' },
    });
  }

  async findOne(organizationId: string, id: string) {
    const pos = await this.prisma.jobPosition.findFirst({
      where: { id, organizationId },
      include: {
        department: true,
        employees: {
          where: { deletedAt: null },
          select: {
            id: true,
            employeeNumber: true,
            displayName: true,
            employmentStatus: true,
          },
        },
      },
    });

    if (!pos) {
      throw new NotFoundException(`Job position ${id} not found.`);
    }

    return pos;
  }

  async update(organizationId: string, id: string, dto: UpdateJobPositionDto) {
    const pos = await this.findOne(organizationId, id);

    if (dto.code && dto.code !== pos.code) {
      const existing = await this.prisma.jobPosition.findFirst({
        where: { organizationId, code: dto.code, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException(
          `Job position with code "${dto.code}" already exists in this organization.`,
        );
      }
    }

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

    return this.prisma.jobPosition.update({
      where: { id },
      data: {
        ...(dto.code ? { code: dto.code } : {}),
        ...(dto.title ? { title: dto.title } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.departmentId !== undefined
          ? { departmentId: dto.departmentId }
          : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
      include: { department: true },
    });
  }

  async delete(organizationId: string, id: string) {
    const pos = await this.findOne(organizationId, id);
    return this.prisma.jobPosition.delete({ where: { id: pos.id } });
  }
}
