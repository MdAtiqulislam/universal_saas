import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  Prisma,
  SavedReport,
  ReportShare,
  ReportVisibility,
  ReportShareType,
} from '@prisma/client';

@Injectable()
export class SavedReportsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizationId: string,
    ownerUserId: string,
    data: Omit<Prisma.SavedReportCreateWithoutOrganizationInput, 'ownerUser'>,
  ): Promise<SavedReport> {
    return this.prisma.savedReport.create({
      data: {
        ...data,
        organization: { connect: { id: organizationId } },
        ownerUser: { connect: { id: ownerUserId } },
      },
      include: {
        shares: true,
      },
    });
  }

  async findById(
    id: string,
    organizationId: string,
  ): Promise<(SavedReport & { shares: ReportShare[] }) | null> {
    return this.prisma.savedReport.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        shares: true,
      },
    });
  }

  async findMany(params: {
    organizationId: string;
    userId?: string;
    userRoles?: string[];
    userTeams?: string[];
    definitionKey?: string;
    visibility?: ReportVisibility;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ reports: SavedReport[]; total: number }> {
    const {
      organizationId,
      userId,
      userRoles = [],
      userTeams = [],
      definitionKey,
      visibility,
      search,
      limit = 50,
      offset = 0,
    } = params;

    const accessOrConditions: Prisma.SavedReportWhereInput[] = [
      { visibility: ReportVisibility.PUBLIC },
      { visibility: ReportVisibility.ORGANIZATION },
    ];

    if (userId) {
      accessOrConditions.push({ ownerUserId: userId });
      accessOrConditions.push({
        shares: {
          some: {
            shareType: ReportShareType.USER,
            targetId: userId,
          },
        },
      });
    }

    if (userRoles.length > 0) {
      accessOrConditions.push({
        shares: {
          some: {
            shareType: ReportShareType.ROLE,
            targetId: { in: userRoles },
          },
        },
      });
    }

    if (userTeams.length > 0) {
      accessOrConditions.push({
        shares: {
          some: {
            shareType: ReportShareType.TEAM,
            targetId: { in: userTeams },
          },
        },
      });
    }

    const where: Prisma.SavedReportWhereInput = {
      organizationId,
      ...(definitionKey ? { definitionKey } : {}),
      ...(visibility ? { visibility } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      OR: accessOrConditions,
    };

    const [reports, total] = await Promise.all([
      this.prisma.savedReport.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { updatedAt: 'desc' },
        include: {
          shares: true,
        },
      }),
      this.prisma.savedReport.count({ where }),
    ]);

    return { reports, total };
  }

  async update(
    id: string,
    organizationId: string,
    data: Prisma.SavedReportUpdateInput,
  ): Promise<SavedReport> {
    return this.prisma.savedReport.update({
      where: {
        id,
        organizationId,
      },
      data,
      include: {
        shares: true,
      },
    });
  }

  async delete(id: string, organizationId: string): Promise<SavedReport> {
    return this.prisma.savedReport.delete({
      where: {
        id,
        organizationId,
      },
    });
  }

  async addShare(
    savedReportId: string,
    organizationId: string,
    shareType: ReportShareType,
    targetId: string,
  ): Promise<ReportShare> {
    return this.prisma.reportShare.upsert({
      where: {
        savedReportId_shareType_targetId: {
          savedReportId,
          shareType,
          targetId,
        },
      },
      update: {},
      create: {
        savedReportId,
        organizationId,
        shareType,
        targetId,
      },
    });
  }

  async removeShare(
    savedReportId: string,
    organizationId: string,
    shareType: ReportShareType,
    targetId: string,
  ): Promise<Prisma.BatchPayload> {
    return this.prisma.reportShare.deleteMany({
      where: {
        savedReportId,
        organizationId,
        shareType,
        targetId,
      },
    });
  }

  async listShares(
    savedReportId: string,
    organizationId: string,
  ): Promise<ReportShare[]> {
    return this.prisma.reportShare.findMany({
      where: {
        savedReportId,
        organizationId,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async countByOrganization(organizationId: string): Promise<number> {
    return this.prisma.savedReport.count({
      where: { organizationId },
    });
  }
}
