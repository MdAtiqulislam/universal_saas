import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { DashboardsRepository } from '../repositories/dashboards.repository';
import { SavedReportsRepository } from '../repositories/saved-reports.repository';
import { AnalyticsDefinitionRegistry } from '../registry/analytics-definition.registry';
import { AuditService } from '../../audit/audit.service';
import {
  CreateDashboardDto,
  UpdateDashboardDto,
  CreateDashboardWidgetDto,
  UpdateDashboardWidgetDto,
} from '../dto/dashboard.dto';
import {
  Dashboard,
  DashboardWidget,
  DashboardShare,
  DashboardVisibility,
  ReportShareType,
  Prisma,
} from '@prisma/client';

interface WidgetConfigPayload {
  definitionKey?: string;
  [key: string]: unknown;
}

interface WidgetSavedReportPayload {
  definitionKey?: string;
  [key: string]: unknown;
}

function extractDefinitionKey(config: unknown): string | undefined {
  if (config && typeof config === 'object' && 'definitionKey' in config) {
    const val = (config as WidgetConfigPayload).definitionKey;
    return typeof val === 'string' ? val : undefined;
  }
  return undefined;
}

function extractReportDefinitionKey(savedReport: unknown): string | undefined {
  if (
    savedReport &&
    typeof savedReport === 'object' &&
    'definitionKey' in savedReport
  ) {
    const val = (savedReport as WidgetSavedReportPayload).definitionKey;
    return typeof val === 'string' ? val : undefined;
  }
  return undefined;
}

@Injectable()
export class DashboardsService {
  constructor(
    private readonly repo: DashboardsRepository,
    @Optional() private readonly reportsRepo?: SavedReportsRepository,
    @Optional() private readonly auditService?: AuditService,
  ) {}

  /**
   * Creates a new business intelligence dashboard (INV-512).
   */
  async createDashboard(params: {
    organizationId: string;
    userId: string;
    dto: CreateDashboardDto;
  }): Promise<Dashboard> {
    const { organizationId, userId, dto } = params;

    if (!organizationId) {
      throw new BadRequestException(
        'Tenant configuration must belong to exactly one organization (INV-502)',
      );
    }

    const created = await this.repo.create(organizationId, userId, {
      name: dto.name,
      description: dto.description,
      visibility: dto.visibility ?? DashboardVisibility.PRIVATE,
      layout:
        (dto.layout as unknown as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      isDefault: dto.isDefault ?? false,
    });

    await this.auditService?.record({
      eventName: 'analytics.dashboard.create',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'analytics.dashboard.create',
      resource: 'Dashboard',
      resourceId: created.id,
      details: { name: created.name },
    });

    return created;
  }

  /**
   * Retrieves a dashboard by ID with widgets and shares, checking tenant boundary (INV-502, INV-514, INV-522).
   */
  async getDashboard(params: {
    id: string;
    organizationId: string;
    userId?: string;
    userRoles?: string[];
    userTeams?: string[];
    userPermissions?: string[];
  }): Promise<Dashboard & { widgets: any[]; shares: DashboardShare[] }> {
    const {
      id,
      organizationId,
      userId,
      userRoles = [],
      userTeams = [],
      userPermissions,
    } = params;
    const dashboard = await this.repo.findById(id, organizationId);

    if (!dashboard) {
      throw new NotFoundException(`Dashboard "${id}" not found`);
    }

    if (
      dashboard.visibility === DashboardVisibility.PRIVATE &&
      userId &&
      dashboard.ownerUserId !== userId
    ) {
      const hasUserShare = dashboard.shares.some(
        (s) => s.shareType === ReportShareType.USER && s.targetId === userId,
      );
      const hasRoleShare = dashboard.shares.some(
        (s) =>
          s.shareType === ReportShareType.ROLE &&
          userRoles.includes(s.targetId),
      );
      const hasTeamShare = dashboard.shares.some(
        (s) =>
          s.shareType === ReportShareType.TEAM &&
          userTeams.includes(s.targetId),
      );

      if (!hasUserShare && !hasRoleShare && !hasTeamShare) {
        throw new ForbiddenException(
          'Personal dashboards are accessible only by their owner or shared principals (INV-514)',
        );
      }
    }

    // INV-522: Dashboard sharing cannot bypass underlying analytics or domain permissions
    if (userPermissions && dashboard.widgets && dashboard.widgets.length > 0) {
      for (const widget of dashboard.widgets) {
        let defKey = extractDefinitionKey(widget.config);
        if (!defKey && widget.savedReport) {
          defKey = extractReportDefinitionKey(widget.savedReport);
        }

        if (defKey) {
          const def = AnalyticsDefinitionRegistry.get(defKey);
          if (
            def &&
            def.requiredPermissions &&
            def.requiredPermissions.length > 0
          ) {
            const hasPerm = def.requiredPermissions.some(
              (p) =>
                userPermissions.includes(p) ||
                userPermissions.includes('analytics.admin'),
            );
            if (!hasPerm) {
              throw new ForbiddenException(
                `Dashboard sharing cannot bypass underlying domain permissions [${def.requiredPermissions.join(', ')}] for dataset "${defKey}" (INV-522)`,
              );
            }
          }
        }
      }
    }

    return dashboard;
  }

  /**
   * Lists accessible dashboards for tenant.
   */
  async listDashboards(params: {
    organizationId: string;
    userId?: string;
    userRoles?: string[];
    userTeams?: string[];
    visibility?: DashboardVisibility;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ dashboards: Dashboard[]; total: number }> {
    return this.repo.findMany(params);
  }

  /**
   * Updates a dashboard (INV-525).
   */
  async updateDashboard(params: {
    id: string;
    organizationId: string;
    userId?: string;
    dto: UpdateDashboardDto;
  }): Promise<Dashboard> {
    const { id, organizationId, userId, dto } = params;
    const existing = await this.getDashboard({ id, organizationId, userId });

    if (
      userId &&
      existing.ownerUserId !== userId &&
      existing.visibility === DashboardVisibility.PRIVATE
    ) {
      throw new ForbiddenException(
        'Only dashboard owner can modify private dashboard',
      );
    }

    const updated = await this.repo.update(id, organizationId, {
      name: dto.name,
      description: dto.description,
      visibility: dto.visibility,
      layout: dto.layout
        ? (dto.layout as unknown as Prisma.InputJsonValue)
        : undefined,
      isDefault: dto.isDefault,
    });

    await this.auditService?.record({
      eventName: 'analytics.dashboard.update',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'analytics.dashboard.update',
      resource: 'Dashboard',
      resourceId: id,
      details: { name: updated.name },
    });

    return updated;
  }

  /**
   * Deletes a dashboard (INV-525).
   */
  async deleteDashboard(params: {
    id: string;
    organizationId: string;
    userId?: string;
  }): Promise<Dashboard> {
    const { id, organizationId, userId } = params;
    const existing = await this.getDashboard({ id, organizationId, userId });

    if (userId && existing.ownerUserId !== userId) {
      throw new ForbiddenException('Only dashboard owner can delete dashboard');
    }

    const deleted = await this.repo.delete(id, organizationId);

    await this.auditService?.record({
      eventName: 'analytics.dashboard.delete',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'analytics.dashboard.delete',
      resource: 'Dashboard',
      resourceId: id,
      details: { name: deleted.name },
    });

    return deleted;
  }

  /**
   * Adds a widget to a dashboard (INV-521, INV-525).
   */
  async addWidget(params: {
    dashboardId: string;
    organizationId: string;
    userId?: string;
    dto: CreateDashboardWidgetDto;
  }): Promise<DashboardWidget> {
    const { dashboardId, organizationId, userId, dto } = params;
    await this.getDashboard({ id: dashboardId, organizationId, userId });

    // INV-521: Dashboard widgets may reference only valid analytics definitions
    let defKey = extractDefinitionKey(dto.config);
    if (dto.savedReportId) {
      if (this.reportsRepo) {
        const report = await this.reportsRepo.findById(
          dto.savedReportId,
          organizationId,
        );
        if (!report) {
          throw new BadRequestException(
            'Dashboard widget references invalid saved report (INV-521)',
          );
        }
        defKey = report.definitionKey;
      }
    }

    if (defKey && !AnalyticsDefinitionRegistry.has(defKey)) {
      throw new BadRequestException(
        `Dashboard widget references invalid analytics definition "${defKey}" (INV-521)`,
      );
    }

    const widget = await this.repo.addWidget(dashboardId, organizationId, {
      title: dto.title,
      widgetType: dto.widgetType,
      position: dto.position,
      config:
        (dto.config as unknown as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      ...(dto.savedReportId
        ? { savedReport: { connect: { id: dto.savedReportId } } }
        : {}),
    });

    await this.auditService?.record({
      eventName: 'analytics.dashboard.widget.add',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'analytics.dashboard.widget.add',
      resource: 'DashboardWidget',
      resourceId: widget.id,
      details: { dashboardId, title: widget.title },
    });

    return widget;
  }

  /**
   * Updates a widget in a dashboard (INV-521, INV-525).
   */
  async updateWidget(params: {
    widgetId: string;
    dashboardId: string;
    organizationId: string;
    userId?: string;
    dto: UpdateDashboardWidgetDto;
  }): Promise<DashboardWidget> {
    const { widgetId, dashboardId, organizationId, userId, dto } = params;
    await this.getDashboard({ id: dashboardId, organizationId, userId });

    // INV-521: Dashboard widgets may reference only valid analytics definitions
    const configDefKey = extractDefinitionKey(dto.config);
    if (dto.savedReportId || configDefKey) {
      let defKey = configDefKey;
      if (dto.savedReportId && this.reportsRepo) {
        const report = await this.reportsRepo.findById(
          dto.savedReportId,
          organizationId,
        );
        if (!report) {
          throw new BadRequestException(
            'Dashboard widget references invalid saved report (INV-521)',
          );
        }
        defKey = report.definitionKey;
      }
      if (defKey && !AnalyticsDefinitionRegistry.has(defKey)) {
        throw new BadRequestException(
          `Dashboard widget references invalid analytics definition "${defKey}" (INV-521)`,
        );
      }
    }

    const updated = await this.repo.updateWidget(
      widgetId,
      dashboardId,
      organizationId,
      {
        title: dto.title,
        widgetType: dto.widgetType,
        position: dto.position ? dto.position : undefined,
        config: dto.config
          ? (dto.config as unknown as Prisma.InputJsonValue)
          : undefined,
        ...(dto.savedReportId
          ? { savedReport: { connect: { id: dto.savedReportId } } }
          : {}),
      },
    );

    await this.auditService?.record({
      eventName: 'analytics.dashboard.widget.update',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'analytics.dashboard.widget.update',
      resource: 'DashboardWidget',
      resourceId: widgetId,
      details: { dashboardId, title: updated.title },
    });

    return updated;
  }

  /**
   * Removes a widget from a dashboard (INV-525).
   */
  async removeWidget(params: {
    widgetId: string;
    dashboardId: string;
    organizationId: string;
    userId?: string;
  }): Promise<DashboardWidget> {
    const { widgetId, dashboardId, organizationId, userId } = params;
    await this.getDashboard({ id: dashboardId, organizationId, userId });

    const removed = await this.repo.removeWidget(
      widgetId,
      dashboardId,
      organizationId,
    );

    await this.auditService?.record({
      eventName: 'analytics.dashboard.widget.remove',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'analytics.dashboard.widget.remove',
      resource: 'DashboardWidget',
      resourceId: widgetId,
      details: { dashboardId },
    });

    return removed;
  }

  /**
   * Shares a dashboard with a user, role, or team (INV-525).
   */
  async shareDashboard(params: {
    dashboardId: string;
    organizationId: string;
    userId?: string;
    shareType: ReportShareType;
    targetId: string;
  }): Promise<DashboardShare> {
    const { dashboardId, organizationId, userId, shareType, targetId } = params;
    const existing = await this.getDashboard({
      id: dashboardId,
      organizationId,
      userId,
    });

    if (userId && existing.ownerUserId !== userId) {
      throw new ForbiddenException('Only dashboard owner can share dashboard');
    }

    if (!targetId || targetId.trim() === '') {
      throw new BadRequestException('Target ID is required for sharing');
    }

    const share = await this.repo.addShare(
      dashboardId,
      organizationId,
      shareType,
      targetId,
    );

    await this.auditService?.record({
      eventName: 'analytics.dashboard.share',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'analytics.dashboard.share',
      resource: 'Dashboard',
      resourceId: dashboardId,
      details: { shareType, targetId },
    });

    return share;
  }

  /**
   * Revokes a dashboard share (INV-525).
   */
  async revokeShare(params: {
    dashboardId: string;
    organizationId: string;
    userId?: string;
    shareType: ReportShareType;
    targetId: string;
  }): Promise<void> {
    const { dashboardId, organizationId, userId, shareType, targetId } = params;
    const existing = await this.getDashboard({
      id: dashboardId,
      organizationId,
      userId,
    });

    if (userId && existing.ownerUserId !== userId) {
      throw new ForbiddenException('Only dashboard owner can revoke share');
    }

    await this.repo.removeShare(
      dashboardId,
      organizationId,
      shareType,
      targetId,
    );

    await this.auditService?.record({
      eventName: 'analytics.dashboard.share.revoke',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'analytics.dashboard.share.revoke',
      resource: 'Dashboard',
      resourceId: dashboardId,
      details: { shareType, targetId },
    });
  }
}
