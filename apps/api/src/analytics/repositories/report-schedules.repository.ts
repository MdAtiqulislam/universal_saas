import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, ReportSchedule } from '@prisma/client';

@Injectable()
export class ReportSchedulesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizationId: string,
    data: Prisma.ReportScheduleCreateWithoutOrganizationInput,
  ): Promise<ReportSchedule> {
    return this.prisma.reportSchedule.create({
      data: {
        ...data,
        organization: { connect: { id: organizationId } },
      },
      include: {
        savedReport: true,
      },
    });
  }

  async findById(
    id: string,
    organizationId: string,
  ): Promise<ReportSchedule | null> {
    return this.prisma.reportSchedule.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        savedReport: true,
      },
    });
  }

  async findDueSchedules(asOf: Date = new Date()): Promise<ReportSchedule[]> {
    return this.prisma.reportSchedule.findMany({
      where: {
        isActive: true,
        OR: [{ nextRunAt: null }, { nextRunAt: { lte: asOf } }],
      },
      include: {
        savedReport: true,
        organization: true,
      },
    });
  }

  async update(
    id: string,
    organizationId: string,
    data: Prisma.ReportScheduleUpdateInput,
  ): Promise<ReportSchedule> {
    return this.prisma.reportSchedule.update({
      where: {
        id,
        organizationId,
      },
      data,
      include: {
        savedReport: true,
      },
    });
  }

  async delete(id: string, organizationId: string): Promise<ReportSchedule> {
    return this.prisma.reportSchedule.delete({
      where: {
        id,
        organizationId,
      },
    });
  }

  async listSchedules(organizationId: string): Promise<ReportSchedule[]> {
    return this.prisma.reportSchedule.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: {
        savedReport: true,
      },
    });
  }

  async countByOrganization(organizationId: string): Promise<number> {
    return this.prisma.reportSchedule.count({
      where: { organizationId },
    });
  }
}
