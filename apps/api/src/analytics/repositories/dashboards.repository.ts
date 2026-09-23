import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  Prisma,
  Dashboard,
  DashboardWidget,
  DashboardShare,
  DashboardVisibility,
  ReportShareType,
} from '@prisma/client';

@Injectable()
export class DashboardsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizationId: string,
    ownerUserId: string,
    data: Omit<Prisma.DashboardCreateWithoutOrganizationInput, 'ownerUser'>,
  ): Promise<Dashboard> {
    return this.prisma.dashboard.create({
      data: {
        ...data,
        organization: { connect: { id: organizationId } },
        ownerUser: { connect: { id: ownerUserId } },
      },
      include: {
        widgets: {
          include: { savedReport: true },
        },
        shares: true,
      },
    });
  }

  async findById(
    id: string,
    organizationId: string,
  ): Promise<
    | (Dashboard & {
        widgets: (DashboardWidget & { savedReport: any })[];
        shares: DashboardShare[];
      })
    | null
  > {
    return this.prisma.dashboard.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        widgets: {
          include: { savedReport: true },
          orderBy: { createdAt: 'asc' },
        },
        shares: true,
      },
    });
  }

  async findMany(params: {
    organizationId: string;
    userId?: string;
    userRoles?: string[];
    userTeams?: string[];
    visibility?: DashboardVisibility;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ dashboards: Dashboard[]; total: number }> {
    const {
      organizationId,
      userId,
      userRoles = [],
      userTeams = [],
      visibility,
      search,
      limit = 50,
      offset = 0,
    } = params;

    const accessOrConditions: Prisma.DashboardWhereInput[] = [
      { visibility: DashboardVisibility.PUBLIC },
      { visibility: DashboardVisibility.ORGANIZATION },
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

    const where: Prisma.DashboardWhereInput = {
      organizationId,
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

    const [dashboards, total] = await Promise.all([
      this.prisma.dashboard.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { updatedAt: 'desc' },
        include: {
          widgets: {
            include: { savedReport: true },
          },
          shares: true,
        },
      }),
      this.prisma.dashboard.count({ where }),
    ]);

    return { dashboards, total };
  }

  async update(
    id: string,
    organizationId: string,
    data: Prisma.DashboardUpdateInput,
  ): Promise<Dashboard> {
    return this.prisma.dashboard.update({
      where: {
        id,
        organizationId,
      },
      data,
      include: {
        widgets: {
          include: { savedReport: true },
        },
        shares: true,
      },
    });
  }

  async delete(id: string, organizationId: string): Promise<Dashboard> {
    return this.prisma.dashboard.delete({
      where: {
        id,
        organizationId,
      },
    });
  }

  async addWidget(
    dashboardId: string,
    organizationId: string,
    data: Omit<
      Prisma.DashboardWidgetCreateWithoutDashboardInput,
      'organization'
    >,
  ): Promise<DashboardWidget> {
    return this.prisma.dashboardWidget.create({
      data: {
        ...data,
        dashboard: { connect: { id: dashboardId } },
        organization: { connect: { id: organizationId } },
      },
      include: {
        savedReport: true,
      },
    });
  }

  async updateWidget(
    widgetId: string,
    dashboardId: string,
    organizationId: string,
    data: Prisma.DashboardWidgetUpdateInput,
  ): Promise<DashboardWidget> {
    return this.prisma.dashboardWidget.update({
      where: {
        id: widgetId,
        dashboardId,
        organizationId,
      },
      data,
      include: {
        savedReport: true,
      },
    });
  }

  async removeWidget(
    widgetId: string,
    dashboardId: string,
    organizationId: string,
  ): Promise<DashboardWidget> {
    return this.prisma.dashboardWidget.delete({
      where: {
        id: widgetId,
        dashboardId,
        organizationId,
      },
    });
  }

  async addShare(
    dashboardId: string,
    organizationId: string,
    shareType: ReportShareType,
    targetId: string,
  ): Promise<DashboardShare> {
    return this.prisma.dashboardShare.upsert({
      where: {
        dashboardId_shareType_targetId: {
          dashboardId,
          shareType,
          targetId,
        },
      },
      update: {},
      create: {
        dashboardId,
        organizationId,
        shareType,
        targetId,
      },
    });
  }

  async removeShare(
    dashboardId: string,
    organizationId: string,
    shareType: ReportShareType,
    targetId: string,
  ): Promise<Prisma.BatchPayload> {
    return this.prisma.dashboardShare.deleteMany({
      where: {
        dashboardId,
        organizationId,
        shareType,
        targetId,
      },
    });
  }

  async countByOrganization(organizationId: string): Promise<number> {
    return this.prisma.dashboard.count({
      where: { organizationId },
    });
  }
}
